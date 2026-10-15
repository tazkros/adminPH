import { AuthUser } from '../common/auth-user.interface';
import { ProxyService } from './proxy.service';
export declare class ProxyController {
    private readonly service;
    constructor(service: ProxyService);
    get(u: AuthUser, id: string): Promise<any[]>;
    put(u: AuthUser, id: string, body: {
        groups: any[];
    }): Promise<{
        ok: boolean;
        groups: number;
        unitsRepresented: number;
    }>;
}
