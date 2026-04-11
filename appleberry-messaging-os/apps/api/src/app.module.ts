import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { appConfig, validateEnv } from './config/env';
import { SecurityModule } from './common/security/security.module';
import { AuthModule } from './modules/auth/auth.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { FlowsModule } from './modules/flows/flows.module';
import { HealthModule } from './modules/health/health.module';
import { ProviderRegistryModule } from './modules/provider-registry/provider-registry.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { UsersModule } from './modules/users/users.module';
import { WhatsappAccountsModule } from './modules/whatsapp-accounts/whatsapp-accounts.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { QueueModule } from './queues/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      load: [appConfig],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    SecurityModule,
    PrismaModule,
    QueueModule,
    ProviderRegistryModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    WhatsappAccountsModule,
    ContactsModule,
    TemplatesModule,
    CampaignsModule,
    FlowsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
