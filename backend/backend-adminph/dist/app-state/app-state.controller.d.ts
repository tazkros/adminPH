import { AuthUser } from '../common/auth-user.interface';
import { AppStateService } from './app-state.service';
export declare class AppStateController {
    private readonly service;
    constructor(service: AppStateService);
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
    info(user: AuthUser, propertyId: string): Promise<{
        exists: boolean;
        sizeBytes: any;
        updatedAt: any;
    } | {
        exists: boolean;
        sizeBytes?: undefined;
        updatedAt?: undefined;
    }>;
    load(user: AuthUser, propertyId: string, previous?: string): Promise<{
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
    save(user: AuthUser, propertyId: string, body: {
        data: Record<string, any>;
        label?: string;
    }): Promise<{
        ok: boolean;
        sizeBytes: number;
        updatedAt: any;
    }>;
}
