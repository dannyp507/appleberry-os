import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { Workspace } from '@prisma/client';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFlowDto } from './dto/create-flow.dto';
import { ImportFlowDto } from './dto/import-flow.dto';
import { ToggleFlowAiDto } from './dto/toggle-flow-ai.dto';
import { UpdateFlowDto } from './dto/update-flow.dto';
import { FlowsService } from './flows.service';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('flows')
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get()
  list(@CurrentWorkspace() workspace: Workspace) {
    return this.flowsService.list(workspace);
  }

  @Post()
  create(@CurrentWorkspace() workspace: Workspace, @Body() dto: CreateFlowDto) {
    return this.flowsService.create(workspace, dto);
  }

  @Get(':id')
  detail(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.flowsService.getById(workspace, id);
  }

  @Patch(':id')
  update(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string, @Body() dto: UpdateFlowDto) {
    return this.flowsService.update(workspace, id, dto);
  }

  @Post('import')
  import(@CurrentWorkspace() workspace: Workspace, @Body() dto: ImportFlowDto) {
    return this.flowsService.importLegacyWorkflow(workspace, dto);
  }

  @Get(':id/export')
  export(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.flowsService.exportLegacyWorkflow(workspace, id);
  }

  @Patch(':id/ai')
  toggleAi(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string, @Body() dto: ToggleFlowAiDto) {
    return this.flowsService.toggleAiAssistant(workspace, id, dto);
  }

  @Delete(':id')
  remove(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.flowsService.remove(workspace, id);
  }
}
