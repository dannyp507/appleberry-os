import { Injectable } from '@nestjs/common';
import { ProviderType } from '@prisma/client';

import { CloudApiAdapter } from './adapters/cloud-api.adapter';
import { WhatsappWebAdapter } from './adapters/whatsapp-web.adapter';
import { ProviderAdapter } from './provider.types';

type ProviderCapability = {
  supportsQrLogin: boolean;
  supportsMedia: boolean;
  supportsInteractiveTemplates: boolean;
  supportsGroups: boolean;
};

@Injectable()
export class ProviderRegistryService {
  constructor(
    private readonly cloudApiAdapter: CloudApiAdapter,
    private readonly whatsappWebAdapter: WhatsappWebAdapter,
  ) {}

  getCapabilities(providerType: ProviderType): ProviderCapability {
    switch (providerType) {
      case ProviderType.CLOUD_API:
        return {
          supportsQrLogin: false,
          supportsMedia: true,
          supportsInteractiveTemplates: true,
          supportsGroups: false,
        };
      case ProviderType.WHATSAPP_WEB:
        return {
          supportsQrLogin: true,
          supportsMedia: true,
          supportsInteractiveTemplates: false,
          supportsGroups: true,
        };
      default:
        return {
          supportsQrLogin: false,
          supportsMedia: false,
          supportsInteractiveTemplates: false,
          supportsGroups: false,
        };
    }
  }

  getAdapter(providerType: ProviderType): ProviderAdapter {
    switch (providerType) {
      case ProviderType.CLOUD_API:
        return this.cloudApiAdapter;
      case ProviderType.WHATSAPP_WEB:
        return this.whatsappWebAdapter;
      default:
        return this.cloudApiAdapter;
    }
  }
}
