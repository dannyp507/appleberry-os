import { FlowStatus } from '@prisma/client';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFlowDto {
  @IsString()
  @MaxLength(140)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: FlowStatus;

  @IsOptional()
  @IsBoolean()
  aiAssistantActive?: boolean;
}
