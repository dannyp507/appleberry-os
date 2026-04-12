import { Injectable, NotFoundException } from '@nestjs/common';
import { Workspace } from '@prisma/client';

import { toPrismaJson } from '../../common/prisma/json';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AddGroupMembersDto } from './dto/add-group-members.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { CreateContactGroupDto } from './dto/create-contact-group.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspace: Workspace) {
    return this.prisma.contact.findMany({
      where: { workspaceId: workspace.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  create(workspace: Workspace, dto: CreateContactDto) {
    return this.prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        firstName: dto.firstName,
        lastName: dto.lastName,
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber,
        email: dto.email,
        city: dto.city,
        notes: dto.notes,
        optInStatus: dto.optInStatus ?? false,
      },
    });
  }

  // --- Contact Groups ---

  listGroups(workspace: Workspace) {
    return this.prisma.contactGroup.findMany({
      where: { workspaceId: workspace.id },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createGroup(workspace: Workspace, dto: CreateContactGroupDto) {
    return this.prisma.contactGroup.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name,
        description: dto.description,
        isDynamic: dto.isDynamic ?? false,
        dynamicFilter: dto.dynamicFilter ? toPrismaJson(dto.dynamicFilter) : undefined,
      },
    });
  }

  async addGroupMembers(workspace: Workspace, groupId: string, dto: AddGroupMembersDto) {
    const group = await this.prisma.contactGroup.findFirst({
      where: { id: groupId, workspaceId: workspace.id },
    });

    if (!group) {
      throw new NotFoundException('Contact group not found');
    }

    // Verify contacts belong to workspace
    const contacts = await this.prisma.contact.findMany({
      where: {
        id: { in: dto.contactIds },
        workspaceId: workspace.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    const validIds = contacts.map((c) => c.id);

    await this.prisma.contactGroupMember.createMany({
      data: validIds.map((contactId) => ({ contactId, contactGroupId: groupId })),
      skipDuplicates: true,
    });

    return this.prisma.contactGroup.findUnique({
      where: { id: groupId },
      include: { _count: { select: { members: true } } },
    });
  }

  async listGroupMembers(workspace: Workspace, groupId: string) {
    const group = await this.prisma.contactGroup.findFirst({
      where: { id: groupId, workspaceId: workspace.id },
    });

    if (!group) {
      throw new NotFoundException('Contact group not found');
    }

    return this.prisma.contactGroupMember.findMany({
      where: { contactGroupId: groupId },
      include: {
        contact: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeGroupMember(workspace: Workspace, groupId: string, contactId: string) {
    const group = await this.prisma.contactGroup.findFirst({
      where: { id: groupId, workspaceId: workspace.id },
    });

    if (!group) {
      throw new NotFoundException('Contact group not found');
    }

    const member = await this.prisma.contactGroupMember.findUnique({
      where: { contactId_contactGroupId: { contactId, contactGroupId: groupId } },
    });

    if (!member) {
      throw new NotFoundException('Contact is not a member of this group');
    }

    await this.prisma.contactGroupMember.delete({
      where: { contactId_contactGroupId: { contactId, contactGroupId: groupId } },
    });

    return { message: 'Contact removed from group' };
  }
}
