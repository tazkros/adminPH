import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuthUser } from './auth-user.interface';

@Injectable()
export class AccessService {
  constructor(private readonly db: DatabaseService) {}

  async ensureProperty(user: AuthUser, propertyId: string) {
    const q = await this.db.query(
      `SELECT p.id, p.organization_id, to_jsonb(p) AS raw
       FROM properties p
       WHERE p.id=$1`, [propertyId],
    );
    if (!q.rowCount) throw new NotFoundException('Conjunto no encontrado');
    const row = q.rows[0];
    if (user.roles.includes('superadmin')) return row;
    if (!user.organizationId || row.organization_id !== user.organizationId) {
      throw new ForbiddenException('Conjunto fuera de su organización');
    }
    return row;
  }

  async ensureAssembly(user: AuthUser, assemblyId: string) {
    const q = await this.db.query(
      `SELECT a.id, a.status, p.organization_id,
              EXISTS(SELECT 1 FROM assembly_users au WHERE au.assembly_id=a.id AND au.user_id=$2) AS assigned
       FROM assemblies a JOIN properties p ON p.id=a.property_id
       WHERE a.id=$1`, [assemblyId, user.id],
    );
    if (!q.rowCount) throw new NotFoundException('Asamblea no encontrada');
    const row = q.rows[0];
    if (user.roles.includes('superadmin')) return row;
    if (!user.organizationId || row.organization_id !== user.organizationId) throw new ForbiddenException('Asamblea fuera de su organización');
    if (user.roles.includes('operador') && !user.roles.includes('admin') && !row.assigned) {
      throw new ForbiddenException('Operador no asignado a esta asamblea');
    }
    return row;
  }
}
