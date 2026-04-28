import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateConnectionConfigDto {
  @IsString()
  mode!: 'cloud_api' | 'whatsapp_web';

  @IsObject()
  credentials!: Record<string, string>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
