import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './guards/super-admin.guard';

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('tenants')
  listTenants() {
    return this.adminService.listTenants();
  }

  @Get('workspaces')
  listWorkspaces() {
    return this.adminService.listWorkspaces();
  }

  @Get('system-health')
  getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Patch('workspaces/:id/suspend')
  suspendWorkspace(@Param('id') id: string) {
    return this.adminService.suspendWorkspace(id);
  }

  @Get('usage')
  getUsage() {
    return this.adminService.getUsage();
  }

  @Get('audit-logs')
  getAuditLogs(@Query('workspaceId') workspaceId?: string) {
    return this.adminService.getAuditLogs(workspaceId);
  }
}
