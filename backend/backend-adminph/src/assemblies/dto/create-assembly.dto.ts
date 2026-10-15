import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAssemblyDto {
  @IsString()
  propertyId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  assemblyType?: string;

  @IsOptional()
  @IsDateString()
  meetingDate?: string;

  @IsOptional()
  @IsString()
  meetingTime?: string;
}
