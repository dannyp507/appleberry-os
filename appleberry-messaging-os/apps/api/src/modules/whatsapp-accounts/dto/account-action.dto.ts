import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class AccountActionDto {
  @IsString()
  @IsIn(['pause', 'activate', 'archive', 'reconnect', 'reset-session', 'test-send', 'verify-connection'])
  action!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, string>;
}
