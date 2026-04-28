import { Injectable } from '@nestjs/common';
import { Workspace } from '@prisma/client';

import { toPrismaJson } from '../../common/prisma/json';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspace: Workspace) {
    return this.prisma.template.findMany({
      where: { workspaceId: workspace.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  create(workspace: Workspace, dto: CreateTemplateDto) {
    return this.prisma.template.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name,
        type: dto.type,
        status: dto.status,
        body: toPrismaJson(dto.body),
        compatibility: dto.compatibility === undefined ? undefined : toPrismaJson(dto.compatibility),
      },
    });
  }
}
