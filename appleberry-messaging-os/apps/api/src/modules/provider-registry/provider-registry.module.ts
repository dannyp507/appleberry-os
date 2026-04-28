import { Module } from '@nestjs/common';

import { CloudApiAdapter } from './adapters/cloud-api.adapter';
import { ProviderRegistryService } from './provider-registry.service';
import { WhatsappWebAdapter } from './adapters/whatsapp-web.adapter';
import { WhatsappWebEngineModule } from './whatsapp-web-engine.module';

@Module({
  imports: [WhatsappWebEngineModule],
  providers: [ProviderRegistryService, CloudApiAdapter, WhatsappWebAdapter],
  exports: [ProviderRegistryService],
})
export class ProviderRegistryModule {}
