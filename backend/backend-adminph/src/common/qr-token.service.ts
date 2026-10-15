import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class QrTokenService {
  private readonly secret: string;
  private readonly appUrl: string;
  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('QR_SIGNING_SECRET');
    this.appUrl = (config.get<string>('PUBLIC_APP_URL') || 'http://localhost:5500').replace(/\/$/, '');
  }
  signature(id: string) { return createHmac('sha256', this.secret).update(id).digest('base64url'); }
  build(id: string) { return `${id}.${this.signature(id)}`; }
  hash(token: string) { return createHash('sha256').update(token).digest('hex'); }
  parseAndVerify(token: string): string {
    const [id, sig, extra] = String(token || '').split('.');
    if (!id || !sig || extra) throw new UnauthorizedException('QR inválido');
    const expected = this.signature(id);
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('QR inválido');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BadRequestException('Formato de QR inválido');
    return id;
  }
  url(token: string) {
  return `${this.appUrl}?voteToken=${encodeURIComponent(token)}`;
}
}
