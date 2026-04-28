import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProviderType } from '@prisma/client';

export class CreateWhatsappAccountDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsEnum(ProviderType)
  providerType!: ProviderType;

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
