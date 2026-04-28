import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MessageDirection, MessageStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type AnalyticsRollupJobData = {
  targetDate?: string;     // ISO date string (YYYY-MM-DD); defaults to yesterday
  workspaceId?: string;    // scope to one workspace; omit for all
  forceRecompute?: boolean;
};

type MessageStatusCounts = Partial<Record<MessageStatus, number>>;

type WorkspaceAccountDateKey = {
  workspaceId: string;
  whatsappAccountId: string | null;
  date: string;
};

type RollupEntry = WorkspaceAccountDateKey & {
  outbound: MessageStatusCounts;
  inbound: MessageStatusCounts;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  totalReceived: number;
  deliveryRate: number;
  readRate: number;
};

function dateToMidnight(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function datePlusDayMidnight(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Processor('analytics-rollup')
export class AnalyticsRollupProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsRollupProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<AnalyticsRollupJobData>): Promise<{ rollupDate: string; workspaces: number; entries: number }> {
    const { workspaceId, forceRecompute = false } = job.data;

    // Default to yesterday
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const rollupDate = job.data.targetDate ?? toYMD(yesterday);

    this.logger.log(`[analytics-rollup] Starting rollup for date=${rollupDate} workspace=${workspaceId ?? 'ALL'}`);

    const windowStart = dateToMidnight(rollupDate);
    const windowEnd = datePlusDayMidnight(rollupDate);

    // Fetch all message logs for the day
    const logs = await this.prisma.messageLog.findMany({
      where: {
        createdAt: { gte: windowStart, lt: windowEnd },
        ...(workspaceId ? { workspaceId } : {}),
      },
      select: {
        id: true,
        workspaceId: true,
        whatsappAccountId: true,
        direction: true,
        status: true,
        createdAt: true,
      },
    });

    this.logger.log(`[analytics-rollup] Fetched ${logs.length} log entries for ${rollupDate}`);

    // Group by workspaceId + whatsappAccountId + date
    const rollupMap = new Map<string, RollupEntry>();

    for (const log of logs) {
      const dateKey = toYMD(log.createdAt);
      const mapKey = `${log.workspaceId}::${log.whatsappAccountId ?? 'none'}::${dateKey}`;

      if (!rollupMap.has(mapKey)) {
        rollupMap.set(mapKey, {
          workspaceId: log.workspaceId,
          whatsappAccountId: log.whatsappAccountId,
          date: dateKey,
          outbound: {},
          inbound: {},
          totalSent: 0,
          totalDelivered: 0,
          totalRead: 0,
          totalFailed: 0,
          totalReceived: 0,
          deliveryRate: 0,
          readRate: 0,
        });
      }

      const entry = rollupMap.get(mapKey)!;

      if (log.direction === MessageDirection.OUTBOUND) {
        entry.outbound[log.status] = (entry.outbound[log.status] ?? 0) + 1;

        if (log.status === MessageStatus.SENT) entry.totalSent++;
        if (log.status === MessageStatus.DELIVERED) { entry.totalSent++; entry.totalDelivered++; }
        if (log.status === MessageStatus.READ) { entry.totalSent++; entry.totalDelivered++; entry.totalRead++; }
        if (log.status === MessageStatus.FAILED) entry.totalFailed++;
      } else {
        entry.inbound[log.status] = (entry.inbound[log.status] ?? 0) + 1;
        if (log.status === MessageStatus.RECEIVED) entry.totalReceived++;
      }
    }

    // Compute rates
    for (const entry of rollupMap.values()) {
      const totalOutbound = entry.totalSent + entry.totalDelivered + entry.totalRead + entry.totalFailed;
      entry.deliveryRate = totalOutbound > 0 ? Math.round((entry.totalDelivered / totalOutbound) * 10000) / 100 : 0;
      entry.readRate = totalOutbound > 0 ? Math.round((entry.totalRead / totalOutbound) * 10000) / 100 : 0;
    }

    // Persist rollup summary in ActivityLog (as pre-computed JSON)
    // Grouped by unique workspace
    const workspaceIds = [...new Set([...rollupMap.values()].map((e) => e.workspaceId))];
    let entryCount = 0;

    for (const wsId of workspaceIds) {
      const wsEntries = [...rollupMap.values()].filter((e) => e.workspaceId === wsId);

      const summary = {
        date: rollupDate,
        workspaceId: wsId,
        accounts: wsEntries.map((e) => ({
          whatsappAccountId: e.whatsappAccountId,
          date: e.date,
          outbound: e.outbound,
          inbound: e.inbound,
          totals: {
            sent: e.totalSent,
            delivered: e.totalDelivered,
            read: e.totalRead,
            failed: e.totalFailed,
            received: e.totalReceived,
          },
          rates: {
            deliveryRate: e.deliveryRate,
            readRate: e.readRate,
          },
        })),
        aggregated: {
          totalSent: wsEntries.reduce((s, e) => s + e.totalSent, 0),
          totalDelivered: wsEntries.reduce((s, e) => s + e.totalDelivered, 0),
          totalRead: wsEntries.reduce((s, e) => s + e.totalRead, 0),
          totalFailed: wsEntries.reduce((s, e) => s + e.totalFailed, 0),
          totalReceived: wsEntries.reduce((s, e) => s + e.totalReceived, 0),
        },
        computedAt: new Date().toISOString(),
      };

      // Store as ActivityLog entry — action = 'ANALYTICS_ROLLUP'
      // Using upsert-like pattern via delete + create when forceRecompute
      if (forceRecompute) {
        await this.prisma.activityLog.deleteMany({
          where: {
            workspaceId: wsId,
            action: 'ANALYTICS_ROLLUP',
            subjectType: 'Date',
            subjectId: rollupDate,
          },
        });
      }

      const existing = await this.prisma.activityLog.findFirst({
        where: {
          workspaceId: wsId,
          action: 'ANALYTICS_ROLLUP',
          subjectType: 'Date',
          subjectId: rollupDate,
        },
      });

      if (!existing || forceRecompute) {
        await this.prisma.activityLog.create({
          data: {
            workspaceId: wsId,
            action: 'ANALYTICS_ROLLUP',
            subjectType: 'Date',
            subjectId: rollupDate,
            metadata: summary,
          },
        });
        entryCount++;
      } else {
        this.logger.log(`[analytics-rollup] Rollup already exists for workspace=${wsId} date=${rollupDate}. Skipping (use forceRecompute=true to override).`);
      }
    }

    this.logger.log(
      `[analytics-rollup] Completed rollup for date=${rollupDate}: ${workspaceIds.length} workspaces, ${entryCount} entries written`,
    );

    return { rollupDate, workspaces: workspaceIds.length, entries: entryCount };
  }
}
