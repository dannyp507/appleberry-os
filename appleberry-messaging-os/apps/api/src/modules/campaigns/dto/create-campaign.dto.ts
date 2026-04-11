import { CampaignStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @MaxLength(140)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  whatsappAccountId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  status?: CampaignStatus;

  @IsOptional()
  @IsDateString()
  scheduleAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  accountRotation?: boolean;

  @IsOptional()
  @IsObject()
  sendWindowConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  throttlingConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  targetingConfig?: Record<string, unknown>;
}
