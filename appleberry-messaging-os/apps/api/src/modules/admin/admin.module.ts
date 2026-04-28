import { Module } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Module({
  controllers: [AdminController],
  providers: [AdminService, SuperAdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
