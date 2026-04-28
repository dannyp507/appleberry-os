import { Injectable, NotFoundException } from '@nestjs/common';
import { Workspace } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspace: Workspace) {
    return this.prisma.notification.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(workspace: Workspace, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(workspace: Workspace) {
    await this.prisma.notification.updateMany({
      where: { workspaceId: workspace.id, readAt: null },
      data: { readAt: new Date() },
    });

    return { message: 'All notifications marked as read' };
  }
}
