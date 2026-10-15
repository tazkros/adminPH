import { ConfigService } from '@nestjs/config';
export interface MailAttachment {
    cid: string;
    filename: string;
    contentType: string;
    base64: string;
}
export interface MailMessage {
    to: string;
    subject: string;
    text: string;
    html: string;
    attachments?: MailAttachment[];
}
export interface MailResult {
    to: string;
    ok: boolean;
    error?: string;
}
export declare class MailService {
    private readonly config;
    constructor(config: ConfigService);
    private get host();
    private get port();
    private get user();
    private get pass();
    private get from();
    private get fromName();
    private get starttls();
    private get implicitTls();
    status(): {
        configured: boolean;
        host: string | null;
        port: number;
        from: string | null;
    };
    private enc;
    private wrap;
    private clean;
    private build;
    sendMany(messages: MailMessage[]): Promise<MailResult[]>;
    private connect;
}
