import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateVotingSessionDto {
  @IsOptional() @IsBoolean() includeVoterDetailsInMinutes?: boolean;
  @IsOptional() @IsInt() @Min(1) winnersRequired?: number;
  @IsOptional() @IsIn(['nominal', 'coefficient']) countingMethod?: 'nominal' | 'coefficient';
}
