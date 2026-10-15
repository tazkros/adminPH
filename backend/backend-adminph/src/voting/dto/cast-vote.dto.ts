import { IsString, IsUUID } from 'class-validator';

export class CastVoteDto {
  @IsString() token: string;
  @IsUUID('4') optionId: string;
}
