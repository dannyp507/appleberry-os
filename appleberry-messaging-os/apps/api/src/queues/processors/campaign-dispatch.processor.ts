import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { CampaignRecipientStatus, CampaignStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type CampaignDispatchJobData = {
  campaignId: string;
  workspaceId: string;
  accountId: string;
  triggeredBy?: string;
};

export type MessageSendJobData = {
  campaignId: string;
  recipientId: string;
  contactId: string;
  accountId: string;
  workspaceId: string;
  phoneNumber: string;
  messageContent: Record<string, unknown>;
  personalizationVars: Record<string, string>;
  attemptNumber: number;
};

type ThrottlingConfig = {
  batchSize?: number;
  delayBetweenBatchesMs?: number;
  dailyCap?: number;
};

const SKIP_STATUSES = new Set<CampaignRecipientStatus>([
  CampaignRecipientStatus.OPTED_OUT,
  CampaignRecipientStatus.INVALID,
  CampaignRecipientStatus.DUPLICATE,
  CampaignRecipientStatus.SENT,
  CampaignRecipientStatus.DELIVERED,
  CampaignRecipientStatus.READ,
  CampaignRecipientStatus.REPLIED,
  CampaignRecipientStatus.SKIPPED,
]);

@Processor('campaign-dispatch')
export class CampaignDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignDispatchProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('message-send') private readonly messageSendQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<CampaignDispatchJobData>): Promise<void> {
    const { campaignId, workspaceId, accountId } = job.data;
    this.logger.log(`[campaign-dispatch] Starting campaign=${campaignId} workspace=${workspaceId}`);

