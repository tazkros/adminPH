import { AuthUser } from '../common/auth-user.interface';
import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly service;
    constructor(service: NotificationsService);
    status(): {
        configured: boolean;
        host: string | null;
        port: number;
        from: string | null;
    };
    email(u: AuthUser, id: string, body: any, req: any): Promise<{
        scope: string;
        sent: number;
        failed: number;
        results: any[];
        assemblyStatus: any;
    }>;
}
