import { Injectable, NotFoundException } from '@nestjs/common';
import { Workspace } from '@prisma/client';

import { toPrismaJson } from '../../common/prisma/json';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAutoresponderDto } from './dto/create-autoresponder.dto';

@Injectable()
export class AutorespondersService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspace: Workspace) {
    return this.prisma.autoresponderRule.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(workspace: Workspace, dto: CreateAutoresponderDto) {
    return this.prisma.autoresponderRule.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name,
        priority: dto.priority ?? 0,
        triggerConfig: toPrismaJson(dto.triggerConfig),
        actionConfig: toPrismaJson(dto.actionConfig),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(workspace: Workspace, id: string, dto: Partial<CreateAutoresponderDto>) {
    const rule = await this.prisma.autoresponderRule.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!rule) {
      throw new NotFoundException('Autoresponder not found');
    }

    return this.prisma.autoresponderRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.triggerConfig !== undefined ? { triggerConfig: toPrismaJson(dto.triggerConfig) } : {}),
        ...(dto.actionConfig !== undefined ? { actionConfig: toPrismaJson(dto.actionConfig) } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(workspace: Workspace, id: string) {
    const rule = await this.prisma.autoresponderRule.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!rule) {
      throw new NotFoundException('Autoresponder not found');
    }

    await this.prisma.autoresponderRule.delete({ where: { id } });
    return { message: 'Autoresponder deleted successfully' };
  }

  async toggle(workspace: Workspace, id: string) {
    const rule = await this.prisma.autoresponderRule.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!rule) {
      throw new NotFoundException('Autoresponder not found');
    }

    return this.prisma.autoresponderRule.update({
      where: { id },
      data: { isActive: !rule.isActive },
    });
  }
}
