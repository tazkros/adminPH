import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PoolClient, QueryResultRow } from 'pg';
export declare class DatabaseService implements OnModuleDestroy {
    private readonly pool;
    constructor(config: ConfigService);
    query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<import("pg").QueryResult<T>>;
    transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
    onModuleDestroy(): Promise<void>;
}
