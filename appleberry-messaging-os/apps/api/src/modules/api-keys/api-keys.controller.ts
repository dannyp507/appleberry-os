import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Workspace } from '@prisma/client';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/jwt.strategy';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  list(@CurrentWorkspace() workspace: Workspace) {
    return this.apiKeysService.list(workspace);
  }

  @Post()
  create(
    @CurrentWorkspace() workspace: Workspace,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(workspace, dto, user.userId);
  }

  @Delete(':id')
  revoke(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.apiKeysService.revoke(workspace, id);
  }

  @Get(':id/usage')
  getUsage(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.apiKeysService.getUsage(workspace, id);
  }
}
