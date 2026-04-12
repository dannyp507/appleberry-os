import { IsArray, IsOptional, IsString } from 'class-validator';

export class AddRecipientsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactGroupIds?: string[];
}
