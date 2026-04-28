import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ProviderType, SessionStatus, WhatsappAccountStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ProviderRegistryService } from '../../modules/provider-registry/provider-registry.service';

export type SessionMonitorJobData = {
  triggeredAt?: string;
  workspaceId?: string; // optional: scope to one workspace
};

type AccountHealthUpdate = {
  accountId: string;
  wasConnected: boolean;
  isConnected: boolean;
  healthScoreDelta: number;
  newHealthScore: number;
};

const HEALTH_DECREMENT = 20;
const HEALTH_INCREMENT = 10;
const HEALTH_MAX = 100;
const HEALTH_MIN = 0;

@Processor('provider-session-monitor')
export class SessionMonitorProcessor extends WorkerHost {
  private readonly logger = new Logger(SessionMonitorProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistryService,
  ) {
    super();
  }

  async process(job: Job<SessionMonitorJobData>): Promise<{ checked: number; disconnected: number; recovered: number }> {
    const { workspaceId } = job.data;
    this.logger.log(`[session-monitor] Starting session health check job=${job.id}`);

    // Fetch all active WhatsApp accounts
    const accounts = await this.prisma.whatsappAccount.findMany({
      where: {
        status: WhatsappAccountStatus.ACTIVE,
        deletedAt: null,
        ...(workspaceId ? { workspaceId } : {}),
      },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        providerType: true,
        phoneNumber: true,
        status: true,
        sessionStatus: true,
        healthScore: true,
        encryptedCredentials: true,
      },
    });

    this.logger.log(`[session-monitor] Checking ${accounts.length} active accounts`);

    const updates: AccountHealthUpdate[] = [];
    let disconnectedCount = 0;
    let recoveredCount = 0;

    for (const account of accounts) {
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

      let isConnected = false;

      try {
        const adapter = this.providerRegistry.getAdapter(account.providerType as ProviderType);
        const result = await adapter.verifyConnection(context);
        isConnected = result.status === 'ok';
      } catch (err) {
        this.logger.warn(`[session-monitor] verifyConnection threw for account=${account.id}: ${String(err)}`);
        isConnected = false;
      }

      const wasConnected = account.sessionStatus === SessionStatus.CONNECTED;
      const currentHealth = account.healthScore ?? 100;

      let healthScoreDelta = 0;
      let newHealthScore = currentHealth;

      if (!isConnected) {
        healthScoreDelta = -HEALTH_DECREMENT;
        newHealthScore = Math.max(HEALTH_MIN, currentHealth + healthScoreDelta);
        disconnectedCount++;
      } else if (!wasConnected && isConnected) {
        // Recovery
        healthScoreDelta = HEALTH_INCREMENT;
        newHealthScore = Math.min(HEALTH_MAX, currentHealth + healthScoreDelta);
        recoveredCount++;
      } else if (isConnected) {
        // Steady state — nudge score up slightly each cycle (max 100)
        healthScoreDelta = currentHealth < HEALTH_MAX ? HEALTH_INCREMENT : 0;
        newHealthScore = Math.min(HEALTH_MAX, currentHealth + healthScoreDelta);
      }

      updates.push({ accountId: account.id, wasConnected, isConnected, healthScoreDelta, newHealthScore });

      // Persist account state update
      try {
        await this.prisma.whatsappAccount.update({
          where: { id: account.id },
          data: {
            sessionStatus: isConnected ? SessionStatus.CONNECTED : SessionStatus.DISCONNECTED,
            healthScore: newHealthScore,
            lastSyncAt: new Date(),
          },
        });
      } catch (err) {
        this.logger.warn(`[session-monitor] Failed to update account=${account.id}: ${String(err)}`);
      }

      // Create notification for disconnected accounts
      if (!isConnected && wasConnected) {
        try {
          await this.prisma.notification.create({
            data: {
              workspaceId: account.workspaceId,
              type: 'ACCOUNT_DISCONNECTED',
              title: `Account Disconnected: ${account.name}`,
              body: `Your WhatsApp account "${account.name}" has lost its connection. Please reconnect to resume messaging.`,
              metadata: { accountId: account.id, healthScore: newHealthScore },
            },
          });
        } catch (err) {
          this.logger.warn(`[session-monitor] Failed to create notification for account=${account.id}: ${String(err)}`);
        }
      }

      // Create notification for recovered accounts
      if (isConnected && !wasConnected) {
        try {
          await this.prisma.notification.create({
            data: {
              workspaceId: account.workspaceId,
              type: 'ACCOUNT_RECONNECTED',
              title: `Account Reconnected: ${account.name}`,
              body: `Your WhatsApp account "${account.name}" has successfully reconnected.`,
              metadata: { accountId: account.id, healthScore: newHealthScore },
            },
          });
        } catch (err) {
          this.logger.warn(`[session-monitor] Failed to create reconnected notification for account=${account.id}: ${String(err)}`);
        }
      }

      // Log to ActivityLog
      try {
        await this.prisma.activityLog.create({
          data: {
            workspaceId: account.workspaceId,
            action: isConnected ? 'SESSION_HEALTH_OK' : 'SESSION_HEALTH_FAIL',
            subjectType: 'WhatsappAccount',
            subjectId: account.id,
            metadata: {
              wasConnected,
              isConnected,
              healthScoreDelta,
              newHealthScore,
              checkedAt: new Date().toISOString(),
            },
          },
        });
      } catch (err) {
        this.logger.warn(`[session-monitor] Failed to write ActivityLog for account=${account.id}: ${String(err)}`);
      }
    }

    this.logger.log(
      `[session-monitor] Completed: checked=${accounts.length} disconnected=${disconnectedCount} recovered=${recoveredCount}`,
    );

    return { checked: accounts.length, disconnected: disconnectedCount, recovered: recoveredCount };
  }
}
