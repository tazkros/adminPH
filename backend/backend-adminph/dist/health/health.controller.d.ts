import { DatabaseService } from '../database/database.service';
export declare class HealthController {
    private readonly db;
    constructor(db: DatabaseService);
    health(): Promise<{
        ok: boolean;
        service: string;
        database: string;
        databaseTime: any;
    }>;
}
