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
exports.ProxyService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const access_service_1 = require("../common/access.service");
let ProxyService = class ProxyService {
    db;
    access;
    log = new common_1.Logger('Proxy');
    constructor(db, access) {
        this.db = db;
        this.access = access;
    }
    async onModuleInit() {
        await this.db.query(`
      CREATE TABLE IF NOT EXISTS assembly_proxy_units (
        assembly_id uuid NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
        unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
        principal_unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
        proxy_name text,
        proxy_document text,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (assembly_id, unit_id)
      )`);
        await this.db.query('CREATE INDEX IF NOT EXISTS assembly_proxy_units_principal ON assembly_proxy_units (assembly_id, principal_unit_id)');
        this.log.log('Tabla assembly_proxy_units lista');
    }
    async putGroups(user, assemblyId, groups) {
        await this.access.ensureAssembly(user, assemblyId);
        if (!Array.isArray(groups))
            throw new common_1.BadRequestException('Formato inválido');
        if (groups.length > 500)
            throw new common_1.BadRequestException('Demasiados grupos');
        const prop = await this.db.query('SELECT property_id FROM assemblies WHERE id=$1', [assemblyId]);
        const propertyId = prop.rows[0]?.property_id;
        const seen = new Set();
        const rows = [];
        for (const g of groups) {
            const principal = String(g?.principalUnitId || '');
            const ids = Array.isArray(g?.unitIds) ? g.unitIds.map(String) : [];
            if (!principal || !ids.length)
                continue;
            if (seen.has(principal))
                throw new common_1.BadRequestException('Una unidad principal aparece en dos grupos');
            seen.add(principal);
            for (const id of ids) {
                if (id === principal)
                    continue;
                if (seen.has(id))
                    throw new common_1.BadRequestException('Una unidad está asignada a dos apoderados');
                seen.add(id);
                rows.push({ unit: id, principal, name: String(g?.name || '').slice(0, 200), doc: String(g?.document || '').slice(0, 60) });
            }
        }
        const all = [...seen];
        if (all.length) {
            const ok = await this.db.query('SELECT count(*)::int AS n FROM units WHERE property_id=$1 AND id = ANY($2::uuid[])', [propertyId, all]);
            if (ok.rows[0].n !== all.length)
                throw new common_1.BadRequestException('Alguna unidad no pertenece al conjunto de la asamblea');
        }
        await this.db.transaction(async (c) => {
            await c.query('DELETE FROM assembly_proxy_units WHERE assembly_id=$1', [assemblyId]);
            for (const r of rows) {
                await c.query('INSERT INTO assembly_proxy_units (assembly_id, unit_id, principal_unit_id, proxy_name, proxy_document) VALUES ($1,$2,$3,$4,$5)', [assemblyId, r.unit, r.principal, r.name, r.doc]);
            }
        });
        return { ok: true, groups: new Set(rows.map((r) => r.principal)).size, unitsRepresented: rows.length };
    }
    async getGroups(user, assemblyId) {
        await this.access.ensureAssembly(user, assemblyId);
        const r = await this.db.query(`SELECT p.principal_unit_id, p.unit_id, p.proxy_name, p.proxy_document FROM assembly_proxy_units p WHERE p.assembly_id=$1 ORDER BY p.principal_unit_id`, [assemblyId]);
        return r.rows;
    }
    async principalOf(client, assemblyId, unitId) {
        const r = await client.query('SELECT principal_unit_id FROM assembly_proxy_units WHERE assembly_id=$1 AND unit_id=$2', [assemblyId, unitId]);
        return r.rowCount ? r.rows[0].principal_unit_id : null;
    }
    async represented(client, assemblyId, principalUnitId) {
        const q = `SELECT u.id AS unit_id, u.unit_number, u.total_coefficient, a.id AS attendance_id, a.person_id, a.attended,
                      a.attendee_name_snapshot, a.attendee_document_snapshot
                 FROM assembly_proxy_units p
                 JOIN units u ON u.id = p.unit_id
                 LEFT JOIN attendance a ON a.assembly_id = p.assembly_id AND a.unit_id = p.unit_id
                WHERE p.assembly_id=$1 AND p.principal_unit_id=$2
                ORDER BY u.row_number NULLS LAST, u.unit_number`;
        const r = await client.query(q, [assemblyId, principalUnitId]);
        return r.rows;
    }
};
exports.ProxyService = ProxyService;
exports.ProxyService = ProxyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService, access_service_1.AccessService])
], ProxyService);
//# sourceMappingURL=proxy.service.js.map