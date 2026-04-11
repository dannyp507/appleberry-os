import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  listWorkspaces() {
    return this.prisma.workspace.findMany({
      include: {
        organization: true,
        memberships: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
