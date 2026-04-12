import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Workspace } from '@prisma/client';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutorespondersService } from './autoresponders.service';
import { CreateAutoresponderDto } from './dto/create-autoresponder.dto';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('autoresponders')
export class AutorespondersController {
  constructor(private readonly autorespondersService: AutorespondersService) {}

  @Get()
  list(@CurrentWorkspace() workspace: Workspace) {
    return this.autorespondersService.list(workspace);
  }

  @Post()
  create(@CurrentWorkspace() workspace: Workspace, @Body() dto: CreateAutoresponderDto) {
    return this.autorespondersService.create(workspace, dto);
  }

  @Patch(':id')
  update(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAutoresponderDto>,
  ) {
    return this.autorespondersService.update(workspace, id, dto);
  }

  @Delete(':id')
  remove(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.autorespondersService.remove(workspace, id);
  }

  @Post(':id/toggle')
  toggle(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.autorespondersService.toggle(workspace, id);
  }
}
