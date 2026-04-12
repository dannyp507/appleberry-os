import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId: string } | undefined;

    if (!user?.userId) {
      throw new ForbiddenException('Authentication required');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { globalRole: true, isPlatformOwner: true },
    });

    if (!dbUser) {
      throw new ForbiddenException('User not found');
    }

    if (dbUser.isPlatformOwner || dbUser.globalRole === 'SUPER_ADMIN') {
      return true;
    }

    throw new ForbiddenException('Super admin access required');
  }
}
