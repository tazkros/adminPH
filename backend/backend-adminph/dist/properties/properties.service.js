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
exports.PropertiesService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const database_service_1 = require("../database/database.service");
const access_service_1 = require("../common/access.service");
const audit_service_1 = require("../audit/audit.service");
let PropertiesService = class PropertiesService {
    db;
    access;
    audit;
    constructor(db, access, audit) {
        this.db = db;
        this.access = access;
        this.audit = audit;
    }
    async list(user) {
        const isSuperAdmin = user.roles.includes('superadmin');
        const q = await this.db.query(`SELECT p.id, p.organization_id, to_jsonb(p) AS raw
       FROM properties p
       WHERE ($1::boolean = true OR p.organization_id = $2)
       ORDER BY COALESCE(to_jsonb(p)->>'name', to_jsonb(p)->>'property_name', to_jsonb(p)->>'nombre', p.id::text)`, [isSuperAdmin, user.organizationId]);
        return q.rows.map((r) => {
            const raw = r.raw || {};
            return {
                id: r.id,
                organizationId: r.organization_id,
                name: raw.name || raw.property_name || raw.nombre || raw.title || `Conjunto ${String(r.id).slice(0, 8)}`,
                raw,
            };
        });
    }
    async create(user, dto, requestMeta) {
        if (!user.organizationId)
            throw new common_1.BadRequestException('Su usuario no pertenece a una organización');
        const name = dto.name.trim();
        const found = await this.db.query(`SELECT id,organization_id,name FROM properties
       WHERE organization_id=$1 AND lower(name)=lower($2) ORDER BY created_at LIMIT 1`, [user.organizationId, name]);
        if (found.rowCount) {
            const r = found.rows[0];
            return { id: r.id, organizationId: r.organization_id, name: r.name, created: false };
        }
        return this.db.transaction(async (client) => {
            const q = await client.query(`INSERT INTO properties(organization_id,name,nit,address,city)
         VALUES($1,$2,$3,$4,$5) RETURNING id,organization_id,name`, [user.organizationId, name, dto.nit || null, dto.address || null, dto.city || null]);
            const r = q.rows[0];
            await this.audit.write({
                organizationId: user.organizationId,
                userId: user.id,
                action: 'PROPERTY_CREATED',
                entityType: 'property',
                entityId: r.id,
                newValues: { name },
                ipAddress: requestMeta.ip,
                userAgent: requestMeta.userAgent,
            }, client);
            return { id: r.id, organizationId: r.organization_id, name: r.name, created: true };
        });
    }
    async getConfig(user, propertyId) {
        const property = await this.access.ensureProperty(user, propertyId);
        const q = await this.db.query(`SELECT property_id, config, updated_at, updated_by
       FROM property_configurations
       WHERE property_id=$1`, [propertyId]);
        return {
            propertyId,
            organizationId: property.organization_id,
            config: q.rows[0]?.config || {},
            updatedAt: q.rows[0]?.updated_at || null,
            updatedBy: q.rows[0]?.updated_by || null,
        };
    }
    async updateConfig(user, propertyId, config, requestMeta) {
        const property = await this.access.ensureProperty(user, propertyId);
        const oldQ = await this.db.query(`SELECT config FROM property_configurations WHERE property_id=$1`, [propertyId]);
        const q = await this.db.query(`INSERT INTO property_configurations(property_id, config, updated_at, updated_by)
       VALUES($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (property_id) DO UPDATE SET
         config=EXCLUDED.config,
         updated_at=NOW(),
         updated_by=EXCLUDED.updated_by
       RETURNING property_id, config, updated_at, updated_by`, [propertyId, JSON.stringify(config || {}), user.id]);
        await this.audit.write({
            organizationId: property.organization_id,
            userId: user.id,
            action: 'PROPERTY_CONFIGURATION_UPDATED',
            entityType: 'property_configuration',
            entityId: propertyId,
            oldValues: oldQ.rows[0]?.config || null,
            newValues: q.rows[0]?.config || {},
            ipAddress: requestMeta.ip,
            userAgent: requestMeta.userAgent,
        });
        return {
            propertyId: q.rows[0].property_id,
            config: q.rows[0].config,
            updatedAt: q.rows[0].updated_at,
            updatedBy: q.rows[0].updated_by,
        };
    }
    mapUnit(row) {
        const meta = row.frontend_meta || {};
        const base = Number(row.base_coefficient ?? row.total_coefficient ?? 0);
        const parking = Number(row.parking_coefficient ?? 0);
        const total = Number(row.total_coefficient ?? (base + parking));
        return {
            id: row.id,
            numeroFila: Number(row.row_number || 0),
            concatenado: row.display_name || row.unit_number || '',
            tipo: row.unit_type || 'residencial',
            jerarquia: row.hierarchy || {},
            propietario: row.owner_name || '',
            numeroDocumento: row.owner_document || '',
            correo: row.owner_email || '',
            telefono: row.owner_phone || '',
            coeficiente: base,
            coeficienteParqueadero: parking,
            coeficienteTotal: total,
            sextoNivelValor: meta.sextoNivelValor || `${row.unit_type || 'residencial'}_${row.row_number || ''}`,
            active: row.active !== false,
        };
    }
    async queryUnits(queryable, propertyId) {
        const q = await queryable.query(`SELECT id,property_id,row_number,unit_number,total_coefficient,
              unit_type,hierarchy,display_name,base_coefficient,parking_coefficient,
              owner_name,owner_document,owner_email,owner_phone,frontend_meta,active,
              updated_at,updated_by
       FROM units
       WHERE property_id=$1 AND COALESCE(active,true)=true
       ORDER BY row_number NULLS LAST,unit_number`, [propertyId]);
        return q.rows.map((r) => this.mapUnit(r));
    }
    async listUnits(user, propertyId) {
        await this.access.ensureProperty(user, propertyId);
        const units = await this.queryUnits(this.db, propertyId);
        return { propertyId, count: units.length, units };
    }
    number(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }
    async findExistingUnit(client, propertyId, item) {
        if (item.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id)) {
            const byId = await client.query('SELECT id FROM units WHERE id=$1 AND property_id=$2 LIMIT 1', [item.id, propertyId]);
            if (byId.rowCount)
                return byId.rows[0].id;
        }
        const byName = await client.query(`SELECT id FROM units
       WHERE property_id=$1
         AND (display_name=$2 OR unit_number=$2)
       ORDER BY COALESCE(active,true) DESC, row_number NULLS LAST
       LIMIT 1`, [propertyId, item.concatenado]);
        return byName.rows[0]?.id || null;
    }
    async upsertOneUnit(client, propertyId, userId, item) {
        const existingId = await this.findExistingUnit(client, propertyId, item);
        const id = existingId || (0, crypto_1.randomUUID)();
        const base = this.number(item.coeficiente);
        const parking = this.number(item.coeficienteParqueadero);
        const meta = {
            sextoNivelValor: item.sextoNivelValor || '',
            clientId: item.id || null,
        };
        if (existingId) {
            await client.query(`UPDATE units SET
           row_number=$3,
           unit_number=$4,
           unit_type=$5,
           hierarchy=$6::jsonb,
           display_name=$7,
           base_coefficient=$8,
           parking_coefficient=$9,
           owner_name=$10,
           owner_document=$11,
           owner_email=$12,
           owner_phone=$13,
           frontend_meta=$14::jsonb,
           active=true,
           updated_at=NOW(),
           updated_by=$15
         WHERE id=$1 AND property_id=$2`, [
                id, propertyId, item.numeroFila, item.concatenado,
                item.tipo || 'residencial', JSON.stringify(item.jerarquia || {}), item.concatenado,
                base, parking, item.propietario || null, item.numeroDocumento || null,
                item.correo || null, item.telefono || null, JSON.stringify(meta), userId,
            ]);
        }
        else {
            await client.query(`INSERT INTO units(
           id,property_id,row_number,unit_number,
           unit_type,hierarchy,display_name,base_coefficient,parking_coefficient,
           owner_name,owner_document,owner_email,owner_phone,frontend_meta,
           active,updated_at,updated_by
         ) VALUES(
           $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,true,NOW(),$15
         )`, [
                id, propertyId, item.numeroFila, item.concatenado,
                item.tipo || 'residencial', JSON.stringify(item.jerarquia || {}), item.concatenado,
                base, parking, item.propietario || null, item.numeroDocumento || null,
                item.correo || null, item.telefono || null, JSON.stringify(meta), userId,
            ]);
        }
        return id;
    }
    async syncUnits(user, propertyId, dto, requestMeta) {
        const property = await this.access.ensureProperty(user, propertyId);
        const replaceMissing = dto.replaceMissing !== false;
        return this.db.transaction(async (client) => {
            const oldQ = await client.query(`SELECT id,row_number,unit_number,total_coefficient,active
         FROM units WHERE property_id=$1 ORDER BY row_number NULLS LAST,unit_number`, [propertyId]);
            const keptIds = [];
            for (const item of dto.units || []) {
                keptIds.push(await this.upsertOneUnit(client, propertyId, user.id, item));
            }
            let deactivated = 0;
            if (replaceMissing) {
                let result;
                if (keptIds.length) {
                    result = await client.query(`UPDATE units
             SET active=false,updated_at=NOW(),updated_by=$3
             WHERE property_id=$1 AND COALESCE(active,true)=true AND NOT (id = ANY($2::uuid[]))`, [propertyId, keptIds, user.id]);
                }
                else {
                    result = await client.query(`UPDATE units
             SET active=false,updated_at=NOW(),updated_by=$2
             WHERE property_id=$1 AND COALESCE(active,true)=true`, [propertyId, user.id]);
                }
                deactivated = result.rowCount || 0;
            }
            const units = await this.queryUnits(client, propertyId);
            await this.audit.write({
                organizationId: property.organization_id,
                userId: user.id,
                action: 'PROPERTY_UNITS_SYNCED',
                entityType: 'property',
                entityId: propertyId,
                oldValues: { count: oldQ.rows.length, activeCount: oldQ.rows.filter((x) => x.active !== false).length },
                newValues: { count: units.length, deactivated },
                ipAddress: requestMeta.ip,
                userAgent: requestMeta.userAgent,
            }, client);
            return { propertyId, count: units.length, deactivated, units };
        });
    }
    async updateUnit(user, propertyId, unitId, dto, requestMeta) {
        const property = await this.access.ensureProperty(user, propertyId);
        return this.db.transaction(async (client) => {
            const oldQ = await client.query(`SELECT id,property_id,row_number,unit_number,total_coefficient,
                unit_type,hierarchy,display_name,base_coefficient,parking_coefficient,
                owner_name,owner_document,owner_email,owner_phone,frontend_meta,active
         FROM units WHERE id=$1 AND property_id=$2 LIMIT 1`, [unitId, propertyId]);
            if (!oldQ.rowCount)
                throw new common_1.NotFoundException('Unidad no encontrada en este conjunto');
            const old = oldQ.rows[0];
            const oldMeta = old.frontend_meta || {};
            const base = dto.coeficiente !== undefined ? this.number(dto.coeficiente) : this.number(old.base_coefficient);
            const parking = dto.coeficienteParqueadero !== undefined ? this.number(dto.coeficienteParqueadero) : this.number(old.parking_coefficient);
            const concatenado = dto.concatenado !== undefined ? dto.concatenado : (old.display_name || old.unit_number);
            const meta = {
                ...oldMeta,
                ...(dto.sextoNivelValor !== undefined ? { sextoNivelValor: dto.sextoNivelValor } : {}),
            };
            const q = await client.query(`UPDATE units SET
           row_number=$3,
           unit_number=$4,
           unit_type=$5,
           hierarchy=$6::jsonb,
           display_name=$7,
           base_coefficient=$8,
           parking_coefficient=$9,
           owner_name=$10,
           owner_document=$11,
           owner_email=$12,
           owner_phone=$13,
           frontend_meta=$14::jsonb,
           active=true,
           updated_at=NOW(),
           updated_by=$15
         WHERE id=$1 AND property_id=$2
         RETURNING id,property_id,row_number,unit_number,total_coefficient,
                   unit_type,hierarchy,display_name,base_coefficient,parking_coefficient,
                   owner_name,owner_document,owner_email,owner_phone,frontend_meta,active`, [
                unitId, propertyId,
                dto.numeroFila !== undefined ? dto.numeroFila : old.row_number,
                concatenado,
                dto.tipo !== undefined ? dto.tipo : old.unit_type,
                JSON.stringify(dto.jerarquia !== undefined ? dto.jerarquia : (old.hierarchy || {})),
                concatenado,
                base,
                parking,
                dto.propietario !== undefined ? (dto.propietario || null) : old.owner_name,
                dto.numeroDocumento !== undefined ? (dto.numeroDocumento || null) : old.owner_document,
                dto.correo !== undefined ? (dto.correo || null) : old.owner_email,
                dto.telefono !== undefined ? (dto.telefono || null) : old.owner_phone,
                JSON.stringify(meta),
                user.id,
            ]);
            const unit = this.mapUnit(q.rows[0]);
            await this.audit.write({
                organizationId: property.organization_id,
                userId: user.id,
                action: 'PROPERTY_UNIT_UPDATED',
                entityType: 'unit',
                entityId: unitId,
                oldValues: { unitNumber: old.unit_number, totalCoefficient: old.total_coefficient },
                newValues: { unitNumber: unit.concatenado, totalCoefficient: unit.coeficienteTotal },
                ipAddress: requestMeta.ip,
                userAgent: requestMeta.userAgent,
            }, client);
            return { propertyId, unit };
        });
    }
    async deactivateUnit(user, propertyId, unitId, requestMeta) {
        const property = await this.access.ensureProperty(user, propertyId);
        const q = await this.db.query(`UPDATE units
       SET active=false,updated_at=NOW(),updated_by=$3
       WHERE id=$1 AND property_id=$2
       RETURNING id,unit_number,total_coefficient`, [unitId, propertyId, user.id]);
        if (!q.rowCount)
            throw new common_1.NotFoundException('Unidad no encontrada en este conjunto');
        await this.audit.write({
            organizationId: property.organization_id,
            userId: user.id,
            action: 'PROPERTY_UNIT_DEACTIVATED',
            entityType: 'unit',
            entityId: unitId,
            oldValues: q.rows[0],
            newValues: { active: false },
            ipAddress: requestMeta.ip,
            userAgent: requestMeta.userAgent,
        });
        return { propertyId, unitId, active: false };
    }
};
exports.PropertiesService = PropertiesService;
exports.PropertiesService = PropertiesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        access_service_1.AccessService,
        audit_service_1.AuditService])
], PropertiesService);
//# sourceMappingURL=properties.service.js.map