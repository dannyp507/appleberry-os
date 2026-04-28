import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import type { Workspace } from '@prisma/client';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentWorkspace() workspace: Workspace) {
    return this.notificationsService.list(workspace);
  }

  @Patch(':id/read')
  markRead(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.notificationsService.markRead(workspace, id);
  }

  @Patch('read-all')
  markAllRead(@CurrentWorkspace() workspace: Workspace) {
    return this.notificationsService.markAllRead(workspace);
  }
}
