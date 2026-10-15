import { PropertiesService } from './properties.service';
import { AuthUser } from '../common/auth-user.interface';
import { UpdatePropertyConfigDto } from './dto/update-property-config.dto';
import { SyncPropertyUnitsDto } from './dto/sync-property-units.dto';
import { UpdatePropertyUnitDto } from './dto/update-property-unit.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
export declare class PropertiesController {
    private readonly service;
    constructor(service: PropertiesService);
    list(user: AuthUser): Promise<{
        id: any;
        organizationId: any;
        name: any;
        raw: any;
    }[]>;
    create(user: AuthUser, dto: CreatePropertyDto, req: any): Promise<{
        id: any;
        organizationId: any;
        name: any;
        created: boolean;
    }>;
    config(user: AuthUser, propertyId: string): Promise<{
        propertyId: string;
        organizationId: any;
        config: any;
        updatedAt: any;
        updatedBy: any;
    }>;
    updateConfig(user: AuthUser, propertyId: string, dto: UpdatePropertyConfigDto, req: any): Promise<{
        propertyId: any;
        config: any;
        updatedAt: any;
        updatedBy: any;
    }>;
    listUnits(user: AuthUser, propertyId: string): Promise<{
        propertyId: string;
        count: any;
        units: any;
    }>;
    syncUnits(user: AuthUser, propertyId: string, dto: SyncPropertyUnitsDto, req: any): Promise<{
        propertyId: string;
        count: any;
        deactivated: number;
        units: any;
    }>;
    updateUnit(user: AuthUser, propertyId: string, unitId: string, dto: UpdatePropertyUnitDto, req: any): Promise<{
        propertyId: string;
        unit: {
            id: any;
            numeroFila: number;
            concatenado: any;
            tipo: any;
            jerarquia: any;
            propietario: any;
            numeroDocumento: any;
            correo: any;
            telefono: any;
            coeficiente: number;
            coeficienteParqueadero: number;
            coeficienteTotal: number;
            sextoNivelValor: any;
            active: boolean;
        };
    }>;
    deactivateUnit(user: AuthUser, propertyId: string, unitId: string, req: any): Promise<{
        propertyId: string;
        unitId: string;
        active: boolean;
    }>;
}
