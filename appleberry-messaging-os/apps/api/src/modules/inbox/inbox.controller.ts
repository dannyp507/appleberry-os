import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { Workspace } from '@prisma/client';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { AssignThreadDto } from './dto/assign-thread.dto';
import { ListThreadsDto } from './dto/list-threads.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { InboxService } from './inbox.service';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('inbox')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get('threads')
  listThreads(
    @CurrentWorkspace() workspace: Workspace,
    @Query() filters: ListThreadsDto,
  ) {
    return this.inboxService.listThreads(workspace, filters);
  }

  @Get('threads/:id')
  getThread(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
  ) {
    return this.inboxService.getThread(workspace, id);
  }

  @Patch('threads/:id')
  updateThread(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Body() dto: UpdateThreadDto,
  ) {
    return this.inboxService.updateThreadStatus(workspace, id, dto);
  }

  @Post('threads/:id/messages')
  sendMessage(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.inboxService.sendMessage(workspace, id, dto);
  }

  @Post('threads/:id/takeover')
  takeoverThread(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inboxService.takeoverThread(workspace, id, user.userId);
  }

  @Post('threads/:id/assign')
  assignThread(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Body() dto: AssignThreadDto,
  ) {
    return this.inboxService.assignThread(workspace, id, dto);
  }
}
