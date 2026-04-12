import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Workspace } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspace: Workspace) {
    return this.prisma.apiKey.findMany({
      where: { workspaceId: workspace.id },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(workspace: Workspace, dto: CreateApiKeyDto, userId: string) {
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const prefix = `ab_live_${crypto.randomBytes(6).toString('hex')}`;
    const rawKey = `${prefix}_${rawSecret}`;
    const hashedKey = await argon2.hash(rawKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        workspaceId: workspace.id,
        userId,
        name: dto.name,
        keyPrefix: prefix,
        hashedKey,
        scopes: dto.scopes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      // Raw key returned only once at creation
      key: rawKey,
    };
  }

  async revoke(workspace: Workspace, id: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, workspaceId: workspace.id },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.delete({ where: { id } });

    return { message: 'API key revoked successfully' };
  }

  async validateKey(rawKey: string) {
    // Extract prefix from rawKey: format is `ab_live_<6hex>_<64hex>`
    const parts = rawKey.split('_');
    if (parts.length < 3) {
      throw new UnauthorizedException('Invalid API key format');
    }
    // Prefix is the first three segments: ab_live_<6hex>
    const prefix = parts.slice(0, 3).join('_');

    const apiKeys = await this.prisma.apiKey.findMany({
      where: { keyPrefix: prefix },
      include: {
        workspace: true,
        user: { select: { id: true, email: true, globalRole: true } },
      },
    });

    for (const apiKey of apiKeys) {
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        continue;
      }

      const valid = await argon2.verify(apiKey.hashedKey, rawKey);
      if (valid) {
        await this.prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        });
        return apiKey;
      }
    }

    throw new UnauthorizedException('Invalid or expired API key');
  }

  async getUsage(workspace: Workspace, id: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, workspaceId: workspace.id },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    return apiKey;
  }
}
