import { IsString } from 'class-validator';

export class AssignThreadDto {
  @IsString()
  assignedUserId!: string;
}
