import { IsBoolean } from 'class-validator';

export class ToggleFlowAiDto {
  @IsBoolean()
  enabled!: boolean;
}
