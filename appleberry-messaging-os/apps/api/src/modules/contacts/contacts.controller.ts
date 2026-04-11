import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { Workspace } from '@prisma/client';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateContactDto } from './dto/create-contact.dto';
import { ContactsService } from './contacts.service';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@CurrentWorkspace() workspace: Workspace) {
    return this.contactsService.list(workspace);
  }

  @Post()
  create(@CurrentWorkspace() workspace: Workspace, @Body() dto: CreateContactDto) {
    return this.contactsService.create(workspace, dto);
  }
}
