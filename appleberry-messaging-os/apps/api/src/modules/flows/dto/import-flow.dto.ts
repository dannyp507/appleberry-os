import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ImportFlowDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
