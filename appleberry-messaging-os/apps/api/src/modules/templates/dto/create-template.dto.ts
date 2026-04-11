import { TemplateStatus, TemplateType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEnum(TemplateType)
  type!: TemplateType;

  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;

  @IsObject()
  body!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  compatibility?: Record<string, unknown>;
}
