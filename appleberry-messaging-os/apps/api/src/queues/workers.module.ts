import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../common/prisma/prisma.module';
import { ProviderRegistryModule } from '../modules/provider-registry/provider-registry.module';

import { CampaignDispatchProcessor } from './processors/campaign-dispatch.processor';
import { MessageSendProcessor } from './processors/message-send.processor';
import { MessageRetryProcessor } from './processors/message-retry.processor';
import { SessionMonitorProcessor } from './processors/session-monitor.processor';
import { AnalyticsRollupProcessor } from './processors/analytics-rollup.processor';
import { WebhookDeliveryProcessor } from './processors/webhook-delivery.processor';

@Module({
  imports: [
    // Register queues using @nestjs/bullmq patterns so InjectQueue works in processors
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('REDIS_URL'),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: 'campaign-dispatch' },
      { name: 'message-send' },
      { name: 'message-retry' },
      { name: 'provider-session-monitor' },
      { name: 'analytics-rollup' },
      { name: 'webhook-delivery' },
    ),
    PrismaModule,
    ProviderRegistryModule,
  ],
  providers: [
    CampaignDispatchProcessor,
    MessageSendProcessor,
    MessageRetryProcessor,
    SessionMonitorProcessor,
    AnalyticsRollupProcessor,
    WebhookDeliveryProcessor,
  ],
})
export class WorkersModule {}
