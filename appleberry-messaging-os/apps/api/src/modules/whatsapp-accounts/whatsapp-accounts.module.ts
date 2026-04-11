import { Module } from '@nestjs/common';

import { ProviderRegistryModule } from '../provider-registry/provider-registry.module';
import { WhatsappAccountsController } from './whatsapp-accounts.controller';
import { WhatsappAccountsService } from './whatsapp-accounts.service';

@Module({
  imports: [ProviderRegistryModule],
  controllers: [WhatsappAccountsController],
  providers: [WhatsappAccountsService],
})
export class WhatsappAccountsModule {}
