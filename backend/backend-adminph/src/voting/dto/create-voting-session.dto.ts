import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class CreateVotingSessionDto {
  @IsOptional() @IsUUID() agendaItemId?: string;
  @IsString() @MinLength(2) title: string;

  // Regla de conteo. Cada unidad emite UNA sola papeleta por actividad.
  @IsOptional() @IsIn(['nominal', 'coefficient']) countingMethod?: 'nominal' | 'coefficient';

  // Forma de captura. No cambia la regla de una papeleta por unidad.
  @IsOptional() @IsIn(['manual', 'qr', 'mixed']) inputMode?: 'manual' | 'qr' | 'mixed';

  @IsOptional() @IsIn(['deliberatory', 'decisory']) quorumType?: string;
  @IsOptional() @IsNumber() @Min(0.01) @Max(100) quorumPercentage?: number;

  // Cantidad de candidatos/opciones que pueden quedar declarados como ganadores.
  // NO es cantidad de selecciones por votante.
  @IsOptional() @IsInt() @Min(1) winnersRequired?: number;

  @IsOptional() @IsBoolean() includeVoterDetailsInMinutes?: boolean;
}
