"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QrTokenService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
let QrTokenService = class QrTokenService {
    secret;
    appUrl;
    constructor(config) {
        this.secret = config.getOrThrow('QR_SIGNING_SECRET');
        this.appUrl = (config.get('PUBLIC_APP_URL') || 'http://localhost:5500').replace(/\/$/, '');
    }
    signature(id) { return (0, crypto_1.createHmac)('sha256', this.secret).update(id).digest('base64url'); }
    build(id) { return `${id}.${this.signature(id)}`; }
    hash(token) { return (0, crypto_1.createHash)('sha256').update(token).digest('hex'); }
    parseAndVerify(token) {
        const [id, sig, extra] = String(token || '').split('.');
        if (!id || !sig || extra)
            throw new common_1.UnauthorizedException('QR inválido');
        const expected = this.signature(id);
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !(0, crypto_1.timingSafeEqual)(a, b))
            throw new common_1.UnauthorizedException('QR inválido');
        if (!/^[0-9a-f-]{36}$/i.test(id))
            throw new common_1.BadRequestException('Formato de QR inválido');
        return id;
    }
    url(token) {
        return `${this.appUrl}?voteToken=${encodeURIComponent(token)}`;
    }
};
exports.QrTokenService = QrTokenService;
exports.QrTokenService = QrTokenService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], QrTokenService);
//# sourceMappingURL=qr-token.service.js.map