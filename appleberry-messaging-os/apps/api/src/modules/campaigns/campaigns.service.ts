import { Injectable } from '@nestjs/common';
import { CampaignStatus, Workspace } from '@prisma/client';

import { toPrismaJson } from '../../common/prisma/json';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
