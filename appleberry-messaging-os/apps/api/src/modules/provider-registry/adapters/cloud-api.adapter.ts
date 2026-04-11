import { Injectable } from '@nestjs/common';
import { ProviderType } from '@prisma/client';
import axios from 'axios';

import { ProviderAdapter, ProviderContext, ProviderOperationResult } from '../provider.types';

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
}
