import { OnModuleInit } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AccessService } from '../common/access.service';
import { AuthUser } from '../common/auth-user.interface';
export declare class ProxyService implements OnModuleInit {
    private readonly db;
    private readonly access;
    private readonly log;
    constructor(db: DatabaseService, access: AccessService);
    onModuleInit(): Promise<void>;
    putGroups(user: AuthUser, assemblyId: string, groups: any[]): Promise<{
        ok: boolean;
        groups: number;
        unitsRepresented: number;
    }>;
    getGroups(user: AuthUser, assemblyId: string): Promise<any[]>;
    principalOf(client: PoolClient, assemblyId: string, unitId: string): Promise<string | null>;
    represented(client: PoolClient | DatabaseService, assemblyId: string, principalUnitId: string): Promise<any[]>;
}
