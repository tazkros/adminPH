import { DatabaseService } from '../database/database.service';
import { AccessService } from '../common/access.service';
import { QrTokenService } from '../common/qr-token.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user.interface';
import { MailService } from './mail.service';
export declare class NotificationsService {
    private readonly db;
    private readonly access;
    private readonly qr;
    private readonly audit;
    private readonly mail;
    constructor(db: DatabaseService, access: AccessService, qr: QrTokenService, audit: AuditService, mail: MailService);
    status(): {
        configured: boolean;
        host: string | null;
        port: number;
        from: string | null;
    };
    sendQrEmails(user: AuthUser, assemblyId: string, body: any, meta: {
        ip?: string;
        userAgent?: string;
    }): Promise<{
        scope: string;
        sent: number;
        failed: number;
        results: any[];
        assemblyStatus: any;
    }>;
}
