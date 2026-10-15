import { AssembliesService } from './assemblies.service';
import { AuthUser } from '../common/auth-user.interface';
import { UpsertAttendanceDto } from './dto/upsert-attendance.dto';
import { CreateAssemblyDto } from './dto/create-assembly.dto';
export declare class AssembliesController {
    private readonly service;
    constructor(service: AssembliesService);
    createAssembly(u: AuthUser, dto: CreateAssemblyDto): Promise<any>;
    start(u: AuthUser, id: string, req: any): Promise<any>;
    closeAssembly(u: AuthUser, id: string, req: any): Promise<any>;
    listForProperty(u: AuthUser, propertyId: string): Promise<{
        id: any;
        propertyId: any;
        name: any;
        status: any;
        active: boolean;
        raw: any;
    }[]>;
    currentForProperty(u: AuthUser, propertyId: string): Promise<{
        id: any;
        propertyId: any;
        name: any;
        status: any;
        active: boolean;
        raw: any;
    } | null>;
    attendance(u: AuthUser, id: string): Promise<any[]>;
    upsert(u: AuthUser, a: string, unit: string, dto: UpsertAttendanceDto, req: any): Promise<{
        attendance: any;
        qr: any;
    }>;
    provisionQr(u: AuthUser, id: string, req: any): Promise<{
        qr: any[];
        units: number | null;
        created: number;
        reused: number;
    }>;
    qr(u: AuthUser, id: string): Promise<any[]>;
    reissue(u: AuthUser, a: string, unit: string, req: any): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        token: string;
        url: string;
        active: boolean;
    }>;
}
