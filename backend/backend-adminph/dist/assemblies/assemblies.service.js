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
exports.AssembliesService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const database_service_1 = require("../database/database.service");
const access_service_1 = require("../common/access.service");
const qr_token_service_1 = require("../common/qr-token.service");
const audit_service_1 = require("../audit/audit.service");
let AssembliesService = class AssembliesService {
    db;
    access;
    qr;
    audit;
    constructor(db, access, qr, audit) {
        this.db = db;
        this.access = access;
        this.qr = qr;
        this.audit = audit;
    }
    async listForProperty(user, propertyId) {
        await this.access.ensureProperty(user, propertyId);
        const operatorOnly = user.roles.includes('operador') && !user.roles.includes('admin') && !user.roles.includes('superadmin');
        const q = await this.db.query(`SELECT a.id,a.property_id,a.name,a.status,to_jsonb(a) AS raw
       FROM assemblies a
       WHERE a.property_id=$1
         AND ($2::boolean=false OR EXISTS(
           SELECT 1 FROM assembly_users au WHERE au.assembly_id=a.id AND au.user_id=$3
         ))
       ORDER BY CASE WHEN lower(COALESCE(a.status,''))='active' THEN 0 ELSE 1 END,
                a.name NULLS LAST,a.id`, [propertyId, operatorOnly, user.id]);
        return q.rows.map((r) => ({
            id: r.id,
            propertyId: r.property_id,
            name: r.name || 'Asamblea',
            status: r.status || '',
            active: String(r.status || '').toLowerCase() === 'active',
            raw: r.raw || {},
        }));
    }
    async currentForProperty(user, propertyId) {
        const rows = await this.listForProperty(user, propertyId);
        if (!rows.length)
            return null;
        return rows.find((x) => x.active) || rows[0];
    }
    async createAssembly(user, dto) {
        return this.db.transaction(async (client) => {
            const result = await client.query(`
      INSERT INTO assemblies
      (
        property_id,
        name,
        assembly_type,
        meeting_date,
        meeting_time,
        status,
        quorum_percentage,
        created_by
      )
      VALUES
      ($1,$2,$3,$4,$5,'preparation',50,$6)
      RETURNING *
      `, [
                dto.propertyId,
                dto.name,
                dto.assemblyType || 'ordinaria',
                dto.meetingDate || null,
                dto.meetingTime || null,
                user.id
            ]);
            const assembly = result.rows[0];
            await client.query(`
  INSERT INTO assembly_users
  (
    assembly_id,
    user_id,
    assigned_role
  )
  VALUES
  ($1,$2,'admin')
  ON CONFLICT DO NOTHING
  `, [
                assembly.id,
                user.id
            ]);
            const agendaItems = [
                ['Verificación del Quórum', 'quorum'],
                ['Nombramiento presidente de asamblea', 'presidente'],
                ['Nombramiento secretario de asamblea', 'secretario'],
                ['Aprobación del orden del día', 'personalizado'],
                ['Designación comisión verificadora del acta', 'comite'],
                ['Aprobación del acta anterior', 'acta'],
                ['Informe de administración y consejo', 'informe'],
                ['Informe de revisoría fiscal', 'revisor'],
                ['Aprobación estados financieros', 'financieros'],
                ['Aprobación presupuesto y cuota', 'presupuesto'],
                ['Informe jurídico', 'juridico'],
                ['Nombramiento consejo de administración', 'consejo'],
                ['Nombramiento comité de convivencia', 'convivencia'],
                ['Nombramiento revisor fiscal', 'revisorFiscal'],
                ['Proposiciones y varios', 'proposiciones'],
                ['Votaciones adicionales (fuera del orden del día)', 'votacionesExtra'],
                ['Cierre de la asamblea', 'cierre'],
            ];
            for (let i = 0; i < agendaItems.length; i++) {
                await client.query(`
        INSERT INTO agenda_items
        (
          assembly_id,
          position,
          title,
          item_type,
          outside_agenda
        )
        VALUES
        ($1,$2,$3,$4,$5)
        `, [
                    assembly.id,
                    i + 1,
                    agendaItems[i][0],
                    agendaItems[i][1],
                    agendaItems[i][1] === 'votacionesExtra'
                ]);
            }
            return assembly;
        });
    }
    async provisionQrInventory(user, assemblyId, requestMeta) {
        const assembly = await this.access.ensureAssembly(user, assemblyId);
        const result = await this.db.transaction(async (client) => {
            const unitsQ = await client.query(`SELECT u.id,
                EXISTS(
                  SELECT 1 FROM attendance a
                  WHERE a.assembly_id=$1 AND a.unit_id=u.id AND a.attended=true
                ) AS attended
         FROM units u
         WHERE u.property_id=(SELECT property_id FROM assemblies WHERE id=$1)
           AND COALESCE(u.active,true)=true
         ORDER BY u.row_number NULLS LAST,u.unit_number`, [assemblyId]);
            let created = 0;
            let reused = 0;
            for (const unit of unitsQ.rows) {
                const existing = await client.query(`SELECT id,active
           FROM qr_tokens
           WHERE assembly_id=$1 AND unit_id=$2 AND revoked_at IS NULL
           ORDER BY created_at DESC LIMIT 1`, [assemblyId, unit.id]);
                const shouldBeActive = unit.attended === true;
                if (existing.rowCount) {
                    reused++;
                    if (existing.rows[0].active !== shouldBeActive) {
                        await client.query(`UPDATE qr_tokens SET active=$3 WHERE id=$1 AND assembly_id=$2`, [existing.rows[0].id, assemblyId, shouldBeActive]);
                    }
                }
                else {
                    const id = (0, crypto_1.randomUUID)();
                    const token = this.qr.build(id);
                    await client.query(`INSERT INTO qr_tokens(id,assembly_id,unit_id,token_hash,active,created_at)
             VALUES($1,$2,$3,$4,$5,NOW())`, [id, assemblyId, unit.id, this.qr.hash(token), shouldBeActive]);
                    created++;
                }
            }
            await this.audit.write({
                organizationId: assembly.organization_id,
                assemblyId,
                userId: user.id,
                action: 'QR_INVENTORY_PROVISIONED',
                entityType: 'assembly',
                entityId: assemblyId,
                newValues: { units: unitsQ.rowCount, created, reused },
                ipAddress: requestMeta.ip,
                userAgent: requestMeta.userAgent,
            }, client);
            return { units: unitsQ.rowCount, created, reused };
        });
        return { ...result, qr: await this.listQr(user, assemblyId) };
    }
    async changeStatus(user, assemblyId, target, requestMeta) {
        const assembly = await this.access.ensureAssembly(user, assemblyId);
        const current = String(assembly.status || '').toLowerCase();
        if (current === target)
            return { id: assemblyId, status: current, changed: false, closedSessions: 0 };
        const allowedFrom = target === 'active' ? ['preparation'] : ['active'];
        if (!allowedFrom.includes(current)) {
            throw new common_1.BadRequestException(`No se puede pasar la asamblea de "${current}" a "${target}"`);
        }
        return this.db.transaction(async (client) => {
            const up = await client.query(target === 'active'
                ? `UPDATE assemblies SET status='active',opened_at=COALESCE(opened_at,NOW()),updated_at=NOW()
             WHERE id=$1 RETURNING id,status,opened_at,closed_at`
                : `UPDATE assemblies SET status='closed',closed_at=NOW(),updated_at=NOW()
             WHERE id=$1 RETURNING id,status,opened_at,closed_at`, [assemblyId]);
            let closedSessions = 0;
            if (target === 'closed') {
                const cs = await client.query(`UPDATE voting_sessions SET status='closed',closed_at=NOW(),closed_by=$2
           WHERE assembly_id=$1 AND status='open'`, [assemblyId, user.id]);
                closedSessions = cs.rowCount ?? 0;
            }
            await this.audit.write({
                organizationId: assembly.organization_id,
                assemblyId,
                userId: user.id,
                action: target === 'active' ? 'ASSEMBLY_STARTED' : 'ASSEMBLY_CLOSED',
                entityType: 'assembly',
                entityId: assemblyId,
                oldValues: { status: current },
                newValues: up.rows[0],
                ipAddress: requestMeta.ip,
                userAgent: requestMeta.userAgent,
            }, client);
            return { ...up.rows[0], changed: true, closedSessions };
        });
    }
    async attendance(user, assemblyId) {
        await this.access.ensureAssembly(user, assemblyId);
        const q = await this.db.query(`SELECT a.id,a.unit_id,a.person_id,COALESCE(a.attended,false) AS attended,
              COALESCE(a.attendance_role,'owner') AS attendance_role,
              a.attendee_name_snapshot,a.attendee_document_snapshot,
              a.verification_method,a.registered_at,a.notes,
              u.id AS source_unit_id,u.unit_number,u.row_number,u.total_coefficient,
              qt.id AS qr_id,qt.active AS qr_active,qt.created_at AS qr_created_at
       FROM units u
       LEFT JOIN attendance a
         ON a.assembly_id=$1 AND a.unit_id=u.id
       LEFT JOIN LATERAL (
         SELECT id,active,created_at FROM qr_tokens q
         WHERE q.assembly_id=$1 AND q.unit_id=u.id AND q.active=true
         ORDER BY q.created_at DESC LIMIT 1
       ) qt ON true
       WHERE u.property_id=(SELECT property_id FROM assemblies WHERE id=$1)
         AND COALESCE(u.active,true)=true
       ORDER BY u.row_number NULLS LAST,u.unit_number`, [assemblyId]);
        return q.rows.map((r) => ({
            ...r,
            unit_id: r.unit_id || r.source_unit_id,
            qrToken: r.qr_id && r.qr_active ? this.qr.build(r.qr_id) : null,
            qrUrl: r.qr_id && r.qr_active ? this.qr.url(this.qr.build(r.qr_id)) : null,
        }));
    }
    async upsertAttendance(user, assemblyId, unitId, dto, requestMeta) {
        const assembly = await this.access.ensureAssembly(user, assemblyId);
        return this.db.transaction(async (client) => {
            const unitQ = await client.query(`SELECT u.id,u.unit_number,u.total_coefficient,
                p.id AS owner_person_id,
                COALESCE(NULLIF(u.owner_name,''),p.full_name) AS owner_name,
                COALESCE(NULLIF(u.owner_document,''),p.document_number) AS owner_document
         FROM units u
         LEFT JOIN LATERAL (
           SELECT p.id,p.full_name,p.document_number
           FROM unit_owners uo JOIN persons p ON p.id=uo.person_id
           WHERE uo.unit_id=u.id AND (uo.end_date IS NULL OR uo.end_date>=CURRENT_DATE)
           ORDER BY uo.is_primary DESC,uo.created_at ASC LIMIT 1
         ) p ON true
         WHERE u.id=$1 AND u.property_id=(SELECT property_id FROM assemblies WHERE id=$2)`, [unitId, assemblyId]);
            if (!unitQ.rowCount)
                throw new common_1.NotFoundException('Unidad no pertenece a esta asamblea');
            const unit = unitQ.rows[0];
            const role = dto.attendanceRole || 'owner';
            let personId = dto.personId || null;
            let name = dto.attendeeName?.trim() || null;
            let document = dto.attendeeDocument?.trim() || null;
            if (dto.attended && role === 'owner') {
                personId = personId || unit.owner_person_id;
                name = name || unit.owner_name;
                document = document || unit.owner_document;
                if (!name)
                    throw new common_1.BadRequestException('La unidad no tiene propietario principal; indique attendeeName');
            }
            if (dto.attended && role === 'proxy' && (!name || !document)) {
                throw new common_1.BadRequestException('Para apoderado se requieren nombre y documento');
            }
            const oldQ = await client.query('SELECT * FROM attendance WHERE assembly_id=$1 AND unit_id=$2', [assemblyId, unitId]);
            const attQ = await client.query(`INSERT INTO attendance
         (assembly_id,unit_id,person_id,attended,attendance_role,attendee_name_snapshot,attendee_document_snapshot,verification_method,registered_by,registered_at,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $4 THEN NOW() ELSE NULL END,$10)
         ON CONFLICT (assembly_id,unit_id) DO UPDATE SET
           person_id=EXCLUDED.person_id, attended=EXCLUDED.attended, attendance_role=EXCLUDED.attendance_role,
           attendee_name_snapshot=EXCLUDED.attendee_name_snapshot, attendee_document_snapshot=EXCLUDED.attendee_document_snapshot,
           verification_method=EXCLUDED.verification_method, registered_by=EXCLUDED.registered_by,
           registered_at=CASE WHEN EXCLUDED.attended THEN COALESCE(attendance.registered_at,NOW()) ELSE NULL END,
           notes=EXCLUDED.notes
         RETURNING *`, [assemblyId, unitId, personId, dto.attended, role, name, document, dto.verificationMethod || 'operator', user.id, dto.notes || null]);
            let qrResult = null;
            if (dto.attended) {
                const existing = await client.query(`SELECT id FROM qr_tokens
           WHERE assembly_id=$1 AND unit_id=$2 AND revoked_at IS NULL
           ORDER BY created_at DESC LIMIT 1`, [assemblyId, unitId]);
                let qrId;
                if (existing.rowCount) {
                    qrId = existing.rows[0].id;
                    await client.query('UPDATE qr_tokens SET active=true WHERE id=$1', [qrId]);
                }
                else {
                    qrId = (0, crypto_1.randomUUID)();
                    const token = this.qr.build(qrId);
                    await client.query(`INSERT INTO qr_tokens(id,assembly_id,unit_id,token_hash,active,created_at)
             VALUES($1,$2,$3,$4,true,NOW())`, [qrId, assemblyId, unitId, this.qr.hash(token)]);
                }
                const token = this.qr.build(qrId);
                qrResult = { id: qrId, token, url: this.qr.url(token), active: true };
            }
            else {
                await client.query(`UPDATE qr_tokens SET active=false
           WHERE assembly_id=$1 AND unit_id=$2 AND active=true AND revoked_at IS NULL`, [assemblyId, unitId]);
            }
            await this.audit.write({
                organizationId: assembly.organization_id, assemblyId, userId: user.id,
                action: dto.attended ? 'ATTENDANCE_MARKED_PRESENT' : 'ATTENDANCE_MARKED_ABSENT',
                entityType: 'attendance', entityId: attQ.rows[0].id,
                oldValues: oldQ.rows[0] || null, newValues: attQ.rows[0],
                ipAddress: requestMeta.ip, userAgent: requestMeta.userAgent,
            }, client);
            return { attendance: attQ.rows[0], qr: qrResult };
        });
    }
    async listQr(user, assemblyId) {
        await this.access.ensureAssembly(user, assemblyId);
        const operatorOnly = user.roles.includes('operador') && !user.roles.includes('admin') && !user.roles.includes('superadmin');
        const q = await this.db.query(`SELECT qt.id,qt.unit_id,qt.active,qt.created_at,qt.last_used_at,qt.revoked_at,
              u.unit_number,u.row_number,u.owner_name,u.owner_document,
              a.attended,a.attendance_role,a.attendee_name_snapshot,a.attendee_document_snapshot
       FROM qr_tokens qt
JOIN units u ON u.id=qt.unit_id
LEFT JOIN attendance a 
  ON a.assembly_id=qt.assembly_id 
 AND a.unit_id=qt.unit_id
       WHERE qt.assembly_id=$1
         AND qt.revoked_at IS NULL
         AND ($2::boolean=false OR (qt.active=true AND a.attended=true))
       ORDER BY u.row_number NULLS LAST,u.unit_number,qt.created_at DESC`, [assemblyId, operatorOnly]);
        return q.rows.map((r) => {
            const token = this.qr.build(r.id);
            return {
                ...r,
                token,
                url: this.qr.url(token),
            };
        });
    }
    async reissueQr(user, assemblyId, unitId, requestMeta) {
        const assembly = await this.access.ensureAssembly(user, assemblyId);
        return this.db.transaction(async (client) => {
            const a = await client.query('SELECT * FROM attendance WHERE assembly_id=$1 AND unit_id=$2 AND attended=true', [assemblyId, unitId]);
            if (!a.rowCount)
                throw new common_1.BadRequestException('Solo se puede emitir QR a una unidad presente');
            await client.query(`UPDATE qr_tokens SET active=false,revoked_at=NOW(),revoked_by=$3 WHERE assembly_id=$1 AND unit_id=$2 AND active=true`, [assemblyId, unitId, user.id]);
            const id = (0, crypto_1.randomUUID)();
            const token = this.qr.build(id);
            await client.query(`INSERT INTO qr_tokens(id,assembly_id,unit_id,token_hash,active) VALUES($1,$2,$3,$4,true)`, [id, assemblyId, unitId, this.qr.hash(token)]);
            await this.audit.write({ organizationId: assembly.organization_id, assemblyId, userId: user.id, action: 'QR_REISSUED', entityType: 'qr_token', entityId: id, newValues: { unitId }, ipAddress: requestMeta.ip, userAgent: requestMeta.userAgent }, client);
            return { id, token, url: this.qr.url(token), active: true };
        });
    }
};
exports.AssembliesService = AssembliesService;
exports.AssembliesService = AssembliesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        access_service_1.AccessService,
        qr_token_service_1.QrTokenService,
        audit_service_1.AuditService])
], AssembliesService);
//# sourceMappingURL=assemblies.service.js.map