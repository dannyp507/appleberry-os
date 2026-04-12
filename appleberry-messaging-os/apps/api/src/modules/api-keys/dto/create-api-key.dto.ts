import { ApiKeyScope } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsArray()
  @IsEnum(ApiKeyScope, { each: true })
  scopes!: ApiKeyScope[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
