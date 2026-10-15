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
var AppStateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppStateService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let AppStateService = class AppStateService {
    static { AppStateService_1 = this; }
    db;
    log = new common_1.Logger('AppState');
    constructor(db) {
        this.db = db;
    }
    async onModuleInit() {
        await this.db.query(`
      CREATE TABLE IF NOT EXISTS app_state_snapshots (
        organization_id uuid NOT NULL,
        property_id uuid NOT NULL,
        data jsonb NOT NULL,
        size_bytes integer NOT NULL DEFAULT 0,
        updated_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (organization_id, property_id)
      )`);
        await this.db.query('ALTER TABLE app_state_snapshots ADD COLUMN IF NOT EXISTS prev_data jsonb');
        await this.db.query('ALTER TABLE app_state_snapshots ADD COLUMN IF NOT EXISTS prev_updated_at timestamptz');
        await this.db.query(`
      CREATE TABLE IF NOT EXISTS app_state_history (
        id bigserial PRIMARY KEY,
        organization_id uuid NOT NULL,
        property_id uuid NOT NULL,
        data jsonb NOT NULL,
        size_bytes integer NOT NULL DEFAULT 0,
        label text,
        saved_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
        await this.db.query('CREATE INDEX IF NOT EXISTS app_state_history_idx ON app_state_history (organization_id, property_id, id DESC)');
        this.log.log('Tablas app_state_snapshots y app_state_history listas');
    }
    async assertProperty(user, propertyId) {
        if (!user.organizationId)
            throw new common_1.ForbiddenException('El usuario no pertenece a una organización.');
        const r = await this.db.query('SELECT 1 FROM properties WHERE id = $1 AND organization_id = $2', [propertyId, user.organizationId]);
        if (!r.rowCount)
            throw new common_1.ForbiddenException('El conjunto no pertenece a su organización.');
    }
    static HISTORY_KEEP = 20;
    static HISTORY_EVERY_MS = 3 * 60 * 1000;
    async archiveCurrent(orgId, propertyId, label, always) {
        const cur = await this.db.query('SELECT data, size_bytes, updated_at FROM app_state_snapshots WHERE organization_id=$1 AND property_id=$2', [orgId, propertyId]);
        if (!cur.rowCount)
            return;
        const row = cur.rows[0];
        if (!always) {
            const last = await this.db.query('SELECT saved_at FROM app_state_history WHERE organization_id=$1 AND property_id=$2 ORDER BY id DESC LIMIT 1', [orgId, propertyId]);
            if (last.rowCount && Date.now() - new Date(last.rows[0].saved_at).getTime() < AppStateService_1.HISTORY_EVERY_MS)
                return;
            if (last.rowCount && new Date(last.rows[0].saved_at).getTime() === new Date(row.updated_at).getTime())
                return;
        }
        await this.db.query('INSERT INTO app_state_history (organization_id, property_id, data, size_bytes, label, saved_at) VALUES ($1,$2,$3::jsonb,$4,$5,$6)', [orgId, propertyId, JSON.stringify(row.data), row.size_bytes, label, row.updated_at]);
        await this.db.query(`DELETE FROM app_state_history WHERE organization_id=$1 AND property_id=$2 AND id NOT IN
       (SELECT id FROM app_state_history WHERE organization_id=$1 AND property_id=$2 ORDER BY id DESC LIMIT ${AppStateService_1.HISTORY_KEEP})`, [orgId, propertyId]);
    }
    async summary(user) {
        if (!user.organizationId)
            throw new common_1.ForbiddenException('El usuario no pertenece a una organización.');
        const r = await this.db.query(`SELECT p.id, p.name, s.updated_at, s.size_bytes,
              (SELECT count(*) FROM app_state_history h WHERE h.organization_id = p.organization_id AND h.property_id = p.id) AS versions
         FROM properties p LEFT JOIN app_state_snapshots s ON s.property_id = p.id AND s.organization_id = p.organization_id
        WHERE p.organization_id = $1 ORDER BY s.updated_at DESC NULLS LAST, p.name`, [user.organizationId]);
        return r.rows.map((x) => ({ id: x.id, name: x.name, updatedAt: x.updated_at, sizeBytes: x.size_bytes, versions: Number(x.versions) }));
    }
    async history(user, propertyId) {
        await this.assertProperty(user, propertyId);
        const cur = await this.db.query('SELECT size_bytes, updated_at, data->>\'origin\' AS origin FROM app_state_snapshots WHERE organization_id=$1 AND property_id=$2', [user.organizationId, propertyId]);
        const h = await this.db.query('SELECT id, size_bytes, label, saved_at, data->>\'origin\' AS origin FROM app_state_history WHERE organization_id=$1 AND property_id=$2 ORDER BY id DESC', [user.organizationId, propertyId]);
        const items = [];
        if (cur.rowCount)
            items.push({ id: 'current', label: 'Última copia (vigente)', savedAt: cur.rows[0].updated_at, sizeBytes: cur.rows[0].size_bytes, origin: cur.rows[0].origin });
        h.rows.forEach((x) => items.push({ id: String(x.id), label: x.label || 'Versión anterior', savedAt: x.saved_at, sizeBytes: x.size_bytes, origin: x.origin }));
        return { items };
    }
    async historyItem(user, propertyId, id) {
        if (id === 'current')
            return this.load(user, propertyId, false);
        await this.assertProperty(user, propertyId);
        const r = await this.db.query('SELECT data, saved_at FROM app_state_history WHERE id=$1 AND organization_id=$2 AND property_id=$3', [Number(id) || 0, user.organizationId, propertyId]);
        if (!r.rowCount)
            return { exists: false };
        return { exists: true, data: r.rows[0].data, updatedAt: r.rows[0].saved_at };
    }
    async deleteHistoryItem(user, propertyId, id) {
        await this.assertProperty(user, propertyId);
        const r = await this.db.query('DELETE FROM app_state_history WHERE id=$1 AND organization_id=$2 AND property_id=$3', [Number(id) || 0, user.organizationId, propertyId]);
        return { deleted: r.rowCount || 0 };
    }
    async save(user, propertyId, data, label) {
        await this.assertProperty(user, propertyId);
        if (!data || typeof data !== 'object' || Array.isArray(data))
            throw new common_1.BadRequestException('Formato de copia inválido.');
        const json = JSON.stringify(data);
        if (json.length > 12 * 1024 * 1024)
            throw new common_1.BadRequestException('La copia supera 12 MB.');
        await this.archiveCurrent(user.organizationId, propertyId, label || null, !!label);
        const r = await this.db.query(`INSERT INTO app_state_snapshots (organization_id, property_id, data, size_bytes, updated_by, updated_at)
       VALUES ($1,$2,$3::jsonb,$4,$5,now())
       ON CONFLICT (organization_id, property_id)
       DO UPDATE SET prev_data = app_state_snapshots.data, prev_updated_at = app_state_snapshots.updated_at,
         data = EXCLUDED.data, size_bytes = EXCLUDED.size_bytes, updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING updated_at`, [user.organizationId, propertyId, json, json.length, user.id ?? user.sub ?? null]);
        return { ok: true, sizeBytes: json.length, updatedAt: r.rows[0].updated_at };
    }
    async load(user, propertyId, previous = false) {
        await this.assertProperty(user, propertyId);
        const r = await this.db.query('SELECT data, size_bytes, updated_at, prev_data, prev_updated_at FROM app_state_snapshots WHERE organization_id = $1 AND property_id = $2', [user.organizationId, propertyId]);
        if (!r.rowCount)
            return { exists: false };
        const row = r.rows[0];
        if (previous) {
            if (!row.prev_data)
                return { exists: false };
            return { exists: true, previous: true, data: row.prev_data, updatedAt: row.prev_updated_at };
        }
        return { exists: true, data: row.data, sizeBytes: row.size_bytes, updatedAt: row.updated_at, hasPrevious: !!row.prev_data };
    }
    async info(user, propertyId) {
        await this.assertProperty(user, propertyId);
        const r = await this.db.query('SELECT size_bytes, updated_at FROM app_state_snapshots WHERE organization_id = $1 AND property_id = $2', [user.organizationId, propertyId]);
        return r.rowCount ? { exists: true, sizeBytes: r.rows[0].size_bytes, updatedAt: r.rows[0].updated_at } : { exists: false };
    }
};
exports.AppStateService = AppStateService;
exports.AppStateService = AppStateService = AppStateService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], AppStateService);
//# sourceMappingURL=app-state.service.js.map