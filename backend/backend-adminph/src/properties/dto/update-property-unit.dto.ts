import { IsInt, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdatePropertyUnitDto {
  @IsOptional() @IsInt() @Min(1) numeroFila?: number;
  @IsOptional() @IsString() @MaxLength(200) concatenado?: string;
  @IsOptional() @IsString() @MaxLength(30) tipo?: string;
  @IsOptional() @IsObject() jerarquia?: Record<string, any>;
  @IsOptional() @IsString() @MaxLength(200) propietario?: string;
  @IsOptional() @IsString() @MaxLength(80) numeroDocumento?: string;
  @IsOptional() @IsString() @MaxLength(255) correo?: string;
  @IsOptional() @IsString() @MaxLength(80) telefono?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 8 }) coeficiente?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 8 }) coeficienteParqueadero?: number;
  @IsOptional() @IsString() @MaxLength(200) sextoNivelValor?: string;
}