    // 1. Fetch campaign with recipients and template
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        recipients: {
          include: {
            contact: true,
          },
        },
        template: true,
        whatsappAccount: true,
      },
    });

    if (!campaign) {
      this.logger.error(`[campaign-dispatch] Campaign ${campaignId} not found. Aborting.`);
      return;
    }

    if (campaign.status === CampaignStatus.CANCELLED || campaign.status === CampaignStatus.FAILED) {
      this.logger.warn(`[campaign-dispatch] Campaign ${campaignId} is ${campaign.status}. Skipping.`);
      return;
    }

    // 2. Filter recipients
    const pendingRecipients = campaign.recipients.filter(
      (r) => !SKIP_STATUSES.has(r.status),
    );

    if (pendingRecipients.length === 0) {
      this.logger.log(`[campaign-dispatch] No pending recipients for campaign=${campaignId}. Marking COMPLETED.`);
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.COMPLETED },
      });
      return;
    }

    // 3. Check blacklist — contacts with optOutStatus=true
    const blacklistedContactIds = new Set<string>();
    const allContactIds = pendingRecipients.map((r) => r.contactId);
    const optedOutContacts = await this.prisma.contact.findMany({
      where: {
        id: { in: allContactIds },
        optOutStatus: true,
      },
      select: { id: true },
    });
    for (const c of optedOutContacts) {
      blacklistedContactIds.add(c.id);
    }

    // Mark blacklisted recipients as OPTED_OUT
    const blacklistedRecipientIds = pendingRecipients
      .filter((r) => blacklistedContactIds.has(r.contactId))
      .map((r) => r.id);

    if (blacklistedRecipientIds.length > 0) {
      await this.prisma.campaignRecipient.updateMany({
        where: { id: { in: blacklistedRecipientIds } },
        data: { status: CampaignRecipientStatus.OPTED_OUT },
      });
    }

    const eligibleRecipients = pendingRecipients.filter(
      (r) => !blacklistedContactIds.has(r.contactId),
    );

    // 4. Apply daily cap per account
    const effectiveAccountId = campaign.whatsappAccountId ?? accountId;
    const account = await this.prisma.whatsappAccount.findUnique({
      where: { id: effectiveAccountId },
      select: { dailySendCount: true, rateLimitConfig: true },
    });

    const rateLimitConfig = (account?.rateLimitConfig ?? {}) as { dailyCap?: number };
    const throttlingConfig = (campaign.throttlingConfig ?? {}) as ThrottlingConfig;
    const dailyCap = throttlingConfig.dailyCap ?? rateLimitConfig.dailyCap ?? 10_000;
    const currentDailyCount = account?.dailySendCount ?? 0;
    const remainingCapacity = Math.max(0, dailyCap - currentDailyCount);

    const cappedRecipients = eligibleRecipients.slice(0, remainingCapacity);
    const overCapRecipients = eligibleRecipients.slice(remainingCapacity);

    if (overCapRecipients.length > 0) {
      this.logger.warn(
        `[campaign-dispatch] Daily cap reached: ${overCapRecipients.length} recipients deferred for campaign=${campaignId}`,
      );
      await this.prisma.campaignRecipient.updateMany({
        where: { id: { in: overCapRecipients.map((r) => r.id) } },
        data: { status: CampaignRecipientStatus.SKIPPED, errorCode: 'DAILY_CAP_REACHED', errorMessage: 'Daily send cap exceeded; will retry tomorrow.' },
      });
    }

    if (cappedRecipients.length === 0) {
      this.logger.warn(`[campaign-dispatch] All recipients hit daily cap for campaign=${campaignId}.`);
      return;
    }

    // 5. Mark campaign as RUNNING
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.RUNNING },
    });

    // 6. Batch dispatch with throttling
    const batchSize = throttlingConfig.batchSize ?? 50;
    const delayBetweenBatchesMs = throttlingConfig.delayBetweenBatchesMs ?? 1_000;

    const templateBody = campaign.template?.body ?? {};
    const personalizationMap = (campaign.personalizationMap ?? {}) as Record<string, string>;

    let enqueuedCount = 0;

    for (let i = 0; i < cappedRecipients.length; i += batchSize) {
      const batch = cappedRecipients.slice(i, i + batchSize);

      const jobs = batch.map((recipient) => {
        const contact = recipient.contact;
        const personalizationVars: Record<string, string> = {
          firstName: contact.firstName ?? '',
          lastName: contact.lastName ?? '',
          fullName: contact.fullName ?? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim(),
          phoneNumber: contact.phoneNumber,
          ...personalizationMap,
        };

        const jobData: MessageSendJobData = {
          campaignId,
          recipientId: recipient.id,
          contactId: recipient.contactId,
          accountId: effectiveAccountId,
          workspaceId,
          phoneNumber: contact.phoneNumber,
          messageContent: templateBody as Record<string, unknown>,
          personalizationVars,
          attemptNumber: 1,
        };

        return {
          name: 'send',
          data: jobData,
          opts: {
            delay: Math.floor(i / batchSize) * delayBetweenBatchesMs,
            attempts: 3,
            backoff: { type: 'exponential' as const, delay: 5_000 },
            removeOnComplete: { age: 60 * 60 * 24 },
            removeOnFail: { age: 60 * 60 * 24 * 7 },
          },
        };
      });

      await this.messageSendQueue.addBulk(jobs);
      enqueuedCount += batch.length;

      // Mark recipients as QUEUED
      await this.prisma.campaignRecipient.updateMany({
        where: { id: { in: batch.map((r) => r.id) } },
        data: { status: CampaignRecipientStatus.QUEUED },
      });
    }

    // 7. Record campaign event
    await this.prisma.campaignEvent.create({
      data: {
        campaignId,
        type: 'DISPATCH_QUEUED',
        payload: {
          enqueuedCount,
          skippedBlacklist: blacklistedRecipientIds.length,
          skippedDailyCap: overCapRecipients.length,
          batchSize,
          delayBetweenBatchesMs,
        },
      },
    });

    this.logger.log(
      `[campaign-dispatch] Enqueued ${enqueuedCount} message jobs for campaign=${campaignId}`,
    );
  }
}
