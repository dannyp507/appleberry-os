import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { Workspace } from '@prisma/client';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTemplateDto } from './dto/create-template.dto';
import { TemplatesService } from './templates.service';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  list(@CurrentWorkspace() workspace: Workspace) {
    return this.templatesService.list(workspace);
  }

  @Post()
  create(@CurrentWorkspace() workspace: Workspace, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(workspace, dto);
  }
}
