import { InboxThreadStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateThreadDto {
  @IsOptional()
  @IsEnum(InboxThreadStatus)
  status?: InboxThreadStatus;

  @IsOptional()
  @IsString()
  assignedUserId?: string | null;
}
