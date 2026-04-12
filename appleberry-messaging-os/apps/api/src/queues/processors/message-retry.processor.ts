import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { CampaignRecipientStatus, MessageDirection, MessageStatus, ProviderType, SessionStatus, WhatsappAccountStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ProviderRegistryService } from '../../modules/provider-registry/provider-registry.service';
import { SendMessagePayload } from '../../modules/provider-registry/provider.types';

export type MessageRetryJobData = {
  campaignId: string;
  recipientId: string;
  contactId: string;
  accountId: string;
  workspaceId: string;
  phoneNumber: string;
  messageContent: Record<string, unknown>;
  personalizationVars: Record<string, string>;
  attemptNumber: number;
  originalErrorCode: string;
  originalErrorMessage: string;
  messageLogId?: string;
};

const MAX_RETRIES = 3;

type FailureCategory = 'RATE_LIMITED' | 'INVALID_NUMBER' | 'SESSION_EXPIRED' | 'TEMPORARY_FAILURE' | 'UNKNOWN';

function categorizeError(errorCode: string): FailureCategory {
  const code = errorCode.toUpperCase();
  if (code.includes('RATE') || code.includes('TOO_MANY') || code.includes('131056')) return 'RATE_LIMITED';
  if (code.includes('INVALID_NUMBER') || code.includes('131026') || code.includes('BAD_USER')) return 'INVALID_NUMBER';
  if (code.includes('SESSION') || code.includes('AUTH') || code.includes('EXPIRED')) return 'SESSION_EXPIRED';
  if (code.includes('TEMPORARY') || code.includes('TIMEOUT') || code.includes('503') || code.includes('502')) return 'TEMPORARY_FAILURE';
  return 'UNKNOWN';
}

