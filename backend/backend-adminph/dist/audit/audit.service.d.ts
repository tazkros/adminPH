import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
export interface AuditInput {
    organizationId?: string | null;
    assemblyId?: string | null;
    userId?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    oldValues?: unknown;
    newValues?: unknown;
    ipAddress?: string | null;
    userAgent?: string | null;
}
export declare class AuditService {
    private readonly db;
    constructor(db: DatabaseService);
    write(input: AuditInput, client?: PoolClient): Promise<void>;
}
