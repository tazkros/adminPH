import { ConfigService } from '@nestjs/config';
export declare class QrTokenService {
    private readonly secret;
    private readonly appUrl;
    constructor(config: ConfigService);
    signature(id: string): string;
    build(id: string): string;
    hash(token: string): string;
    parseAndVerify(token: string): string;
    url(token: string): string;
}