function applyPersonalization(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

@Processor('message-retry')
export class MessageRetryProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageRetryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistryService,
    @InjectQueue('message-retry') private readonly retryQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<MessageRetryJobData>): Promise<{ status: string; nextAttempt?: number }> {
    const {
      campaignId,
      recipientId,
      contactId,
      accountId,
      workspaceId,
      phoneNumber,
      messageContent,
      personalizationVars,
      attemptNumber,
      originalErrorCode,
      messageLogId,
    } = job.data;

    this.logger.log(
      `[message-retry] Attempt ${attemptNumber}/${MAX_RETRIES} for recipient=${recipientId} campaign=${campaignId} errorCode=${originalErrorCode}`,
    );

    const category = categorizeError(originalErrorCode);

    // INVALID_NUMBER: mark and skip, no retry
    if (category === 'INVALID_NUMBER') {
      this.logger.warn(`[message-retry] INVALID_NUMBER for recipient=${recipientId}. Marking INVALID.`);
      await this.prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          status: CampaignRecipientStatus.INVALID,
          errorCode: 'INVALID_NUMBER',
          errorMessage: 'Phone number is invalid or unreachable.',
        },
      });
      if (messageLogId) {
        await this.updateMessageLog(messageLogId, MessageStatus.FAILED, 'INVALID_NUMBER — no further retries', attemptNumber);
      }
      return { status: 'invalid_number_skipped' };
    }

    // Check max retries
    if (attemptNumber > MAX_RETRIES) {
      this.logger.warn(`[message-retry] Max retries (${MAX_RETRIES}) exceeded for recipient=${recipientId}. Giving up.`);
      await this.prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          status: CampaignRecipientStatus.FAILED,
          errorCode: 'MAX_RETRIES_EXCEEDED',
          errorMessage: `Failed after ${MAX_RETRIES} retry attempts.`,
        },
      });
      if (messageLogId) {
        await this.updateMessageLog(messageLogId, MessageStatus.FAILED, `Max retries exceeded (${MAX_RETRIES})`, attemptNumber);
      }
      return { status: 'max_retries_exceeded' };
    }

    // SESSION_EXPIRED: trigger reconnect then re-queue
    if (category === 'SESSION_EXPIRED') {
      this.logger.log(`[message-retry] SESSION_EXPIRED for account=${accountId}. Triggering reconnect.`);
      await this.triggerAccountReconnect(accountId);

      const backoffMs = Math.pow(2, attemptNumber) * 30_000; // 30s, 60s, 120s
      await this.retryQueue.add(
        'retry',
        { ...job.data, attemptNumber: attemptNumber + 1, originalErrorCode },
        { delay: backoffMs, removeOnComplete: { age: 86400 }, removeOnFail: { age: 86400 * 7 } },
      );
      return { status: 'session_reconnect_triggered', nextAttempt: attemptNumber + 1 };
    }

    // RATE_LIMITED: wait longer before re-queuing
    if (category === 'RATE_LIMITED') {
      const backoffMs = Math.pow(2, attemptNumber) * 60_000; // 60s, 120s, 240s
      this.logger.log(`[message-retry] RATE_LIMITED. Re-queuing in ${backoffMs}ms.`);
      await this.retryQueue.add(
        'retry',
        { ...job.data, attemptNumber: attemptNumber + 1, originalErrorCode },
        { delay: backoffMs, removeOnComplete: { age: 86400 }, removeOnFail: { age: 86400 * 7 } },
      );
      return { status: 'rate_limited_requeued', nextAttempt: attemptNumber + 1 };
    }

    // TEMPORARY_FAILURE / UNKNOWN: standard exponential retry — attempt the send now
    const account = await this.prisma.whatsappAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        name: true,
        providerType: true,
        phoneNumber: true,
        status: true,
        sessionStatus: true,
        encryptedCredentials: true,
      },
    });

    if (!account) {
      this.logger.error(`[message-retry] Account ${accountId} not found.`);
      return { status: 'account_not_found' };
    }

    const credentials = (account.encryptedCredentials ?? {}) as Record<string, unknown>;
    const context = {
      account: {
        id: account.id,
        name: account.name,
        providerType: account.providerType as ProviderType,
        phoneNumber: account.phoneNumber,
        status: account.status as WhatsappAccountStatus,
        sessionStatus: account.sessionStatus as SessionStatus,
      },
      credentials,
    };

    const body = messageContent as {
      type?: string;
      text?: string;
      mediaUrl?: string;
      mediaType?: string;
      caption?: string;
      buttons?: Array<{ id: string; title: string }>;
      templateName?: string;
      templateParams?: string[];
    };

    const sendPayload: SendMessagePayload = {
      to: phoneNumber,
      type: (body.type ?? 'text') as SendMessagePayload['type'],
      text: body.text ? applyPersonalization(body.text, personalizationVars) : undefined,
      mediaUrl: body.mediaUrl,
      mediaType: body.mediaType,
      caption: body.caption ? applyPersonalization(body.caption, personalizationVars) : undefined,
      buttons: body.buttons,
      templateName: body.templateName,
      templateParams: body.templateParams?.map((p) => applyPersonalization(p, personalizationVars)),
    };

    const adapter = this.providerRegistry.getAdapter(account.providerType as ProviderType);
    const result = await adapter.sendMessage(context, sendPayload);

    if (result.status === 'ok') {
      const providerMessageId = String(result.metadata?.providerMessageId ?? '');
      await this.prisma.campaignRecipient.update({
        where: { id: recipientId },
        data: {
          status: CampaignRecipientStatus.SENT,
          sentAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });
      await this.prisma.whatsappAccount.update({
        where: { id: accountId },
        data: { dailySendCount: { increment: 1 }, monthlySendCount: { increment: 1 } },
      });
      await this.prisma.messageLog.create({
        data: {
          workspaceId,
          whatsappAccountId: accountId,
          contactId,
          campaignId,
          direction: MessageDirection.OUTBOUND,
          status: MessageStatus.SENT,
          providerMessageId: providerMessageId || undefined,
          providerPayload: { retryAttempt: attemptNumber },
          content: messageContent as any,
        },
      });
      if (messageLogId) {
        await this.updateMessageLog(messageLogId, MessageStatus.SENT, null, attemptNumber);
      }
      this.logger.log(`[message-retry] Retry succeeded on attempt ${attemptNumber} for recipient=${recipientId}`);
      return { status: 'sent_on_retry' };
    } else {
      const nextAttempt = attemptNumber + 1;
      if (nextAttempt > MAX_RETRIES) {
        await this.prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: {
            status: CampaignRecipientStatus.FAILED,
            errorCode: 'MAX_RETRIES_EXCEEDED',
            errorMessage: `All ${MAX_RETRIES} retries exhausted.`,
          },
        });
        return { status: 'max_retries_exhausted' };
      }

      const backoffMs = Math.pow(2, attemptNumber) * 10_000;
      await this.retryQueue.add(
        'retry',
        { ...job.data, attemptNumber: nextAttempt, originalErrorCode: result.code },
        { delay: backoffMs, removeOnComplete: { age: 86400 }, removeOnFail: { age: 86400 * 7 } },
      );
      return { status: 'requeued', nextAttempt };
    }
  }

  private async triggerAccountReconnect(accountId: string): Promise<void> {
    try {
      await this.prisma.whatsappAccount.update({
        where: { id: accountId },
        data: { reconnectStatus: 'reconnect_triggered_by_retry_processor' },
      });
    } catch (err) {
      this.logger.warn(`[message-retry] Could not update reconnect status for account=${accountId}: ${String(err)}`);
    }
  }

  private async updateMessageLog(
    messageLogId: string,
    status: MessageStatus,
    failureReason: string | null,
    retryAttempt: number,
  ): Promise<void> {
    try {
      await this.prisma.messageLog.update({
        where: { id: messageLogId },
        data: {
          status,
          failureReason: failureReason ?? undefined,
          providerPayload: { retryAttempt },
        },
      });
    } catch (err) {
      this.logger.warn(`[message-retry] Could not update messageLog=${messageLogId}: ${String(err)}`);
    }
  }
}
