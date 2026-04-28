import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard';
import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { AccountActionDto } from './dto/account-action.dto';
import { AssignDefaultFlowDto } from './dto/assign-default-flow.dto';
import { CreateWhatsappAccountDto } from './dto/create-whatsapp-account.dto';
import { UpdateConnectionConfigDto } from './dto/update-connection-config.dto';
import { UpdateWhatsappAccountDto } from './dto/update-whatsapp-account.dto';
import { WhatsappAccountsService } from './whatsapp-accounts.service';
import type { Workspace } from '@prisma/client';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('whatsapp-accounts')
export class WhatsappAccountsController {
  constructor(private readonly whatsappAccountsService: WhatsappAccountsService) {}

  @Get()
  list(@CurrentWorkspace() workspace: Workspace) {
    return this.whatsappAccountsService.list(workspace);
  }

  @Post()
  create(@CurrentWorkspace() workspace: Workspace, @Body() dto: CreateWhatsappAccountDto) {
    return this.whatsappAccountsService.create(workspace, dto);
  }

  @Get(':id')
  detail(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.whatsappAccountsService.getById(workspace, id);
  }

  @Patch(':id')
  update(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string, @Body() dto: UpdateWhatsappAccountDto) {
    return this.whatsappAccountsService.update(workspace, id, dto);
  }

  @Post(':id/actions')
  action(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string, @Body() dto: AccountActionDto) {
    return this.whatsappAccountsService.runAction(workspace, id, dto);
  }

  @Post(':id/connection-config')
  updateConnectionConfig(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Body() dto: UpdateConnectionConfigDto,
  ) {
    return this.whatsappAccountsService.updateConnectionConfig(workspace, id, dto);
  }

  @Post(':id/default-flow')
  assignDefaultFlow(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Body() dto: AssignDefaultFlowDto,
  ) {
    return this.whatsappAccountsService.assignDefaultFlow(workspace, id, dto);
  }
}
