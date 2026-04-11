import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionStatus } from '@prisma/client';
import QRCode from 'qrcode';

import { PrismaService } from '../../common/prisma/prisma.service';

type ActiveClient = {
  client: any;
  accountId: string;
};

@Injectable()
export class WhatsappWebEngineService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsappWebEngineService.name);
  private readonly activeClients = new Map<string, ActiveClient>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleDestroy() {
    await Promise.all(
      [...this.activeClients.values()].map(async ({ client }) => {
        if (client?.destroy) {
          await client.destroy();
        }
      }),
    );
  }

  async bootstrap(accountId: string, options?: { clientId?: string; deviceName?: string; sessionLabel?: string }) {
    const client = await this.createClient(accountId, options);
    this.activeClients.set(accountId, { client, accountId });
    await client.initialize();

    return {
      status: 'queued',
      code: 'whatsapp_web_bootstrap_started',
      message: 'WhatsApp Web bootstrap started. Await QR emission.',
    };
  }

  async reconnect(accountId: string) {
    const existing = this.activeClients.get(accountId);
    if (existing?.client?.initialize) {
      await existing.client.initialize();
      return {
        status: 'queued',
        code: 'whatsapp_web_reconnect_started',
        message: 'Reconnect requested for active WhatsApp Web client.',
      };
    }

    return this.bootstrap(accountId, { clientId: `account-${accountId}` });
  }

  async reset(accountId: string) {
    const existing = this.activeClients.get(accountId);
    if (existing?.client?.logout) {
      try {
        await existing.client.logout();
      } catch (error) {
        this.logger.warn(`Logout failed for ${accountId}: ${String(error)}`);
      }
    }

    if (existing?.client?.destroy) {
      await existing.client.destroy();
      this.activeClients.delete(accountId);
    }

    await this.prisma.whatsappSession.create({
      data: {
        whatsappAccountId: accountId,
        status: SessionStatus.PENDING,
        lastError: 'Session reset requested. Awaiting new QR bootstrap.',
      },
    });

    return this.bootstrap(accountId, { clientId: `account-${accountId}` });
  }

  async getSessionSnapshot(accountId: string) {
    const sessions = await this.prisma.whatsappSession.findMany({
      where: { whatsappAccountId: accountId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    return {
      isActiveInMemory: this.activeClients.has(accountId),
      sessions,
    };
  }

  private async createClient(accountId: string, options?: { clientId?: string; deviceName?: string; sessionLabel?: string }) {
    const imported = await import('whatsapp-web.js');
    const { Client, LocalAuth } = imported;
    const sessionRoot = this.config.get<string>('WHATSAPP_WEB_SESSION_ROOT') ?? '.appleberry-wa-web';
    const executablePath = this.config.get<string>('CHROME_EXECUTABLE_PATH');

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: options?.clientId ?? `account-${accountId}`,
        dataPath: sessionRoot,
      }),
      puppeteer: {
        executablePath: executablePath || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    client.on('qr', async (qr: string) => {
      const qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 240 });
      await this.prisma.whatsappSession.create({
        data: {
          whatsappAccountId: accountId,
          status: SessionStatus.PENDING,
          qrCodeUrl: qrDataUrl,
          lastError: 'Scan QR to connect WhatsApp Web session',
        },
      });

      await this.prisma.whatsappAccount.update({
        where: { id: accountId },
        data: {
          sessionStatus: SessionStatus.PENDING,
          reconnectStatus: 'qr_generated',
        },
      });
    });

    client.on('authenticated', async () => {
      await this.prisma.whatsappAccount.update({
        where: { id: accountId },
        data: {
          sessionStatus: SessionStatus.CONNECTED,
          reconnectStatus: 'authenticated',
          lastSyncAt: new Date(),
        },
      });
    });

    client.on('ready', async () => {
      await this.prisma.whatsappSession.create({
        data: {
          whatsappAccountId: accountId,
          status: SessionStatus.CONNECTED,
          lastHeartbeatAt: new Date(),
        },
      });
      await this.prisma.whatsappAccount.update({
        where: { id: accountId },
        data: {
          sessionStatus: SessionStatus.CONNECTED,
          reconnectStatus: 'ready',
          lastSyncAt: new Date(),
        },
      });
    });

    client.on('auth_failure', async (message: string) => {
      await this.prisma.whatsappSession.create({
        data: {
          whatsappAccountId: accountId,
          status: SessionStatus.EXPIRED,
          lastError: message,
        },
      });
      await this.prisma.whatsappAccount.update({
        where: { id: accountId },
        data: {
          sessionStatus: SessionStatus.EXPIRED,
          reconnectStatus: 'auth_failure',
        },
      });
    });

    client.on('disconnected', async (reason: string) => {
      await this.prisma.whatsappSession.create({
        data: {
          whatsappAccountId: accountId,
          status: SessionStatus.DISCONNECTED,
          lastError: reason,
        },
      });
      await this.prisma.whatsappAccount.update({
        where: { id: accountId },
        data: {
          sessionStatus: SessionStatus.DISCONNECTED,
          reconnectStatus: reason,
        },
      });
    });

    client.on('change_state', async (state: string) => {
      await this.prisma.whatsappSession.create({
        data: {
          whatsappAccountId: accountId,
          status: SessionStatus.CONNECTED,
          lastHeartbeatAt: new Date(),
          lastError: `State changed: ${state}`,
        },
      });
    });

    return client;
  }
}
