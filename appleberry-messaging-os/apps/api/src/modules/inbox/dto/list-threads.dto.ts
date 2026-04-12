import { InboxThreadStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListThreadsDto {
  @IsOptional()
  @IsEnum(InboxThreadStatus)
  status?: InboxThreadStatus;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;
}
