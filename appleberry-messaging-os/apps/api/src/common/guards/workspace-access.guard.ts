import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId: string } | undefined;
    const workspaceId = request.headers['x-workspace-id'];

    if (!user?.userId || typeof workspaceId !== 'string') {
      throw new ForbiddenException('Workspace access requires authentication and x-workspace-id');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        workspaceId,
        status: 'ACTIVE',
      },
      include: {
        workspace: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('No access to this workspace');
    }

    request.workspace = membership.workspace;
    request.membership = membership;
    return true;
  }
}
