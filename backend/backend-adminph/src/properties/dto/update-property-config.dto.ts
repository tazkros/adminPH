import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePropertyConfigDto {
  @ApiProperty({
    description: 'Configuración completa del conjunto usada por el frontend AdminPH',
    type: 'object',
    additionalProperties: true,
    example: {
      nombreConjunto: 'Mi Conjunto Residencial',
      nit: '900.123.456-7',
      ciudad: 'Bogotá D.C.',
      direccion: 'Cra 10 #20-30',
      administradorNombre: 'Administrador Demo',
      fechaReunion: '2026-09-18',
      horaReunion: '18:00',
      tipoReunion: 'ordinaria',
      convocatoriaActual: 1,
      quorumPrimeraPorcentaje: 50,
      quorumSegundaPorcentaje: 30,
      formatoUnidad: '{NIVEL}{UNIDAD}',
      niveles: []
    }
  })
  @IsObject()
  config!: Record<string, any>;
}
