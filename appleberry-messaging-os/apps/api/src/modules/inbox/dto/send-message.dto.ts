import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum InboxMessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  DOCUMENT = 'DOCUMENT',
  TEMPLATE = 'TEMPLATE',
}

export class SendMessageDto {
  @IsEnum(InboxMessageType)
  type!: InboxMessageType;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsObject()
  media?: {
    url: string;
    mimeType?: string;
    caption?: string;
    filename?: string;
  };

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, string>;
}
