import { IsOptional, IsString, MinLength } from 'class-validator';
export class AddOptionDto {
  @IsString() @MinLength(1) label: string;
  @IsOptional() @IsString() optionType?: string;
}
