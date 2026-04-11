import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProviderType } from '@prisma/client';

export class UpdateWhatsappAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(ProviderType)
  providerType?: ProviderType;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsObject()
  rateLimitConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  sendingPolicy?: Record<string, unknown>;
}
