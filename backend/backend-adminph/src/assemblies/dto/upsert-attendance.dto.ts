import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpsertAttendanceDto {
  @IsBoolean() attended: boolean;
  @IsOptional() @IsUUID() personId?: string;
  @IsOptional() @IsIn(['owner','proxy']) attendanceRole?: 'owner' | 'proxy';
  @IsOptional() @IsString() @MaxLength(200) attendeeName?: string;
  @IsOptional() @IsString() @MaxLength(80) attendeeDocument?: string;
  @IsOptional() @IsIn(['manual','qr','operator','import']) verificationMethod?: string;
  @IsOptional() @IsString() notes?: string;
}
