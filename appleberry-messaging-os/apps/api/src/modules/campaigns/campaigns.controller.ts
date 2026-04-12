import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Workspace } from '@prisma/client';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import { AddRecipientsDto } from './dto/add-recipients.dto';
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

  @Get(':id')
  get(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.campaignsService.get(workspace, id);
  }

  @Post(':id/launch')
  launch(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.campaignsService.launch(workspace, id);
  }

  @Post(':id/pause')
  pause(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.campaignsService.pause(workspace, id);
  }

  @Post(':id/resume')
  resume(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.campaignsService.resume(workspace, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.campaignsService.cancel(workspace, id);
  }

  @Post(':id/recipients')
  addRecipients(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Body() dto: AddRecipientsDto,
  ) {
    return this.campaignsService.addRecipients(workspace, id, dto);
  }
}
