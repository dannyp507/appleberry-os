import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { Workspace } from '@prisma/client';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  list(@CurrentWorkspace() workspace: Workspace) {
    return this.campaignsService.list(workspace);
  }

  @Post()
  create(@CurrentWorkspace() workspace: Workspace, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(workspace, dto);
  }
}
