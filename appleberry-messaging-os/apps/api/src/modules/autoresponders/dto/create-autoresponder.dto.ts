import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAutoresponderDto {
  @IsString()
  @MaxLength(140)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsObject()
  triggerConfig!: {
    type: 'KEYWORD' | 'INBOUND' | 'OPT_IN' | 'OPT_OUT' | 'NEW_CONTACT' | 'SCHEDULE';
    keywords?: string[];
    conditions?: Record<string, unknown>;
    schedule?: string;
  };

  @IsObject()
  actionConfig!: {
    type: 'SEND_MESSAGE' | 'SEND_TEMPLATE' | 'START_FLOW' | 'TAG_CONTACT' | 'ASSIGN_AGENT' | 'WEBHOOK';
    message?: string;
    templateId?: string;
    flowId?: string;
    tags?: string[];
    agentId?: string;
    webhookUrl?: string;
    webhookPayload?: Record<string, unknown>;
  };

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
