import { Injectable, Logger } from '@nestjs/common';
import { ProviderType } from '@prisma/client';

import { WhatsappWebEngineService } from '../whatsapp-web-engine.service';
import { ProviderAdapter, ProviderContext, ProviderOperationResult, SendMessagePayload } from '../provider.types';

@Injectable()
export class WhatsappWebAdapter implements ProviderAdapter {
  readonly providerType = ProviderType.WHATSAPP_WEB;
  private readonly logger = new Logger(WhatsappWebAdapter.name);

  constructor(private readonly whatsappWebEngineService: WhatsappWebEngineService) {}

  async verifyConnection(context: ProviderContext): Promise<ProviderOperationResult> {
    const snapshot = await this.whatsappWebEngineService.getSessionSnapshot(context.account.id);
    const status: ProviderOperationResult['status'] =
      context.account.sessionStatus === 'CONNECTED' ? 'ok' : 'warning';
    return {
      status,
      code: 'whatsapp_web_session_state',
      message:
        context.account.sessionStatus === 'CONNECTED'
          ? 'WhatsApp Web session is connected.'
          : 'WhatsApp Web session is not connected yet. Scan QR to complete bootstrap.',
      metadata: {
        sessionStatus: context.account.sessionStatus,
        activeInMemory: snapshot.isActiveInMemory,
        latestSession: snapshot.sessions[0] ?? null,
      },
    };
  }

  async reconnect(context: ProviderContext): Promise<ProviderOperationResult> {
    return this.whatsappWebEngineService.reconnect(context.account.id) as Promise<ProviderOperationResult>;
  }

  async resetSession(context: ProviderContext): Promise<ProviderOperationResult> {
    return this.whatsappWebEngineService.reset(context.account.id) as Promise<ProviderOperationResult>;
  }

  async testSend(
    context: ProviderContext,
    payload?: { to?: string; message?: string },
  ): Promise<ProviderOperationResult> {
    const snapshot = await this.whatsappWebEngineService.getSessionSnapshot(context.account.id);
    return {
      status: 'queued',
      code: 'whatsapp_web_test_send_pending_engine',
      message:
        context.account.sessionStatus === 'CONNECTED'
          ? 'WhatsApp Web session is connected. Outbound message dispatch hook is the next step.'
          : 'Session is not connected yet. Complete QR authentication before test sends.',
      metadata: {
        accountId: context.account.id,
        to: payload?.to ?? null,
        previewMessage: payload?.message ?? 'Appleberry Messaging OS test message',
        activeInMemory: snapshot.isActiveInMemory,
      },
    };
  }

  async sendMessage(context: ProviderContext, payload: SendMessagePayload): Promise<ProviderOperationResult> {
    if (context.account.sessionStatus !== 'CONNECTED') {
      return {
        status: 'error',
        code: 'session_not_connected',
        message: `WhatsApp Web session for account ${context.account.id} is not connected (status: ${context.account.sessionStatus}). Reconnect before sending.`,
        metadata: { sessionStatus: context.account.sessionStatus },
      };
    }

    const snapshot = await this.whatsappWebEngineService.getSessionSnapshot(context.account.id);

    if (!snapshot.isActiveInMemory) {
      return {
        status: 'error',
        code: 'session_not_in_memory',
        message: 'WhatsApp Web client is not active in memory. Bootstrap the session first.',
        metadata: { accountId: context.account.id },
      };
    }

    try {
      const client = this.whatsappWebEngineService.getActiveClient(context.account.id);

      if (!client) {
        return {
          status: 'error',
          code: 'client_not_found',
          message: 'WhatsApp Web client instance not found in memory.',
        };
      }

      const chatId = payload.to.includes('@c.us') ? payload.to : `${payload.to}@c.us`;
      let providerMessageId: string | undefined;

      switch (payload.type) {
        case 'text': {
          const msg = await client.sendMessage(chatId, payload.text ?? '');
          providerMessageId = msg?.id?.id;
          break;
        }

        case 'media': {
          const { MessageMedia } = await import('whatsapp-web.js');
          if (!payload.mediaUrl) {
            return {
              status: 'error',
              code: 'missing_media_url',
              message: 'mediaUrl is required for media messages.',
            };
          }
          const media = await MessageMedia.fromUrl(payload.mediaUrl);
          const msg = await client.sendMessage(chatId, media, {
            caption: payload.caption,
          });
          providerMessageId = msg?.id?.id;
          break;
        }

        case 'button': {
          // whatsapp-web.js uses Buttons for interactive button messages
          const { Buttons } = await import('whatsapp-web.js');
          const btnItems = (payload.buttons ?? []).map((b) => ({ body: b.title }));
          const btnMsg = new Buttons(payload.text ?? '', btnItems, '', '');
          const msg = await client.sendMessage(chatId, btnMsg);
          providerMessageId = msg?.id?.id;
          break;
        }

        case 'list': {
          const { List } = await import('whatsapp-web.js');
          const rows = (payload.buttons ?? []).map((b) => ({ id: b.id, title: b.title }));
          const listMsg = new List(payload.text ?? '', 'Select', [{ title: 'Options', rows }], '', '');
          const msg = await client.sendMessage(chatId, listMsg);
          providerMessageId = msg?.id?.id;
          break;
        }

        case 'template': {
          // WA Web does not support cloud templates; fall back to plain text
          const msg = await client.sendMessage(chatId, payload.text ?? payload.templateName ?? '');
          providerMessageId = msg?.id?.id;
          break;
        }

        default: {
          const msg = await client.sendMessage(chatId, payload.text ?? '');
          providerMessageId = msg?.id?.id;
        }
      }

      return {
        status: 'ok',
        code: 'whatsapp_web_message_sent',
        message: 'Message sent via WhatsApp Web session.',
        metadata: { providerMessageId: providerMessageId ?? null },
      };
    } catch (error: any) {
      this.logger.error(
        `WhatsApp Web sendMessage failed for account ${context.account.id}: ${String(error?.message ?? error)}`,
      );

      return {
        status: 'error',
        code: 'whatsapp_web_send_error',
        message: error?.message ?? 'WhatsApp Web sendMessage failed.',
        metadata: { errorStack: error?.stack ?? null },
      };
    }
  }
}
