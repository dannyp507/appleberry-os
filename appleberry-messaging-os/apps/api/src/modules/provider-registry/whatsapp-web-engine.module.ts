import { Module } from '@nestjs/common';

import { WhatsappWebEngineService } from './whatsapp-web-engine.service';

@Module({
  providers: [WhatsappWebEngineService],
  exports: [WhatsappWebEngineService],
})
export class WhatsappWebEngineModule {}
