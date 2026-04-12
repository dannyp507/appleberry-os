import { Injectable, NotFoundException } from '@nestjs/common';
import { InboxThreadStatus, MessageDirection, MessageStatus, Workspace } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AssignThreadDto } from './dto/assign-thread.dto';
import { ListThreadsDto } from './dto/list-threads.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  listThreads(workspace: Workspace, filters: ListThreadsDto) {
    return this.prisma.inboxThread.findMany({
      where: {
        workspaceId: workspace.id,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.assignedUserId ? { assignedUserId: filters.assignedUserId } : {}),
        ...(filters.unreadOnly ? { unreadCount: { gt: 0 } } : {}),
        ...(filters.contactId ? { contactId: filters.contactId } : {}),
        ...(filters.accountId ? { whatsappAccountId: filters.accountId } : {}),
      },
      include: {
        contact: true,
        assignedUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        whatsappAccount: { select: { id: true, name: true, phoneNumber: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
    });
  }

  async getThread(workspace: Workspace, id: string) {
    const thread = await this.prisma.inboxThread.findFirst({
      where: { id, workspaceId: workspace.id },
      include: {
        contact: true,
        assignedUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        whatsappAccount: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    // Reset unread count when viewing a thread
    if (thread.unreadCount > 0) {
      await this.prisma.inboxThread.update({
        where: { id },
        data: { unreadCount: 0 },
      });
    }

    return thread;
  }

  async updateThreadStatus(workspace: Workspace, id: string, dto: UpdateThreadDto) {
    const thread = await this.prisma.inboxThread.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return this.prisma.inboxThread.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.assignedUserId !== undefined ? { assignedUserId: dto.assignedUserId } : {}),
      },
      include: {
        contact: true,
        assignedUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async sendMessage(workspace: Workspace, id: string, dto: SendMessageDto) {
    const thread = await this.prisma.inboxThread.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const content: Record<string, unknown> = { type: dto.type };
    if (dto.text) content['text'] = dto.text;
    if (dto.media) content['media'] = dto.media;
    if (dto.templateId) content['templateId'] = dto.templateId;
    if (dto.templateVariables) content['templateVariables'] = dto.templateVariables;

    const message = await this.prisma.inboxMessage.create({
      data: {
        inboxThreadId: id,
        direction: MessageDirection.OUTBOUND,
        status: MessageStatus.QUEUED,
        content: content as any,
      },
    });

    await this.prisma.inboxThread.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  async takeoverThread(workspace: Workspace, id: string, agentId: string) {
    const thread = await this.prisma.inboxThread.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return this.prisma.inboxThread.update({
      where: { id },
      data: {
        assignedUserId: agentId,
        status: InboxThreadStatus.OPEN,
      },
      include: {
        contact: true,
        assignedUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async assignThread(workspace: Workspace, id: string, dto: AssignThreadDto) {
    const thread = await this.prisma.inboxThread.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return this.prisma.inboxThread.update({
      where: { id },
      data: { assignedUserId: dto.assignedUserId },
      include: {
        contact: true,
        assignedUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }
}
