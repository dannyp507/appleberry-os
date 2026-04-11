import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProviderType, SessionStatus, WhatsappAccountStatus, Workspace } from '@prisma/client';

import { toPrismaJson } from '../../common/prisma/json';
import { EncryptionService } from '../../common/security/encryption.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProviderRegistryService } from '../provider-registry/provider-registry.service';
import { ProviderContext } from '../provider-registry/provider.types';
import { AccountActionDto } from './dto/account-action.dto';
import { AssignDefaultFlowDto } from './dto/assign-default-flow.dto';
import { CreateWhatsappAccountDto } from './dto/create-whatsapp-account.dto';
import { UpdateConnectionConfigDto } from './dto/update-connection-config.dto';
import { UpdateWhatsappAccountDto } from './dto/update-whatsapp-account.dto';

@Injectable()
export class WhatsappAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly providerRegistryService: ProviderRegistryService,
  ) {}

  list(workspace: Workspace) {
    return this.prisma.whatsappAccount
      .findMany({
        where: { workspaceId: workspace.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { sessions: true },
      })
      .then((accounts) => accounts.map((account) => this.serializeAccount(account)));
  }

  async create(workspace: Workspace, dto: CreateWhatsappAccountDto) {
    const account = await this.prisma.whatsappAccount.create({
      data: {
        workspaceId: workspace.id,
        name: dto.name,
        providerType: dto.providerType,
        phoneNumber: dto.phoneNumber,
        rateLimitConfig: dto.rateLimitConfig === undefined ? undefined : toPrismaJson(dto.rateLimitConfig),
        sendingPolicy: dto.sendingPolicy === undefined ? undefined : toPrismaJson(dto.sendingPolicy),
      },
    });

    return this.serializeAccount(account);
  }

  async getById(workspace: Workspace, id: string) {
    const account = await this.findAccountOrThrow(workspace, id);
    return this.serializeAccount(account);
  }

  async update(workspace: Workspace, id: string, dto: UpdateWhatsappAccountDto) {
    await this.getById(workspace, id);

    const account = await this.prisma.whatsappAccount.update({
      where: { id },
      data: {
        name: dto.name,
        phoneNumber: dto.phoneNumber,
        rateLimitConfig: dto.rateLimitConfig === undefined ? undefined : toPrismaJson(dto.rateLimitConfig),
        sendingPolicy: dto.sendingPolicy === undefined ? undefined : toPrismaJson(dto.sendingPolicy),
      },
    });

    return this.serializeAccount(account);
  }

  async runAction(workspace: Workspace, id: string, dto: AccountActionDto) {
    const account = await this.findAccountOrThrow(workspace, id);

    switch (dto.action) {
      case 'pause':
        return this.prisma.whatsappAccount.update({
          where: { id: account.id },
          data: { status: WhatsappAccountStatus.PAUSED },
        }).then((updated) => this.serializeAccount(updated));
      case 'activate':
        return this.prisma.whatsappAccount.update({
          where: { id: account.id },
          data: { status: WhatsappAccountStatus.ACTIVE },
        }).then((updated) => this.serializeAccount(updated));
      case 'archive':
        return this.prisma.whatsappAccount.update({
          where: { id: account.id },
          data: { status: WhatsappAccountStatus.ARCHIVED, deletedAt: new Date() },
        }).then((updated) => this.serializeAccount(updated));
      case 'reconnect':
        if (account.providerType === ProviderType.WHATSAPP_WEB) {
          await this.prisma.whatsappSession.create({
            data: {
              whatsappAccountId: account.id,
              status: SessionStatus.PENDING,
              qrCodeUrl: `appleberry://qr/${account.id}/${Date.now()}`,
            },
          });
        }
        return this.prisma.whatsappAccount.update({
          where: { id: account.id },
          data: { sessionStatus: SessionStatus.RECONNECTING, reconnectStatus: 'manual_reconnect_requested' },
        }).then(async (updated) => {
          const context = this.buildProviderContext(account);
          const result = await this.providerRegistryService.getAdapter(account.providerType).reconnect(context);
          return {
            account: this.serializeAccount(updated),
            operation: result,
          };
        });
      case 'reset-session':
        await this.prisma.whatsappSession.create({
          data: {
            whatsappAccountId: account.id,
            status: SessionStatus.PENDING,
            lastError: dto.note ?? 'Session reset requested by operator',
          },
        });
        return this.prisma.whatsappAccount.update({
          where: { id: account.id },
          data: { sessionStatus: SessionStatus.PENDING, reconnectStatus: 'session_reset_requested' },
        }).then(async (updated) => {
          const context = this.buildProviderContext(account);
          const result = await this.providerRegistryService.getAdapter(account.providerType).resetSession(context);
          return {
            account: this.serializeAccount(updated),
            operation: result,
          };
        });
      case 'verify-connection': {
        const context = this.buildProviderContext(account);
        const result = await this.providerRegistryService.getAdapter(account.providerType).verifyConnection(context);
        return {
          account: this.serializeAccount(account),
          operation: result,
        };
      }
      case 'test-send':
        return {
          account: this.serializeAccount(account),
          operation: await this.providerRegistryService.getAdapter(account.providerType).testSend(
            this.buildProviderContext(account),
            {
              to: dto.payload?.to,
              message: dto.payload?.message,
            },
          ),
        };
      default:
        return this.serializeAccount(account);
    }
  }

  async updateConnectionConfig(workspace: Workspace, id: string, dto: UpdateConnectionConfigDto) {
    const account = await this.findAccountOrThrow(workspace, id);

    const encryptedCredentials = this.encryptionService.encrypt(dto.credentials);
    const metadata = dto.metadata ?? {};

    const updated = await this.prisma.whatsappAccount.update({
      where: { id },
      data: {
        encryptedCredentials: toPrismaJson({
          providerMode: dto.mode,
          encryptedPayload: encryptedCredentials,
          configuredAt: new Date().toISOString(),
          metadata,
        }),
        webhookStatus: dto.mode === 'cloud_api' ? 'credentials_saved' : account.webhookStatus,
        sessionStatus: dto.mode === 'cloud_api' ? SessionStatus.CONNECTED : SessionStatus.PENDING,
        reconnectStatus: dto.mode === 'whatsapp_web' ? 'qr_ready' : 'credentials_saved',
        lastSyncAt: new Date(),
      },
      include: {
        sessions: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (dto.mode === 'whatsapp_web') {
      await this.prisma.whatsappSession.create({
        data: {
          whatsappAccountId: id,
          status: SessionStatus.PENDING,
          qrCodeUrl: `appleberry://qr/${id}/${Date.now()}`,
          lastError: 'Scan QR to complete bootstrap',
        },
      });

      const context = this.buildProviderContext({
        ...account,
        encryptedCredentials: {
          encryptedPayload: encryptedCredentials,
        },
      });

      await this.providerRegistryService.getAdapter(account.providerType).reconnect(context);
    }

    const hydrated = await this.prisma.whatsappAccount.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    return this.serializeAccount(hydrated ?? updated);
  }

  async assignDefaultFlow(workspace: Workspace, id: string, dto: AssignDefaultFlowDto) {
    const account = await this.findAccountOrThrow(workspace, id);
    const currentPolicy = this.asRecord(account.sendingPolicy);
    const nextEnabled = dto.enabled ?? true;

    let assignment: Record<string, unknown> | null = null;

    if (dto.flowId) {
      const flow = await this.prisma.chatbotFlow.findFirst({
        where: {
          id: dto.flowId,
          workspaceId: workspace.id,
        },
      });

      if (!flow) {
        throw new BadRequestException('Assigned flow was not found in this workspace');
      }

      assignment = {
        id: flow.id,
        name: flow.name,
        status: flow.status,
      };
    }

    const updated = await this.prisma.whatsappAccount.update({
      where: { id: account.id },
      data: {
        sendingPolicy: toPrismaJson({
          ...currentPolicy,
          chatbotAssignment: assignment,
          chatbotEnabled: assignment ? nextEnabled : false,
        }),
      },
      include: {
        sessions: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    return this.serializeAccount(updated);
  }

  private async findAccountOrThrow(workspace: Workspace, id: string) {
    const account = await this.prisma.whatsappAccount.findFirst({
      where: {
        id,
        workspaceId: workspace.id,
        deletedAt: null,
      },
      include: {
        sessions: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('WhatsApp account not found');
    }

    return account;
  }

  private buildProviderContext(account: any): ProviderContext {
    const encryptedPayload = account.encryptedCredentials?.encryptedPayload;
    const credentials =
      encryptedPayload && encryptedPayload.iv && encryptedPayload.tag && encryptedPayload.ciphertext
        ? this.encryptionService.decrypt(encryptedPayload)
        : {};

    return {
      account: {
        id: account.id,
        name: account.name,
        providerType: account.providerType,
        phoneNumber: account.phoneNumber,
        status: account.status,
        sessionStatus: account.sessionStatus,
      },
      credentials,
    };
  }

  private serializeAccount(account: any) {
    const capabilities = this.providerRegistryService.getCapabilities(account.providerType);
    const configuredCredentials = Boolean(account.encryptedCredentials?.encryptedPayload);
    const sendingPolicy = this.asRecord(account.sendingPolicy);
    const connectionSummary =
      account.providerType === ProviderType.CLOUD_API
        ? {
            mode: 'cloud_api',
            configured: configuredCredentials,
            fields: ['phoneNumberId', 'businessAccountId', 'accessToken', 'verifyToken'],
          }
        : {
            mode: 'whatsapp_web',
            configured: configuredCredentials,
            qrReady: account.reconnectStatus === 'qr_ready' || account.sessions?.some((session: any) => session.qrCodeUrl),
          };

    return {
      ...account,
      encryptedCredentials: undefined,
      sendingPolicy,
      defaultFlowAssignment: this.asRecord(sendingPolicy.chatbotAssignment),
      chatbotEnabled: Boolean(sendingPolicy.chatbotEnabled),
      capabilities,
      connectionSummary,
    };
  }

  private asRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
  }
}
