import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Workspace } from '@prisma/client';

import { CurrentWorkspace } from '../../common/decorators/current-workspace.decorator';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddGroupMembersDto } from './dto/add-group-members.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { CreateContactGroupDto } from './dto/create-contact-group.dto';
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

  // --- Contact Groups ---

  @Get('groups')
  listGroups(@CurrentWorkspace() workspace: Workspace) {
    return this.contactsService.listGroups(workspace);
  }

  @Post('groups')
  createGroup(@CurrentWorkspace() workspace: Workspace, @Body() dto: CreateContactGroupDto) {
    return this.contactsService.createGroup(workspace, dto);
  }

  @Post('groups/:id/members')
  addGroupMembers(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Body() dto: AddGroupMembersDto,
  ) {
    return this.contactsService.addGroupMembers(workspace, id, dto);
  }

  @Get('groups/:id/members')
  listGroupMembers(@CurrentWorkspace() workspace: Workspace, @Param('id') id: string) {
    return this.contactsService.listGroupMembers(workspace, id);
  }

  @Delete('groups/:id/members/:contactId')
  removeGroupMember(
    @CurrentWorkspace() workspace: Workspace,
    @Param('id') id: string,
    @Param('contactId') contactId: string,
  ) {
    return this.contactsService.removeGroupMember(workspace, id, contactId);
  }
}
