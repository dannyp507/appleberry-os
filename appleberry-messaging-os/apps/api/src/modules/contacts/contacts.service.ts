import { Injectable } from '@nestjs/common';
import { Workspace } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';

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
}
