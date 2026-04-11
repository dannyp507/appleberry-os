import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('v1'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  ENCRYPTION_KEY: z.string().min(16),
});

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV,
  port: Number(process.env.API_PORT ?? 4000),
  apiPrefix: process.env.API_PREFIX ?? 'v1',
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
}));
