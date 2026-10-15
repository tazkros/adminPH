import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

export interface AuditInput {
  organizationId?: string | null;
  assemblyId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}

  async write(input: AuditInput, client?: PoolClient) {
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
}
