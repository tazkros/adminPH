import { BadRequestException, ForbiddenException, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthUser } from '../common/auth-user.interface';

/**
 * PATCH V3 — Copia de seguridad del estado de la aplicación en PostgreSQL.
 * Guarda como un único JSON (por organización y conjunto) lo que la parte antigua de
 * AdminPH mantiene en el navegador: configuración, unidades, asistencia, orden del día,
 * votaciones (incluida la mano alzada) y cierre. La tabla se crea sola si no existe.
 */
@Injectable()
export class AppStateService implements OnModuleInit {
  private readonly log = new Logger('AppState');
  constructor(private readonly db: DatabaseService) {}

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

  private async assertProperty(user: AuthUser, propertyId: string) {
    if (!user.organizationId) throw new ForbiddenException('El usuario no pertenece a una organización.');
    const r = await this.db.query('SELECT 1 FROM properties WHERE id = $1 AND organization_id = $2', [propertyId, user.organizationId]);
    if (!r.rowCount) throw new ForbiddenException('El conjunto no pertenece a su organización.');
  }

  private static readonly HISTORY_KEEP = 20;
  private static readonly HISTORY_EVERY_MS = 3 * 60 * 1000;

  /** Archiva la copia vigente en el historial (como mucho una cada 3 min, o siempre si es manual). */
  private async archiveCurrent(orgId: string, propertyId: string, label: string | null, always: boolean) {
    const cur = await this.db.query('SELECT data, size_bytes, updated_at FROM app_state_snapshots WHERE organization_id=$1 AND property_id=$2', [orgId, propertyId]);
    if (!cur.rowCount) return;
    const row = cur.rows[0];
    if (!always) {
      const last = await this.db.query('SELECT saved_at FROM app_state_history WHERE organization_id=$1 AND property_id=$2 ORDER BY id DESC LIMIT 1', [orgId, propertyId]);
      if (last.rowCount && Date.now() - new Date(last.rows[0].saved_at).getTime() < AppStateService.HISTORY_EVERY_MS) return;
      if (last.rowCount && new Date(last.rows[0].saved_at).getTime() === new Date(row.updated_at).getTime()) return;
    }
    await this.db.query(
      'INSERT INTO app_state_history (organization_id, property_id, data, size_bytes, label, saved_at) VALUES ($1,$2,$3::jsonb,$4,$5,$6)',
      [orgId, propertyId, JSON.stringify(row.data), row.size_bytes, label, row.updated_at],
    );
    await this.db.query(
      `DELETE FROM app_state_history WHERE organization_id=$1 AND property_id=$2 AND id NOT IN
       (SELECT id FROM app_state_history WHERE organization_id=$1 AND property_id=$2 ORDER BY id DESC LIMIT ${AppStateService.HISTORY_KEEP})`,
      [orgId, propertyId],
    );
  }

  /** Conjuntos de la organización con la fecha de su última copia (para restaurar sin depender del nombre). */
  async summary(user: AuthUser) {
    if (!user.organizationId) throw new ForbiddenException('El usuario no pertenece a una organización.');
    const r = await this.db.query(
      `SELECT p.id, p.name, s.updated_at, s.size_bytes,
              (SELECT count(*) FROM app_state_history h WHERE h.organization_id = p.organization_id AND h.property_id = p.id) AS versions
         FROM properties p LEFT JOIN app_state_snapshots s ON s.property_id = p.id AND s.organization_id = p.organization_id
        WHERE p.organization_id = $1 ORDER BY s.updated_at DESC NULLS LAST, p.name`,
      [user.organizationId],
    );
    return r.rows.map((x: any) => ({ id: x.id, name: x.name, updatedAt: x.updated_at, sizeBytes: x.size_bytes, versions: Number(x.versions) }));
  }

