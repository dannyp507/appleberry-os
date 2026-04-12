import { Injectable } from '@nestjs/common';
import { ProviderType } from '@prisma/client';
import axios from 'axios';

import { ProviderAdapter, ProviderContext, ProviderOperationResult, SendMessagePayload } from '../provider.types';

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

@Injectable()
export class CloudApiAdapter implements ProviderAdapter {
  readonly providerType = ProviderType.CLOUD_API;

  async verifyConnection(context: ProviderContext): Promise<ProviderOperationResult> {
    const accessToken = String(context.credentials.accessToken ?? '');
    const phoneNumberId = String(context.credentials.phoneNumberId ?? '');

    if (!accessToken || !phoneNumberId) {
      return {
        status: 'error',
        code: 'missing_credentials',
        message: 'Cloud API credentials are incomplete.',
      };
    }

    try {
      const response = await axios.get(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 10_000,
      });

      return {
        status: 'ok',
        code: 'cloud_api_verified',
        message: 'Cloud API credentials verified successfully.',
        metadata: {
          graphResponse: response.data,
        },
      };
    } catch (error: any) {
      return {
        status: 'error',
        code: 'cloud_api_verify_failed',
        message: error?.response?.data?.error?.message ?? 'Unable to verify Cloud API credentials.',
      };
    }
  }

  async reconnect(): Promise<ProviderOperationResult> {
    return {
      status: 'warning',
      code: 'cloud_api_reconnect_not_required',
      message: 'Cloud API accounts do not use QR reconnect flows.',
    };
  }

  async resetSession(): Promise<ProviderOperationResult> {
    return {
      status: 'warning',
      code: 'cloud_api_session_reset_not_required',
      message: 'Cloud API accounts do not maintain browser sessions.',
    };
  }

  async testSend(
    context: ProviderContext,
    payload?: { to?: string; message?: string },
  ): Promise<ProviderOperationResult> {
    const accessToken = String(context.credentials.accessToken ?? '');
    const phoneNumberId = String(context.credentials.phoneNumberId ?? '');
    const to = payload?.to;

    if (!accessToken || !phoneNumberId || !to) {
      return {
        status: 'error',
        code: 'missing_test_send_fields',
        message: 'Test send requires access token, phone number ID, and a destination number.',
      };
    }

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: {
            body: payload?.message ?? 'Appleberry Messaging OS test message',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10_000,
        },
      );

      return {
        status: 'ok',
        code: 'cloud_api_test_sent',
        message: 'Cloud API test message accepted by provider.',
        metadata: {
          providerResponse: response.data,
        },
      };
    } catch (error: any) {
      return {
        status: 'error',
        code: 'cloud_api_test_send_failed',
        message: error?.response?.data?.error?.message ?? 'Cloud API test send failed.',
      };
    }
  }

  async sendMessage(context: ProviderContext, payload: SendMessagePayload): Promise<ProviderOperationResult> {
    const accessToken = String(context.credentials.accessToken ?? '');
    const phoneNumberId = String(context.credentials.phoneNumberId ?? '');

    if (!accessToken || !phoneNumberId) {
      return {
        status: 'error',
        code: 'missing_credentials',
        message: 'Cloud API credentials are incomplete for sendMessage.',
      };
    }

    if (!payload.to) {
      return {
        status: 'error',
        code: 'missing_recipient',
        message: 'sendMessage requires a recipient phone number.',
      };
    }

    const body = this.buildMessageBody(payload);

    try {
      const response = await axios.post(
        `${GRAPH_BASE}/${phoneNumberId}/messages`,
        body,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15_000,
        },
      );

      const providerMessageId: string = response.data?.messages?.[0]?.id ?? '';

      return {
        status: 'ok',
        code: 'cloud_api_message_sent',
        message: 'Message accepted by WhatsApp Cloud API.',
        metadata: {
          providerMessageId,
          providerResponse: response.data,
        },
      };
    } catch (error: any) {
      const errorCode: string = String(error?.response?.data?.error?.code ?? 'unknown');
      const errorMessage: string =
        error?.response?.data?.error?.message ?? 'Cloud API sendMessage failed.';

      return {
        status: 'error',
        code: `cloud_api_send_error_${errorCode}`,
        message: errorMessage,
        metadata: {
          errorDetails: error?.response?.data ?? null,
        },
      };
    }
  }

  private buildMessageBody(payload: SendMessagePayload): Record<string, unknown> {
    const base: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: payload.to,
    };

    switch (payload.type) {
      case 'text':
        return {
          ...base,
          type: 'text',
          text: { body: payload.text ?? '' },
        };

      case 'media': {
        const mediaTypeMap: Record<string, string> = {
          'image/jpeg': 'image',
          'image/png': 'image',
          'image/webp': 'image',
          'video/mp4': 'video',
          'audio/mpeg': 'audio',
          'audio/ogg': 'audio',
          'application/pdf': 'document',
        };
        const mediaCategory = mediaTypeMap[payload.mediaType ?? ''] ?? 'document';
        const mediaObject: Record<string, string> = { link: payload.mediaUrl ?? '' };
        if (payload.caption) {
          mediaObject.caption = payload.caption;
        }
        return {
          ...base,
          type: mediaCategory,
          [mediaCategory]: mediaObject,
        };
      }

      case 'button':
        return {
          ...base,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: payload.text ?? '' },
            action: {
              buttons: (payload.buttons ?? []).map((btn) => ({
                type: 'reply',
                reply: { id: btn.id, title: btn.title },
              })),
            },
          },
        };

      case 'list':
        return {
          ...base,
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: payload.text ?? '' },
            action: {
              button: 'Select',
              sections: [
                {
                  title: 'Options',
                  rows: (payload.buttons ?? []).map((btn) => ({
                    id: btn.id,
                    title: btn.title,
                  })),
                },
              ],
            },
          },
        };

      case 'template':
        return {
          ...base,
          type: 'template',
          template: {
            name: payload.templateName ?? '',
            language: { code: 'en_US' },
            components: (payload.templateParams ?? []).length > 0
              ? [
                  {
                    type: 'body',
                    parameters: (payload.templateParams ?? []).map((p) => ({
                      type: 'text',
                      text: p,
                    })),
                  },
                ]
              : [],
          },
        };

      default:
        return {
          ...base,
          type: 'text',
          text: { body: payload.text ?? '' },
        };
    }
  }
}
