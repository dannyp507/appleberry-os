import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AssignDefaultFlowDto {
  @IsOptional()
  @IsString()
  flowId?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