  async history(user: AuthUser, propertyId: string) {
    await this.assertProperty(user, propertyId);
    const cur = await this.db.query('SELECT size_bytes, updated_at, data->>\'origin\' AS origin FROM app_state_snapshots WHERE organization_id=$1 AND property_id=$2', [user.organizationId, propertyId]);
    const h = await this.db.query(
      'SELECT id, size_bytes, label, saved_at, data->>\'origin\' AS origin FROM app_state_history WHERE organization_id=$1 AND property_id=$2 ORDER BY id DESC',
      [user.organizationId, propertyId],
    );
    const items: any[] = [];
    if (cur.rowCount) items.push({ id: 'current', label: 'Última copia (vigente)', savedAt: cur.rows[0].updated_at, sizeBytes: cur.rows[0].size_bytes, origin: cur.rows[0].origin });
    h.rows.forEach((x: any) => items.push({ id: String(x.id), label: x.label || 'Versión anterior', savedAt: x.saved_at, sizeBytes: x.size_bytes, origin: x.origin }));
    return { items };
  }

  async historyItem(user: AuthUser, propertyId: string, id: string) {
    if (id === 'current') return this.load(user, propertyId, false);
    await this.assertProperty(user, propertyId);
    const r = await this.db.query('SELECT data, saved_at FROM app_state_history WHERE id=$1 AND organization_id=$2 AND property_id=$3', [Number(id) || 0, user.organizationId, propertyId]);
    if (!r.rowCount) return { exists: false };
    return { exists: true, data: r.rows[0].data, updatedAt: r.rows[0].saved_at };
  }

  async deleteHistoryItem(user: AuthUser, propertyId: string, id: string) {
    await this.assertProperty(user, propertyId);
    const r = await this.db.query('DELETE FROM app_state_history WHERE id=$1 AND organization_id=$2 AND property_id=$3', [Number(id) || 0, user.organizationId, propertyId]);
    return { deleted: r.rowCount || 0 };
  }

  async save(user: AuthUser, propertyId: string, data: Record<string, any>, label?: string) {
    await this.assertProperty(user, propertyId);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BadRequestException('Formato de copia inválido.');
    const json = JSON.stringify(data);
    if (json.length > 12 * 1024 * 1024) throw new BadRequestException('La copia supera 12 MB.');
    await this.archiveCurrent(user.organizationId as string, propertyId, label || null, !!label);
    const r = await this.db.query(
      `INSERT INTO app_state_snapshots (organization_id, property_id, data, size_bytes, updated_by, updated_at)
       VALUES ($1,$2,$3::jsonb,$4,$5,now())
       ON CONFLICT (organization_id, property_id)
       DO UPDATE SET prev_data = app_state_snapshots.data, prev_updated_at = app_state_snapshots.updated_at,
         data = EXCLUDED.data, size_bytes = EXCLUDED.size_bytes, updated_by = EXCLUDED.updated_by, updated_at = now()
       RETURNING updated_at`,
      [user.organizationId, propertyId, json, json.length, (user as any).id ?? (user as any).sub ?? null],
    );
    return { ok: true, sizeBytes: json.length, updatedAt: r.rows[0].updated_at };
  }

  async load(user: AuthUser, propertyId: string, previous = false) {
    await this.assertProperty(user, propertyId);
    const r = await this.db.query(
      'SELECT data, size_bytes, updated_at, prev_data, prev_updated_at FROM app_state_snapshots WHERE organization_id = $1 AND property_id = $2',
      [user.organizationId, propertyId],
    );
    if (!r.rowCount) return { exists: false };
    const row = r.rows[0];
    if (previous) {
      if (!row.prev_data) return { exists: false };
      return { exists: true, previous: true, data: row.prev_data, updatedAt: row.prev_updated_at };
    }
    return { exists: true, data: row.data, sizeBytes: row.size_bytes, updatedAt: row.updated_at, hasPrevious: !!row.prev_data };
  }

  async info(user: AuthUser, propertyId: string) {
    await this.assertProperty(user, propertyId);
    const r = await this.db.query(
      'SELECT size_bytes, updated_at FROM app_state_snapshots WHERE organization_id = $1 AND property_id = $2',
      [user.organizationId, propertyId],
    );
    return r.rowCount ? { exists: true, sizeBytes: r.rows[0].size_bytes, updatedAt: r.rows[0].updated_at } : { exists: false };
  }
}
