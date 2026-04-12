import { Module } from '@nestjs/common';

import { AutorespondersController } from './autoresponders.controller';
import { AutorespondersService } from './autoresponders.service';

@Module({
  controllers: [AutorespondersController],
  providers: [AutorespondersService],
  exports: [AutorespondersService],
})
export class AutorespondersModule {}
