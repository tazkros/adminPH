import { DatabaseService } from '../database/database.service';
import { AccessService } from '../common/access.service';
import { AuthUser } from '../common/auth-user.interface';
import { AuditService } from '../audit/audit.service';
import { SyncPropertyUnitsDto } from './dto/sync-property-units.dto';
import { UpdatePropertyUnitDto } from './dto/update-property-unit.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
export declare class PropertiesService {
    private readonly db;
    private readonly access;
    private readonly audit;
    constructor(db: DatabaseService, access: AccessService, audit: AuditService);
    list(user: AuthUser): Promise<{
        id: any;
        organizationId: any;
        name: any;
        raw: any;
    }[]>;
    create(user: AuthUser, dto: CreatePropertyDto, requestMeta: any): Promise<{
        id: any;
        organizationId: any;
        name: any;
        created: boolean;
    }>;
    getConfig(user: AuthUser, propertyId: string): Promise<{
        propertyId: string;
        organizationId: any;
        config: any;
        updatedAt: any;
        updatedBy: any;
    }>;
    updateConfig(user: AuthUser, propertyId: string, config: Record<string, any>, requestMeta: any): Promise<{
        propertyId: any;
        config: any;
        updatedAt: any;
        updatedBy: any;
    }>;
    private mapUnit;
    private queryUnits;
    listUnits(user: AuthUser, propertyId: string): Promise<{
        propertyId: string;
        count: any;
        units: any;
    }>;
    private number;
    private findExistingUnit;
    private upsertOneUnit;
    syncUnits(user: AuthUser, propertyId: string, dto: SyncPropertyUnitsDto, requestMeta: any): Promise<{
        propertyId: string;
        count: any;
        deactivated: number;
        units: any;
    }>;
    updateUnit(user: AuthUser, propertyId: string, unitId: string, dto: UpdatePropertyUnitDto, requestMeta: any): Promise<{
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
    deactivateUnit(user: AuthUser, propertyId: string, unitId: string, requestMeta: any): Promise<{
        propertyId: string;
        unitId: string;
        active: boolean;
    }>;
}
