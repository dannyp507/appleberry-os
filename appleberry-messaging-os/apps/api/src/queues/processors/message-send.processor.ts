import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CampaignRecipientStatus, CampaignStatus, MessageDirection, MessageStatus, ProviderType, SessionStatus, WhatsappAccountStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ProviderRegistryService } from '../../modules/provider-registry/provider-registry.service';
import { SendMessagePayload } from '../../modules/provider-registry/provider.types';
import { MessageSendJobData } from './campaign-dispatch.processor';

type TemplateBodyJson = {
  type?: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: string;
  caption?: string;
  buttons?: Array<{ id: string; title: string }>;
  templateName?: string;
  templateParams?: string[];
};

function applyPersonalization(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function buildSendPayload(
  phoneNumber: string,
  body: TemplateBodyJson,
  vars: Record<string, string>,
): SendMessagePayload {
  const type = (body.type ?? 'text') as SendMessagePayload['type'];

  return {
    to: phoneNumber,
    type,
    text: body.text ? applyPersonalization(body.text, vars) : undefined,
    mediaUrl: body.mediaUrl,
    mediaType: body.mediaType,
    caption: body.caption ? applyPersonalization(body.caption, vars) : undefined,
    buttons: body.buttons,
    templateName: body.templateName,
    templateParams: body.templateParams?.map((p) => applyPersonalization(p, vars)),
  };
}

@Processor('message-send')
export class MessageSendProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageSendProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistryService,
  ) {
    super();
  }

  async process(job: Job<MessageSendJobData>): Promise<{ providerMessageId?: string; status: string }> {
    const { campaignId, recipientId, contactId, accountId, workspaceId, phoneNumber, messageContent, personalizationVars } = job.data;

    this.logger.log(`[message-send] Processing job=${job.id} recipient=${recipientId} campaign=${campaignId}`);

    // 1. Load account + credentials
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
        rateLimitConfig: true,
        dailySendCount: true,
      },
    });

    if (!account) {
      await this.markRecipientFailed(recipientId, 'ACCOUNT_NOT_FOUND', 'WhatsApp account not found.');
      await this.createMessageLog(workspaceId, accountId, contactId, campaignId, messageContent, MessageStatus.FAILED, null, 'Account not found');
      return { status: 'account_not_found' };
    }

    // 2. Rate limit check
    const rateLimitConfig = (account.rateLimitConfig ?? {}) as { perMinuteCap?: number; dailyCap?: number };
    const dailyCap = rateLimitConfig.dailyCap ?? 10_000;
    if ((account.dailySendCount ?? 0) >= dailyCap) {
      await this.markRecipientFailed(recipientId, 'DAILY_CAP_EXCEEDED', 'Account daily send cap reached.');
      await this.createMessageLog(workspaceId, accountId, contactId, campaignId, messageContent, MessageStatus.FAILED, null, 'Daily cap exceeded');
      return { status: 'daily_cap_exceeded' };
    }

    // 3. Build provider context
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

    // 4. Build send payload from template body + personalization
    const templateBody = messageContent as TemplateBodyJson;
    const sendPayload = buildSendPayload(phoneNumber, templateBody, personalizationVars);

    // 5. Call provider adapter
    const adapter = this.providerRegistry.getAdapter(account.providerType as ProviderType);
    const result = await adapter.sendMessage(context, sendPayload);

    const providerMessageId = String(result.metadata?.providerMessageId ?? '');

    if (result.status === 'ok') {
      // 6a. Success path
      await this.prisma.$transaction([
        this.prisma.campaignRecipient.update({
          where: { id: recipientId },
          data: {
            status: CampaignRecipientStatus.SENT,
            sentAt: new Date(),
            errorCode: null,
            errorMessage: null,
          },
        }),
        this.prisma.whatsappAccount.update({
          where: { id: accountId },
          data: { dailySendCount: { increment: 1 }, monthlySendCount: { increment: 1 } },
        }),
      ]);

      await this.createMessageLog(
        workspaceId,
        accountId,
        contactId,
        campaignId,
        messageContent,
        MessageStatus.SENT,
        providerMessageId || null,
        null,
      );

      await this.checkAndMarkCampaignCompleted(campaignId);

      this.logger.log(`[message-send] Success job=${job.id} recipient=${recipientId} providerMsgId=${providerMessageId}`);
      return { providerMessageId, status: 'sent' };
    } else {
      // 6b. Failure path
      const errorCode = result.code ?? 'PROVIDER_ERROR';
      const errorMessage = result.message ?? 'Provider returned an error.';

      await this.markRecipientFailed(recipientId, errorCode, errorMessage);
      await this.createMessageLog(workspaceId, accountId, contactId, campaignId, messageContent, MessageStatus.FAILED, null, errorMessage);

      this.logger.warn(`[message-send] Failed job=${job.id} recipient=${recipientId} code=${errorCode} message=${errorMessage}`);

      // Throw to trigger BullMQ retry / dead-letter based on opts
      throw new Error(`[${errorCode}] ${errorMessage}`);
    }
  }

  private async markRecipientFailed(recipientId: string, errorCode: string, errorMessage: string): Promise<void> {
    await this.prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: {
        status: CampaignRecipientStatus.FAILED,
        errorCode,
        errorMessage,
      },
    });
  }

  private async createMessageLog(
    workspaceId: string,
    whatsappAccountId: string,
    contactId: string,
    campaignId: string,
    content: Record<string, unknown>,
    status: MessageStatus,
    providerMessageId: string | null,
    failureReason: string | null,
  ): Promise<void> {
    await this.prisma.messageLog.create({
      data: {
        workspaceId,
        whatsappAccountId,
        contactId,
        campaignId,
        direction: MessageDirection.OUTBOUND,
        status,
        providerMessageId: providerMessageId ?? undefined,
        providerPayload: {},
        content: content as any,
        failureReason: failureReason ?? undefined,
      },
    });
  }

  private async checkAndMarkCampaignCompleted(campaignId: string): Promise<void> {
    const counts = await this.prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { status: true },
    });

    const pending = counts.find((c) => c.status === CampaignRecipientStatus.PENDING)?._count.status ?? 0;
    const queued = counts.find((c) => c.status === CampaignRecipientStatus.QUEUED)?._count.status ?? 0;

    if (pending === 0 && queued === 0) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.COMPLETED },
      });
      this.logger.log(`[message-send] Campaign ${campaignId} marked COMPLETED`);
    }
  }
}
