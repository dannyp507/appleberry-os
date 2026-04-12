import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { Workspace } from '@prisma/client';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(@CurrentWorkspace() workspace: Workspace, @Query() dto: AnalyticsQueryDto) {
    return this.analyticsService.getOverview(workspace, dto);
  }

  @Get('campaigns')
  getCampaignAnalytics(@CurrentWorkspace() workspace: Workspace, @Query() dto: AnalyticsQueryDto) {
    return this.analyticsService.getCampaignAnalytics(workspace, dto);
  }

  @Get('accounts')
  getAccountAnalytics(@CurrentWorkspace() workspace: Workspace, @Query() dto: AnalyticsQueryDto) {
    return this.analyticsService.getAccountAnalytics(workspace, dto);
  }

  @Get('contacts')
  getContactAnalytics(@CurrentWorkspace() workspace: Workspace, @Query() dto: AnalyticsQueryDto) {
    return this.analyticsService.getContactAnalytics(workspace, dto);
  }

  @Get('messages')
  getMessageAnalytics(@CurrentWorkspace() workspace: Workspace, @Query() dto: AnalyticsQueryDto) {
    return this.analyticsService.getMessageAnalytics(workspace, dto);
  }
}
