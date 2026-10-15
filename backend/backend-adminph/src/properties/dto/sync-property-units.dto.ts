import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PropertyUnitDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsInt()
  @Min(1)
  numeroFila!: number;

  @IsString()
  @MaxLength(200)
  concatenado!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  tipo?: string;

  @IsOptional()
  @IsObject()
  jerarquia?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  propietario?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  numeroDocumento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  correo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  telefono?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  coeficiente?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  coeficienteParqueadero?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  coeficienteTotal?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  sextoNivelValor?: string;
}

export class SyncPropertyUnitsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyUnitDto)
  units!: PropertyUnitDto[];

  @IsOptional()
  @IsBoolean()
  replaceMissing?: boolean;
}
