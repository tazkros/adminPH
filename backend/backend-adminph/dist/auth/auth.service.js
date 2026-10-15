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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const database_service_1 = require("../database/database.service");
let AuthService = class AuthService {
    db;
    jwt;
    constructor(db, jwt) {
        this.db = db;
        this.jwt = jwt;
    }
    async login(dto) {
        const q = await this.db.query(`SELECT u.id,u.organization_id,u.username,u.password_hash,u.full_name,u.active,
              COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id=u.id
       LEFT JOIN roles r ON r.id=ur.role_id
       WHERE lower(u.username)=lower($1)
       GROUP BY u.id`, [dto.username.trim()]);
        const user = q.rows[0];
        if (!user || !user.active || !(await bcrypt.compare(dto.password, user.password_hash))) {
            throw new common_1.UnauthorizedException('Usuario o contraseña incorrectos');
        }
        await this.db.query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [user.id]);
        const payload = {
            sub: user.id,
            organizationId: user.organization_id,
            username: user.username,
            fullName: user.full_name,
            roles: user.roles,
        };
        return {
            accessToken: await this.jwt.signAsync(payload),
            user: { id: user.id, organizationId: user.organization_id, username: user.username, fullName: user.full_name, roles: user.roles },
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService, jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map