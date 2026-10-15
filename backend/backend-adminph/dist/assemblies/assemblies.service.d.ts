import { DatabaseService } from '../database/database.service';
import { AccessService } from '../common/access.service';
import { AuthUser } from '../common/auth-user.interface';
import { QrTokenService } from '../common/qr-token.service';
import { AuditService } from '../audit/audit.service';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';
import { CreateAssemblyDto } from './dto/create-assembly.dto';
export declare class AssembliesService {
    private readonly db;
    private readonly access;
    private readonly qr;
    private readonly audit;
    constructor(db: DatabaseService, access: AccessService, qr: QrTokenService, audit: AuditService);
    listForProperty(user: AuthUser, propertyId: string): Promise<{
        id: any;
        propertyId: any;
        name: any;
        status: any;
        active: boolean;
        raw: any;
    }[]>;
    currentForProperty(user: AuthUser, propertyId: string): Promise<{
        id: any;
        propertyId: any;
        name: any;
        status: any;
        active: boolean;
        raw: any;
    } | null>;
    createAssembly(user: AuthUser, dto: CreateAssemblyDto): Promise<any>;
    provisionQrInventory(user: AuthUser, assemblyId: string, requestMeta: any): Promise<{
        qr: any[];
        units: number | null;
        created: number;
        reused: number;
    }>;
    changeStatus(user: AuthUser, assemblyId: string, target: 'active' | 'closed', requestMeta: any): Promise<any>;
    attendance(user: AuthUser, assemblyId: string): Promise<any[]>;
    upsertAttendance(user: AuthUser, assemblyId: string, unitId: string, dto: UpsertAttendanceDto, requestMeta: any): Promise<{
        attendance: any;
        qr: any;
    }>;
    listQr(user: AuthUser, assemblyId: string): Promise<any[]>;
    reissueQr(user: AuthUser, assemblyId: string, unitId: string, requestMeta: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        token: string;
        url: string;
        active: boolean;
    }>;
}
