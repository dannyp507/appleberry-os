import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const QUEUE_NAMES = [
  'campaign-dispatch',
  'message-send',
  'message-retry',
  'provider-sync',
  'provider-session-monitor',
  'webhook-delivery',
  'contact-import',
  'contact-export',
  'analytics-rollup',
  'automation-runner',
  'flow-execution',
  'cleanup',
  'notifications',
] as const;

@Global()
@Module({
  providers: [
    {
      provide: 'QUEUE_CONNECTION',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new IORedis(config.getOrThrow<string>('REDIS_URL')),
    },
    ...QUEUE_NAMES.map((name) => ({
      provide: `QUEUE:${name}`,
      inject: ['QUEUE_CONNECTION'],
      useFactory: (connection: IORedis) => new Queue(name, { connection }),
    })),
  ],
  exports: ['QUEUE_CONNECTION', ...QUEUE_NAMES.map((name) => `QUEUE:${name}`)],
})
export class QueueModule {}
