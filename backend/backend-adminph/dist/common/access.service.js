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
exports.AccessService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let AccessService = class AccessService {
    db;
    constructor(db) {
        this.db = db;
    }
    async ensureProperty(user, propertyId) {
        const q = await this.db.query(`SELECT p.id, p.organization_id, to_jsonb(p) AS raw
       FROM properties p
       WHERE p.id=$1`, [propertyId]);
        if (!q.rowCount)
            throw new common_1.NotFoundException('Conjunto no encontrado');
        const row = q.rows[0];
        if (user.roles.includes('superadmin'))
            return row;
        if (!user.organizationId || row.organization_id !== user.organizationId) {
            throw new common_1.ForbiddenException('Conjunto fuera de su organización');
        }
        return row;
    }
    async ensureAssembly(user, assemblyId) {
        const q = await this.db.query(`SELECT a.id, a.status, p.organization_id,
              EXISTS(SELECT 1 FROM assembly_users au WHERE au.assembly_id=a.id AND au.user_id=$2) AS assigned
       FROM assemblies a JOIN properties p ON p.id=a.property_id
       WHERE a.id=$1`, [assemblyId, user.id]);
        if (!q.rowCount)
            throw new common_1.NotFoundException('Asamblea no encontrada');
        const row = q.rows[0];
        if (user.roles.includes('superadmin'))
            return row;
        if (!user.organizationId || row.organization_id !== user.organizationId)
            throw new common_1.ForbiddenException('Asamblea fuera de su organización');
        if (user.roles.includes('operador') && !user.roles.includes('admin') && !row.assigned) {
            throw new common_1.ForbiddenException('Operador no asignado a esta asamblea');
        }
        return row;
    }
};
exports.AccessService = AccessService;
exports.AccessService = AccessService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], AccessService);
//# sourceMappingURL=access.service.js.map