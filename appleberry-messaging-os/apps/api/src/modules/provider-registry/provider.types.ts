import { ProviderType, SessionStatus, WhatsappAccountStatus } from '@prisma/client';

export type ProviderCredentials = Record<string, unknown>;

export type ProviderContext = {
  account: {
    id: string;
    name: string;
    providerType: ProviderType;
    phoneNumber: string | null;
    status: WhatsappAccountStatus;
    sessionStatus: SessionStatus;
  };
  credentials: ProviderCredentials;
};

export type ProviderOperationResult = {
  status: 'ok' | 'warning' | 'error' | 'queued';
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export interface ProviderAdapter {
  readonly providerType: ProviderType;
  verifyConnection(context: ProviderContext): Promise<ProviderOperationResult>;
  reconnect(context: ProviderContext): Promise<ProviderOperationResult>;
  resetSession(context: ProviderContext): Promise<ProviderOperationResult>;
  testSend(
    context: ProviderContext,
    payload?: { to?: string; message?: string },
  ): Promise<ProviderOperationResult>;
}
