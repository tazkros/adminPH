import { OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthUser } from '../common/auth-user.interface';
export declare class AppStateService implements OnModuleInit {
    private readonly db;
    private readonly log;
    constructor(db: DatabaseService);
    onModuleInit(): Promise<void>;
    private assertProperty;
    private static readonly HISTORY_KEEP;
    private static readonly HISTORY_EVERY_MS;
    private archiveCurrent;
    summary(user: AuthUser): Promise<{
        id: any;
        name: any;
        updatedAt: any;
        sizeBytes: any;
        versions: number;
    }[]>;
    history(user: AuthUser, propertyId: string): Promise<{
        items: any[];
    }>;
    historyItem(user: AuthUser, propertyId: string, id: string): Promise<{
        exists: boolean;
        previous?: undefined;
        data?: undefined;
        updatedAt?: undefined;
        sizeBytes?: undefined;
        hasPrevious?: undefined;
    } | {
        exists: boolean;
        previous: boolean;
        data: any;
        updatedAt: any;
        sizeBytes?: undefined;
        hasPrevious?: undefined;
    } | {
        exists: boolean;
        data: any;
        sizeBytes: any;
        updatedAt: any;
        hasPrevious: boolean;
        previous?: undefined;
    } | {
        exists: boolean;
        data: any;
        updatedAt: any;
    }>;
    deleteHistoryItem(user: AuthUser, propertyId: string, id: string): Promise<{
        deleted: number;
    }>;
    save(user: AuthUser, propertyId: string, data: Record<string, any>, label?: string): Promise<{
        ok: boolean;
        sizeBytes: number;
        updatedAt: any;
    }>;
    load(user: AuthUser, propertyId: string, previous?: boolean): Promise<{
        exists: boolean;
        previous?: undefined;
        data?: undefined;
        updatedAt?: undefined;
        sizeBytes?: undefined;
        hasPrevious?: undefined;
    } | {
        exists: boolean;
        previous: boolean;
        data: any;
        updatedAt: any;
        sizeBytes?: undefined;
        hasPrevious?: undefined;
    } | {
        exists: boolean;
        data: any;
        sizeBytes: any;
        updatedAt: any;
        hasPrevious: boolean;
        previous?: undefined;
    }>;
    info(user: AuthUser, propertyId: string): Promise<{
        exists: boolean;
        sizeBytes: any;
        updatedAt: any;
    } | {
        exists: boolean;
        sizeBytes?: undefined;
        updatedAt?: undefined;
    }>;
}
