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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let AuditService = class AuditService {
    db;
    constructor(db) {
        this.db = db;
    }
    async write(input, client) {
        const sql = `INSERT INTO audit_logs
       (organization_id,assembly_id,user_id,action,entity_type,entity_id,old_values,new_values,ip_address,user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)`;
        const params = [
            input.organizationId ?? null,
            input.assemblyId ?? null,
            input.userId ?? null,
            input.action,
            input.entityType ?? null,
            input.entityId ?? null,
            input.oldValues == null ? null : JSON.stringify(input.oldValues),
            input.newValues == null ? null : JSON.stringify(input.newValues),
            input.ipAddress ?? null,
            input.userAgent ?? null,
        ];
        if (client) {
            await client.query(sql, params);
            return;
        }
        await this.db.query(sql, params);
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], AuditService);
//# sourceMappingURL=audit.service.js.map