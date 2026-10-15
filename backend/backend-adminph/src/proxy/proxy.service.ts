import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { AccessService } from '../common/access.service';
import { AuthUser } from '../common/auth-user.interface';

/**
 * V3.7 — Apoderado con varias unidades y UN solo QR.
 * El QR pertenece a la unidad "principal" del apoderado. Al votar con ese QR, el voto se registra una vez
 * por cada unidad representada (cada una con su propio coeficiente), de modo que los resultados, el
 * conteo por coeficiente y la regla "una papeleta por unidad" siguen funcionando igual.
 */
@Injectable()
export class ProxyService implements OnModuleInit {
  private readonly log = new Logger('Proxy');
  constructor(private readonly db: DatabaseService, private readonly access: AccessService) {}

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

  /** Reemplaza TODOS los grupos de apoderados de la asamblea. */
  async putGroups(user: AuthUser, assemblyId: string, groups: any[]) {
    await this.access.ensureAssembly(user, assemblyId);
    if (!Array.isArray(groups)) throw new BadRequestException('Formato inválido');
    if (groups.length > 500) throw new BadRequestException('Demasiados grupos');
    const prop = await this.db.query('SELECT property_id FROM assemblies WHERE id=$1', [assemblyId]);
    const propertyId = prop.rows[0]?.property_id;
    const seen = new Set<string>();
    const rows: { unit: string; principal: string; name: string; doc: string }[] = [];
    for (const g of groups) {
      const principal = String(g?.principalUnitId || '');
      const ids: string[] = Array.isArray(g?.unitIds) ? g.unitIds.map(String) : [];
      if (!principal || !ids.length) continue;
      if (seen.has(principal)) throw new BadRequestException('Una unidad principal aparece en dos grupos');
      seen.add(principal);
      for (const id of ids) {
        if (id === principal) continue;
        if (seen.has(id)) throw new BadRequestException('Una unidad está asignada a dos apoderados');
        seen.add(id);
        rows.push({ unit: id, principal, name: String(g?.name || '').slice(0, 200), doc: String(g?.document || '').slice(0, 60) });
      }
    }
    const all = [...seen];
    if (all.length) {
      const ok = await this.db.query('SELECT count(*)::int AS n FROM units WHERE property_id=$1 AND id = ANY($2::uuid[])', [propertyId, all]);
      if (ok.rows[0].n !== all.length) throw new BadRequestException('Alguna unidad no pertenece al conjunto de la asamblea');
    }
    await this.db.transaction(async (c) => {
      await c.query('DELETE FROM assembly_proxy_units WHERE assembly_id=$1', [assemblyId]);
      for (const r of rows) {
        await c.query('INSERT INTO assembly_proxy_units (assembly_id, unit_id, principal_unit_id, proxy_name, proxy_document) VALUES ($1,$2,$3,$4,$5)', [assemblyId, r.unit, r.principal, r.name, r.doc]);
      }
    });
    return { ok: true, groups: new Set(rows.map((r) => r.principal)).size, unitsRepresented: rows.length };
  }

  async getGroups(user: AuthUser, assemblyId: string) {
    await this.access.ensureAssembly(user, assemblyId);
    const r = await this.db.query(
      `SELECT p.principal_unit_id, p.unit_id, p.proxy_name, p.proxy_document FROM assembly_proxy_units p WHERE p.assembly_id=$1 ORDER BY p.principal_unit_id`, [assemblyId]);
    return r.rows;
  }

  /** ¿Esta unidad está representada por el QR de otra? (devuelve la principal) */
  async principalOf(client: PoolClient, assemblyId: string, unitId: string): Promise<string | null> {
    const r = await client.query('SELECT principal_unit_id FROM assembly_proxy_units WHERE assembly_id=$1 AND unit_id=$2', [assemblyId, unitId]);
    return r.rowCount ? r.rows[0].principal_unit_id : null;
  }

  /** Unidades representadas por la principal (con datos para votar). */
  async represented(client: PoolClient | DatabaseService, assemblyId: string, principalUnitId: string) {
    const q = `SELECT u.id AS unit_id, u.unit_number, u.total_coefficient, a.id AS attendance_id, a.person_id, a.attended,
                      a.attendee_name_snapshot, a.attendee_document_snapshot
                 FROM assembly_proxy_units p
                 JOIN units u ON u.id = p.unit_id
                 LEFT JOIN attendance a ON a.assembly_id = p.assembly_id AND a.unit_id = p.unit_id
                WHERE p.assembly_id=$1 AND p.principal_unit_id=$2
                ORDER BY u.row_number NULLS LAST, u.unit_number`;
    const r = await (client as any).query(q, [assemblyId, principalUnitId]);
    return r.rows as any[];
  }
}
