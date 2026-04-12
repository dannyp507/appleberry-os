import { Injectable } from '@nestjs/common';
import { Workspace } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildDateFilter(dto: AnalyticsQueryDto) {
    const filter: { gte?: Date; lte?: Date } = {};
    if (dto.dateFrom) filter.gte = new Date(dto.dateFrom);
    if (dto.dateTo) filter.lte = new Date(dto.dateTo);
    return Object.keys(filter).length > 0 ? filter : undefined;
  }

  async getOverview(workspace: Workspace, dto: AnalyticsQueryDto) {
    const dateFilter = this.buildDateFilter(dto);
    const createdAt = dateFilter ? { createdAt: dateFilter } : {};

    const [
      totalContacts,
      totalMessages,
      inboundMessages,
      outboundMessages,
      totalCampaigns,
      activeCampaigns,
      openThreads,
    ] = await Promise.all([
      this.prisma.contact.count({
        where: { workspaceId: workspace.id, deletedAt: null, ...createdAt },
      }),
      this.prisma.messageLog.count({
        where: { workspaceId: workspace.id, ...createdAt },
      }),
      this.prisma.messageLog.count({
        where: { workspaceId: workspace.id, direction: 'INBOUND', ...createdAt },
      }),
      this.prisma.messageLog.count({
        where: { workspaceId: workspace.id, direction: 'OUTBOUND', ...createdAt },
      }),
      this.prisma.campaign.count({
        where: { workspaceId: workspace.id, ...createdAt },
      }),
      this.prisma.campaign.count({
        where: { workspaceId: workspace.id, status: 'RUNNING' },
      }),
      this.prisma.inboxThread.count({
        where: { workspaceId: workspace.id, status: 'OPEN' },
      }),
    ]);

    return {
      totalContacts,
      totalMessages,
      inboundMessages,
      outboundMessages,
      totalCampaigns,
      activeCampaigns,
      openThreads,
    };
  }

  async getCampaignAnalytics(workspace: Workspace, dto: AnalyticsQueryDto) {
    const dateFilter = this.buildDateFilter(dto);

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        workspaceId: workspace.id,
        ...(dto.campaignId ? { id: dto.campaignId } : {}),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      include: {
        _count: { select: { recipients: true } },
        template: { select: { id: true, name: true } },
        whatsappAccount: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const recipientStatsByStatus = await this.prisma.campaignRecipient.groupBy({
      by: ['campaignId', 'status'],
      where: {
        campaign: {
          workspaceId: workspace.id,
          ...(dto.campaignId ? { id: dto.campaignId } : {}),
        },
      },
      _count: { status: true },
    });

    const recipientMap = recipientStatsByStatus.reduce(
      (acc, row) => {
        if (!acc[row.campaignId]) acc[row.campaignId] = {};
        acc[row.campaignId][row.status] = row._count.status;
        return acc;
      },
      {} as Record<string, Record<string, number>>,
    );

    return campaigns.map((campaign) => ({
      ...campaign,
      recipientStats: recipientMap[campaign.id] ?? {},
    }));
  }

  async getAccountAnalytics(workspace: Workspace, dto: AnalyticsQueryDto) {
    const dateFilter = this.buildDateFilter(dto);

    const messagesByAccount = await this.prisma.messageLog.groupBy({
      by: ['whatsappAccountId', 'direction', 'status'],
      where: {
        workspaceId: workspace.id,
        whatsappAccountId: { not: null },
        ...(dto.accountId ? { whatsappAccountId: dto.accountId } : {}),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      _count: { id: true },
    });

    const accounts = await this.prisma.whatsappAccount.findMany({
      where: {
        workspaceId: workspace.id,
        ...(dto.accountId ? { id: dto.accountId } : {}),
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        status: true,
        healthScore: true,
        dailySendCount: true,
        monthlySendCount: true,
      },
    });

    const statsMap = messagesByAccount.reduce(
      (acc, row) => {
        const key = row.whatsappAccountId as string;
        if (!acc[key]) acc[key] = {};
        const label = `${row.direction}_${row.status}`;
        acc[key][label] = row._count.id;
        return acc;
      },
      {} as Record<string, Record<string, number>>,
    );

    return accounts.map((account) => ({
      ...account,
      messageStats: statsMap[account.id] ?? {},
    }));
  }

  async getContactAnalytics(workspace: Workspace, dto: AnalyticsQueryDto) {
    const dateFilter = this.buildDateFilter(dto);

    const [totalContacts, optedIn, optedOut, newContacts] = await Promise.all([
      this.prisma.contact.count({
        where: { workspaceId: workspace.id, deletedAt: null },
      }),
      this.prisma.contact.count({
        where: { workspaceId: workspace.id, deletedAt: null, optInStatus: true },
      }),
      this.prisma.contact.count({
        where: { workspaceId: workspace.id, deletedAt: null, optOutStatus: true },
      }),
      this.prisma.contact.count({
        where: {
          workspaceId: workspace.id,
          deletedAt: null,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
      }),
    ]);

    const contactsByLeadStage = await this.prisma.contact.groupBy({
      by: ['leadStage'],
      where: { workspaceId: workspace.id, deletedAt: null },
      _count: { id: true },
    });

    return {
      totalContacts,
      optedIn,
      optedOut,
      newContacts,
      byLeadStage: contactsByLeadStage.map((row) => ({
        stage: row.leadStage ?? 'unknown',
        count: row._count.id,
      })),
    };
  }

  async getMessageAnalytics(workspace: Workspace, dto: AnalyticsQueryDto) {
    const dateFilter = this.buildDateFilter(dto);

    const messagesByStatus = await this.prisma.messageLog.groupBy({
      by: ['status', 'direction'],
      where: {
        workspaceId: workspace.id,
        ...(dto.accountId ? { whatsappAccountId: dto.accountId } : {}),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
      },
      _count: { id: true },
    });

    const totals = {
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      received: 0,
      queued: 0,
    };

    const breakdown = messagesByStatus.map((row) => {
      const count = row._count.id;
      const key = row.status.toLowerCase() as keyof typeof totals;
      if (key in totals) {
        totals[key] += count;
      }
      return { status: row.status, direction: row.direction, count };
    });

    return { totals, breakdown };
  }
}
