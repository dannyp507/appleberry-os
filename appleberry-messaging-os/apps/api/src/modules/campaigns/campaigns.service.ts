import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus, Workspace } from '@prisma/client';
import { Queue } from 'bullmq';

import { toPrismaJson } from '../../common/prisma/json';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AddRecipientsDto } from './dto/add-recipients.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('QUEUE:campaign-dispatch') private readonly campaignDispatchQueue: Queue,
  ) {}

  list(workspace: Workspace) {
    return this.prisma.campaign.findMany({
      where: { workspaceId: workspace.id },
      include: {
        whatsappAccount: true,
        template: true,
        _count: { select: { recipients: true, events: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async get(workspace: Workspace, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId: workspace.id },
      include: {
        whatsappAccount: true,
        template: true,
        _count: { select: { recipients: true, events: true } },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const recipientStatsByStatus = await this.prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: { status: true },
    });

    const recipientStats = recipientStatsByStatus.reduce(
      (acc, row) => {
        acc[row.status] = row._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );

    return { ...campaign, recipientStats };
  }

  create(workspace: Workspace, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name,
        description: dto.description,
        whatsappAccountId: dto.whatsappAccountId,
        templateId: dto.templateId,
        status: dto.status ?? CampaignStatus.DRAFT,
        scheduleAt: dto.scheduleAt ? new Date(dto.scheduleAt) : undefined,
        timezone: dto.timezone,
        accountRotation: dto.accountRotation ?? false,
        sendWindowConfig: dto.sendWindowConfig === undefined ? undefined : toPrismaJson(dto.sendWindowConfig),
        throttlingConfig: dto.throttlingConfig === undefined ? undefined : toPrismaJson(dto.throttlingConfig),
        targetingConfig: dto.targetingConfig === undefined ? undefined : toPrismaJson(dto.targetingConfig),
      },
    });
  }

  async launch(workspace: Workspace, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.RUNNING },
    });

    await this.campaignDispatchQueue.add(
      'dispatch',
      { campaignId: id, workspaceId: workspace.id },
      { jobId: `campaign-dispatch-${id}`, removeOnComplete: true },
    );

    return updated;
  }

  async pause(workspace: Workspace, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.PAUSED },
    });
  }

  async resume(workspace: Workspace, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.RUNNING },
    });

    await this.campaignDispatchQueue.add(
      'dispatch',
      { campaignId: id, workspaceId: workspace.id },
      { jobId: `campaign-resume-${id}-${Date.now()}`, removeOnComplete: true },
    );

    return updated;
  }

  async cancel(workspace: Workspace, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.CANCELLED },
    });
  }

  async addRecipients(workspace: Workspace, id: string, dto: AddRecipientsDto) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const contactIds = new Set<string>(dto.contactIds ?? []);

    // Expand contact group memberships
    if (dto.contactGroupIds && dto.contactGroupIds.length > 0) {
      const groupMembers = await this.prisma.contactGroupMember.findMany({
        where: {
          contactGroupId: { in: dto.contactGroupIds },
          contact: { workspaceId: workspace.id, deletedAt: null },
        },
        select: { contactId: true },
      });
      groupMembers.forEach((m) => contactIds.add(m.contactId));
    }

    if (contactIds.size === 0) {
      return { added: 0 };
    }

    const result = await this.prisma.campaignRecipient.createMany({
      data: [...contactIds].map((contactId) => ({
        campaignId: id,
        contactId,
        status: 'PENDING' as const,
      })),
      skipDuplicates: true,
    });

    return { added: result.count };
  }
}
