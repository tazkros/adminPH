import { IsUUID } from 'class-validator';

export class ManualVoteDto {
  @IsUUID() unitId: string;
  @IsUUID() optionId: string;
}
