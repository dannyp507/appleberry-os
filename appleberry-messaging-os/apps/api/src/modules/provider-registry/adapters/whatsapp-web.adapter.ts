import { Injectable } from '@nestjs/common';
import { ProviderType } from '@prisma/client';

import { WhatsappWebEngineService } from '../whatsapp-web-engine.service';
import { ProviderAdapter, ProviderContext, ProviderOperationResult } from '../provider.types';

@Injectable()
export class WhatsappWebAdapter implements ProviderAdapter {
  readonly providerType = ProviderType.WHATSAPP_WEB;

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
}
