export declare class PropertyUnitDto {
    id?: string;
    numeroFila: number;
    concatenado: string;
    tipo?: string;
    jerarquia?: Record<string, any>;
    propietario?: string;
    numeroDocumento?: string;
    correo?: string;
    telefono?: string;
    coeficiente?: number;
    coeficienteParqueadero?: number;
    coeficienteTotal?: number;
    sextoNivelValor?: string;
}
export declare class SyncPropertyUnitsDto {
    units: PropertyUnitDto[];
    replaceMissing?: boolean;
}
