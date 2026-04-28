import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listTenants() {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { workspaces: true } },
        subscriptions: {
          include: { plan: true },
          orderBy: { periodEnd: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listWorkspaces() {
    return this.prisma.workspace.findMany({
      where: { deletedAt: null },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        _count: {
          select: {
            memberships: true,
            contacts: true,
            campaigns: true,
            whatsappAccounts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSystemHealth() {
    const [
      totalUsers,
      totalOrganizations,
      totalWorkspaces,
      totalContacts,
      totalMessages,
      totalCampaigns,
      activeWhatsappAccounts,
      openThreads,
      pendingImports,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.workspace.count({ where: { deletedAt: null } }),
      this.prisma.contact.count({ where: { deletedAt: null } }),
      this.prisma.messageLog.count(),
      this.prisma.campaign.count(),
      this.prisma.whatsappAccount.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.inboxThread.count({ where: { status: 'OPEN' } }),
      this.prisma.importJob.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: { connected: true },
      stats: {
        totalUsers,
        totalOrganizations,
        totalWorkspaces,
        totalContacts,
        totalMessages,
        totalCampaigns,
        activeWhatsappAccounts,
        openThreads,
        pendingImports,
      },
    };
  }

  async suspendWorkspace(id: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id } });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return this.prisma.workspace.update({
      where: { id },
      data: { status: WorkspaceStatus.SUSPENDED },
    });
  }

  async getUsage() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      messagesLast30Days,
      campaignsLast30Days,
      newContactsLast30Days,
      newUsersLast30Days,
      activeWorkspaces,
    ] = await Promise.all([
      this.prisma.messageLog.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.campaign.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.contact.count({
        where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null },
      }),
      this.prisma.workspace.count({
        where: { status: WorkspaceStatus.ACTIVE, deletedAt: null },
      }),
    ]);

    return {
      period: { from: thirtyDaysAgo.toISOString(), to: new Date().toISOString() },
      messagesLast30Days,
      campaignsLast30Days,
      newContactsLast30Days,
      newUsersLast30Days,
      activeWorkspaces,
    };
  }

  getAuditLogs(workspaceId?: string) {
    return this.prisma.auditLog.findMany({
      where: workspaceId ? { workspaceId } : {},
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        workspace: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
