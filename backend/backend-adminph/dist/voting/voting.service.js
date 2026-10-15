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
exports.VotingService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const access_service_1 = require("../common/access.service");
const qr_token_service_1 = require("../common/qr-token.service");
const audit_service_1 = require("../audit/audit.service");
const proxy_service_1 = require("../proxy/proxy.service");
let VotingService = class VotingService {
    db;
    access;
    qr;
    audit;
    proxy;
    constructor(db, access, qr, audit, proxy) {
        this.db = db;
        this.access = access;
        this.qr = qr;
        this.audit = audit;
        this.proxy = proxy;
    }
    async create(user, assemblyId, dto) {
        const assembly = await this.access.ensureAssembly(user, assemblyId);
        const winnersRequired = dto.winnersRequired || null;
        const countingMethod = dto.countingMethod || 'nominal';
        const q = await this.db.query(`INSERT INTO voting_sessions
       (assembly_id,agenda_item_id,title,voting_type,input_mode,quorum_type,quorum_percentage,selection_multiple,winners_required,include_voter_details_in_minutes,multiple_winners)
       VALUES($1,$2,$3,$4,$5,$6,$7,FALSE,$8,$9,$10) RETURNING *`, [
            assemblyId,
            dto.agendaItemId || null,
            dto.title,
            countingMethod,
            dto.inputMode || 'qr',
            dto.quorumType || 'deliberatory',
            dto.quorumPercentage || 50,
            winnersRequired,
            dto.includeVoterDetailsInMinutes || false,
            Number(winnersRequired || 0) > 1,
        ]);
        await this.audit.write({
            organizationId: assembly.organization_id,
            assemblyId,
            userId: user.id,
            action: 'VOTING_CREATED',
            entityType: 'voting_session',
            entityId: q.rows[0].id,
            newValues: q.rows[0],
        });
        return q.rows[0];
    }
    async list(user, assemblyId) {
        await this.access.ensureAssembly(user, assemblyId);
        const q = await this.db.query(`SELECT vs.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id',vo.id,
                    'position',vo.position,
                    'label',vo.label,
                    'active',vo.active,
                    'isWinner',vo.is_winner
                  ) ORDER BY vo.position
                ) FILTER (WHERE vo.id IS NOT NULL),
                '[]'
              ) AS options
       FROM voting_sessions vs
       LEFT JOIN voting_options vo ON vo.voting_session_id=vs.id
       WHERE vs.assembly_id=$1
       GROUP BY vs.id
       ORDER BY vs.created_at`, [assemblyId]);
        return q.rows;
    }
    async update(user, sessionId, dto) {
        const s = await this.getSessionForStaff(user, sessionId);
        if (s.status === 'open') {
            throw new common_1.ConflictException('Cierre la votación antes de cambiar su configuración');
        }
        const q = await this.db.query(`UPDATE voting_sessions SET
         include_voter_details_in_minutes=COALESCE($2,include_voter_details_in_minutes),
         winners_required=COALESCE($3,winners_required),
         voting_type=COALESCE($4,voting_type),
         multiple_winners=CASE
           WHEN $3::int IS NULL THEN multiple_winners
           ELSE $3::int > 1
         END,
         selection_multiple=FALSE,
         updated_at=NOW()
       WHERE id=$1
       RETURNING *`, [sessionId, dto.includeVoterDetailsInMinutes, dto.winnersRequired, dto.countingMethod]);
        return q.rows[0];
    }
    async addOption(user, sessionId, dto) {
        const s = await this.getSessionForStaff(user, sessionId);
        if (s.status === 'open') {
            throw new common_1.ConflictException('No puede agregar opciones con la votación abierta');
        }
        const q = await this.db.query(`INSERT INTO voting_options(voting_session_id,position,label,option_type)
       VALUES(
         $1,
         (SELECT COALESCE(MAX(position),0)+1 FROM voting_options WHERE voting_session_id=$1),
         $2,
         $3
       )
       RETURNING *`, [sessionId, dto.label, dto.optionType || 'candidate']);
        return q.rows[0];
    }
    async open(user, sessionId, meta) {
        const s = await this.getSessionForStaff(user, sessionId);
        const count = await this.db.query('SELECT COUNT(*)::int n FROM voting_options WHERE voting_session_id=$1 AND active=true', [sessionId]);
        if (count.rows[0].n < 1) {
            throw new common_1.BadRequestException('Agregue al menos una opción');
        }
        const otra = await this.db.query(`SELECT id FROM voting_sessions
       WHERE assembly_id=$1 AND status='open' AND id<>$2 LIMIT 1`, [s.assembly_id, sessionId]);
        if (otra.rowCount) {
            throw new common_1.ConflictException('Hay otra votación abierta en esta asamblea. Ciérrela antes de abrir una nueva.');
        }
        const q = await this.db.query(`UPDATE voting_sessions
       SET status='open',opened_at=NOW(),closed_at=NULL,opened_by=$2
       WHERE id=$1 AND status<>'open'
       RETURNING *`, [sessionId, user.id]);
        if (!q.rowCount) {
            throw new common_1.ConflictException('La votación ya está abierta');
        }
        await this.audit.write({
            organizationId: s.organization_id,
            assemblyId: s.assembly_id,
            userId: user.id,
            action: 'VOTING_OPENED',
            entityType: 'voting_session',
            entityId: sessionId,
            newValues: q.rows[0],
            ipAddress: meta.ip,
            userAgent: meta.userAgent,
        });
        return q.rows[0];
    }
    async close(user, sessionId, meta) {
        const s = await this.getSessionForStaff(user, sessionId);
        const q = await this.db.query(`UPDATE voting_sessions
       SET status='closed',closed_at=NOW(),closed_by=$2
       WHERE id=$1 AND status='open'
       RETURNING *`, [sessionId, user.id]);
        if (!q.rowCount) {
            throw new common_1.ConflictException('La votación no está abierta');
        }
        await this.audit.write({
            organizationId: s.organization_id,
            assemblyId: s.assembly_id,
            userId: user.id,
            action: 'VOTING_CLOSED',
            entityType: 'voting_session',
            entityId: sessionId,
            newValues: q.rows[0],
            ipAddress: meta.ip,
            userAgent: meta.userAgent,
        });
        return q.rows[0];
    }
    async archive(user, sessionId, meta) {
        const s = await this.getSessionForStaff(user, sessionId);
        if (s.status === 'open') {
            throw new common_1.ConflictException('Cierre la votación antes de archivarla');
        }
        if (s.status === 'cancelled')
            return s;
        const q = await this.db.query(`UPDATE voting_sessions SET status='cancelled',updated_at=NOW()
       WHERE id=$1 AND status IN ('draft','closed') RETURNING *`, [sessionId]);
        if (!q.rowCount)
            throw new common_1.ConflictException('No se pudo archivar la votación');
        await this.audit.write({
            organizationId: s.organization_id,
            assemblyId: s.assembly_id,
            userId: user.id,
            action: 'VOTING_ARCHIVED',
            entityType: 'voting_session',
            entityId: sessionId,
            oldValues: { status: s.status },
            newValues: q.rows[0],
            ipAddress: meta.ip,
            userAgent: meta.userAgent,
        });
        return q.rows[0];
    }
    async setWinners(user, sessionId, optionIds, meta) {
        const s = await this.getSessionForStaff(user, sessionId);
        if (s.status === 'open') {
            throw new common_1.ConflictException('Cierre la votación antes de definir ganadores');
        }
        const unique = [...new Set(optionIds)];
        const required = Number(s.winners_required || 0);
        if (required < 1) {
            throw new common_1.BadRequestException('Esta votación no tiene configurada una cantidad de ganadores');
        }
        if (unique.length !== required) {
            throw new common_1.BadRequestException(`Debe seleccionar exactamente ${required} ganador(es)`);
        }
        return this.db.transaction(async (client) => {
            const valid = await client.query(`SELECT id
         FROM voting_options
         WHERE voting_session_id=$1 AND active=TRUE AND id=ANY($2::uuid[])`, [sessionId, unique]);
            if (valid.rowCount !== unique.length) {
                throw new common_1.BadRequestException('Uno o más candidatos/opciones no pertenecen a esta votación');
            }
            await client.query(`UPDATE voting_options
         SET is_winner=FALSE,winner_marked_at=NULL,winner_marked_by=NULL
         WHERE voting_session_id=$1`, [sessionId]);
            await client.query(`UPDATE voting_options
         SET is_winner=TRUE,winner_marked_at=NOW(),winner_marked_by=$3
         WHERE voting_session_id=$1 AND id=ANY($2::uuid[])`, [sessionId, unique, user.id]);
            await this.audit.write({
                organizationId: s.organization_id,
                assemblyId: s.assembly_id,
                userId: user.id,
                action: 'VOTING_WINNERS_SET',
                entityType: 'voting_session',
                entityId: sessionId,
                newValues: { optionIds: unique, winnersRequired: required },
                ipAddress: meta.ip,
                userAgent: meta.userAgent,
            }, client);
            const result = await client.query(`SELECT id,label,position,is_winner,winner_marked_at,winner_marked_by
         FROM voting_options
         WHERE voting_session_id=$1 AND active=TRUE
         ORDER BY position`, [sessionId]);
            return {
                sessionId,
                winnersRequired: required,
                winnersConfirmed: true,
                options: result.rows,
            };
        });
    }
    async publicAccess(token) {
        const tokenId = this.qr.parseAndVerify(token);
        const q = await this.db.query(`SELECT qt.id,qt.assembly_id,qt.unit_id,qt.active,qt.expires_at,
              u.unit_number,
              a.attended,a.attendance_role,a.attendee_name_snapshot,
              ass.name AS assembly_name,ass.status AS assembly_status
       FROM qr_tokens qt
       JOIN units u ON u.id=qt.unit_id
       JOIN assemblies ass ON ass.id=qt.assembly_id
       LEFT JOIN attendance a ON a.assembly_id=qt.assembly_id AND a.unit_id=qt.unit_id
       WHERE qt.id=$1`, [tokenId]);
        const r = q.rows[0];
        if (!r || !r.active || !r.attended || r.assembly_status !== 'active') {
            throw new common_1.UnauthorizedException('QR inactivo o sin asistencia vigente');
        }
        if (r.expires_at && new Date(r.expires_at).getTime() < Date.now()) {
            throw new common_1.UnauthorizedException('QR vencido');
        }
        const principal = await this.proxy.principalOf(this.db, r.assembly_id, r.unit_id);
        if (principal)
            throw new common_1.UnauthorizedException('Esta unidad está representada por un apoderado: debe votar con el QR del apoderado');
        const reps = await this.proxy.represented(this.db, r.assembly_id, r.unit_id);
        const own = await this.db.query('SELECT total_coefficient FROM units WHERE id=$1', [r.unit_id]);
        const proxyInfo = reps.length ? {
            units: [{ unitNumber: r.unit_number, coefficient: Number(own.rows[0]?.total_coefficient || 0) }, ...reps.map((x) => ({ unitNumber: x.unit_number, coefficient: Number(x.total_coefficient || 0) }))],
        } : null;
        if (proxyInfo)
            proxyInfo.totalCoefficient = proxyInfo.units.reduce((s2, x) => s2 + x.coefficient, 0);
        const sessions = await this.db.query(`SELECT vs.id,vs.title,vs.voting_type AS counting_method,vs.winners_required,vs.multiple_winners,
              COALESCE(
                json_agg(
                  json_build_object('id',vo.id,'label',vo.label,'position',vo.position)
                  ORDER BY vo.position
                ) FILTER (WHERE vo.id IS NOT NULL),
                '[]'
              ) options,
              EXISTS(
                SELECT 1
                FROM votes v
                WHERE v.voting_session_id=vs.id AND v.unit_id=$2
              ) AS already_voted
       FROM voting_sessions vs
       LEFT JOIN voting_options vo ON vo.voting_session_id=vs.id AND vo.active=true
       WHERE vs.assembly_id=$1
         AND vs.status='open'
         AND (vs.scheduled_close_at IS NULL OR vs.scheduled_close_at>NOW())
       GROUP BY vs.id
       ORDER BY vs.opened_at`, [r.assembly_id, r.unit_id]);
        return {
            assemblyId: r.assembly_id,
            assemblyName: r.assembly_name,
            unitId: r.unit_id,
            unitNumber: r.unit_number,
            attendeeName: r.attendee_name_snapshot,
            proxy: proxyInfo,
            sessions: sessions.rows,
        };
    }
    async castByQr(sessionId, token, optionId, meta) {
        const tokenId = this.qr.parseAndVerify(token);
        return this.db.transaction(async (client) => {
            const auth = await client.query(`SELECT qt.id,qt.assembly_id,qt.unit_id,qt.active,qt.expires_at,
                u.unit_number,u.total_coefficient,
                a.id AS attendance_id,a.person_id,a.attended,a.attendance_role,
                a.attendee_name_snapshot,a.attendee_document_snapshot,
                p.organization_id
         FROM qr_tokens qt
         JOIN units u ON u.id=qt.unit_id
         JOIN properties p ON p.id=u.property_id
         LEFT JOIN attendance a ON a.assembly_id=qt.assembly_id AND a.unit_id=qt.unit_id
         WHERE qt.id=$1
         FOR UPDATE OF qt`, [tokenId]);
            const voter = auth.rows[0];
            if (!voter || !voter.active || !voter.attended) {
                throw new common_1.UnauthorizedException('QR no autorizado');
            }
            if (voter.expires_at && new Date(voter.expires_at).getTime() < Date.now()) {
                throw new common_1.UnauthorizedException('QR vencido');
            }
            if (await this.proxy.principalOf(client, voter.assembly_id, voter.unit_id)) {
                throw new common_1.ForbiddenException('Esta unidad está representada por un apoderado: debe votar con el QR del apoderado');
            }
            const result = await this.castBallot(client, sessionId, voter, optionId, 'qr');
            result.unitsCounted = 1 + (await this.castForRepresented(client, sessionId, voter, optionId, 'qr'));
            await client.query('UPDATE qr_tokens SET last_used_at=NOW() WHERE id=$1', [tokenId]);
            await this.audit.write({
                organizationId: voter.organization_id,
                assemblyId: voter.assembly_id,
                userId: null,
                action: 'VOTE_CAST_QR',
                entityType: 'voting_session',
                entityId: sessionId,
                newValues: { unitId: voter.unit_id, optionId },
                ipAddress: meta.ip,
                userAgent: meta.userAgent,
            }, client);
            return result;
        });
    }
    async castManual(user, sessionId, unitId, optionId, meta) {
        const s = await this.getSessionForStaff(user, sessionId);
        return this.db.transaction(async (client) => {
            const vq = await client.query(`SELECT a.id AS attendance_id,a.assembly_id,a.unit_id,a.person_id,a.attended,a.attendance_role,
                a.attendee_name_snapshot,a.attendee_document_snapshot,
                u.unit_number,u.total_coefficient,
                $2::uuid AS organization_id
         FROM attendance a
         JOIN units u ON u.id=a.unit_id
         WHERE a.assembly_id=$1 AND a.unit_id=$3`, [s.assembly_id, s.organization_id, unitId]);
            const voter = vq.rows[0];
            if (!voter?.attended) {
                throw new common_1.BadRequestException('La unidad no está presente');
            }
            const result = await this.castBallot(client, sessionId, voter, optionId, 'manual');
            result.unitsCounted = 1 + (await this.castForRepresented(client, sessionId, voter, optionId, 'manual'));
            await this.audit.write({
                organizationId: s.organization_id,
                assemblyId: s.assembly_id,
                userId: user.id,
                action: 'VOTE_CAST_MANUAL',
                entityType: 'voting_session',
                entityId: sessionId,
                newValues: { unitId, optionId },
                ipAddress: meta.ip,
                userAgent: meta.userAgent,
            }, client);
            return result;
        });
    }
    async castForRepresented(client, sessionId, principalVoter, optionId, method) {
        const reps = await this.proxy.represented(client, principalVoter.assembly_id, principalVoter.unit_id);
        let n = 0;
        for (const x of reps) {
            if (!x.attended)
                continue;
            const v = {
                assembly_id: principalVoter.assembly_id, unit_id: x.unit_id, person_id: x.person_id || null, attendance_id: x.attendance_id,
                total_coefficient: x.total_coefficient, attendee_name_snapshot: principalVoter.attendee_name_snapshot,
                attendee_document_snapshot: principalVoter.attendee_document_snapshot, unit_number: x.unit_number,
            };
            try {
                await this.castBallot(client, sessionId, v, optionId, method);
                n++;
            }
            catch (e) {
                if (!(e instanceof common_1.ConflictException))
                    throw e;
            }
        }
        return n;
    }
    async castBallot(client, sessionId, voter, optionId, method) {
        const sq = await client.query('SELECT * FROM voting_sessions WHERE id=$1 FOR UPDATE', [sessionId]);
        const session = sq.rows[0];
        if (!session || session.assembly_id !== voter.assembly_id) {
            throw new common_1.ForbiddenException('Votación no corresponde a este QR/unidad');
        }
        if (session.status !== 'open') {
            throw new common_1.ConflictException('Votación cerrada');
        }
        if (session.scheduled_close_at && new Date(session.scheduled_close_at).getTime() <= Date.now()) {
            throw new common_1.ConflictException('Tiempo de votación agotado');
        }
        const existing = await client.query('SELECT id FROM votes WHERE voting_session_id=$1 AND unit_id=$2 LIMIT 1', [sessionId, voter.unit_id]);
        if (existing.rowCount) {
            throw new common_1.ConflictException('Esta unidad ya emitió su voto en esta actividad');
        }
        const valid = await client.query(`SELECT id
       FROM voting_options
       WHERE voting_session_id=$1 AND active=TRUE AND id=$2`, [sessionId, optionId]);
        if (!valid.rowCount) {
            throw new common_1.BadRequestException('La opción/candidato no es válido para esta votación');
        }
        const inserted = await client.query(`INSERT INTO votes(
         voting_session_id,voting_option_id,unit_id,person_id,attendance_id,
         coefficient,voting_method,voter_name_snapshot,voter_document_snapshot,unit_number_snapshot
       )
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id,cast_at`, [
            sessionId,
            optionId,
            voter.unit_id,
            voter.person_id || null,
            voter.attendance_id,
            Number(voter.total_coefficient || 0),
            method,
            voter.attendee_name_snapshot || null,
            voter.attendee_document_snapshot || null,
            voter.unit_number,
        ]);
        return {
            ok: true,
            sessionId,
            unitId: voter.unit_id,
            optionId,
            ballotCount: 1,
            voteId: inserted.rows[0].id,
            castAt: inserted.rows[0].cast_at,
        };
    }
    async results(user, sessionId, forMinutes = false) {
        const s = await this.getSessionForStaff(user, sessionId);
        const q = await this.db.query(`SELECT vo.id option_id,vo.label,vo.position,vo.is_winner,vo.winner_marked_at,
              v.id vote_id,v.unit_id,v.person_id,v.coefficient,v.cast_at,
              v.voter_name_snapshot,v.voter_document_snapshot,v.unit_number_snapshot,
              a.attendance_role
       FROM voting_options vo
       LEFT JOIN votes v ON v.voting_option_id=vo.id
       LEFT JOIN attendance a ON a.id=v.attendance_id
       WHERE vo.voting_session_id=$1 AND vo.active=true
       ORDER BY vo.position,v.cast_at`, [sessionId]);
        const map = new Map();
        for (const row of q.rows) {
            if (!map.has(row.option_id)) {
                map.set(row.option_id, {
                    id: row.option_id,
                    label: row.label,
                    position: row.position,
                    isWinner: Boolean(row.is_winner),
                    winnerMarkedAt: row.winner_marked_at,
                    voteCount: 0,
                    coefficientTotal: 0,
                    voters: [],
                });
            }
            const o = map.get(row.option_id);
            if (row.vote_id) {
                o.voteCount += 1;
                o.coefficientTotal += Number(row.coefficient || 0);
                o.voters.push({
                    unitId: row.unit_id,
                    unitNumber: row.unit_number_snapshot,
                    personId: row.person_id,
                    name: row.voter_name_snapshot,
                    document: row.voter_document_snapshot,
                    attendanceRole: row.attendance_role,
                    coefficient: Number(row.coefficient || 0),
                    castAt: row.cast_at,
                });
            }
        }
        const ballots = await this.db.query('SELECT COUNT(*)::int n FROM votes WHERE voting_session_id=$1', [sessionId]);
        const eligible = await this.db.query(`SELECT COUNT(*)::int n
       FROM attendance
       WHERE assembly_id=$1 AND attended=TRUE`, [s.assembly_id]);
        const includeVoters = !forMinutes || Boolean(s.include_voter_details_in_minutes);
        const options = [...map.values()].map((o) => includeVoters ? o : { ...o, voters: undefined });
        const winnersRequired = Number(s.winners_required || 0);
        const winnersMarked = options.filter((o) => o.isWinner).length;
        return {
            session: {
                id: s.id,
                title: s.title,
                countingMethod: s.voting_type,
                status: s.status,
                winnersRequired: winnersRequired || null,
                multipleWinners: Boolean(s.multiple_winners),
                includeVoterDetailsInMinutes: s.include_voter_details_in_minutes,
            },
            eligibleUnitsPresent: eligible.rows[0].n,
            ballotsCast: ballots.rows[0].n,
            remainingUnits: Math.max(eligible.rows[0].n - ballots.rows[0].n, 0),
            invariant: 'ONE_BALLOT_PER_UNIT_PER_VOTING_SESSION',
            winnersConfirmed: winnersRequired > 0 && winnersMarked === winnersRequired,
            options,
            voterDetailsIncluded: includeVoters,
        };
    }
    async getSessionForStaff(user, sessionId) {
        const q = await this.db.query(`SELECT vs.*,p.organization_id
       FROM voting_sessions vs
       JOIN assemblies a ON a.id=vs.assembly_id
       JOIN properties p ON p.id=a.property_id
       WHERE vs.id=$1`, [sessionId]);
        if (!q.rowCount) {
            throw new common_1.NotFoundException('Votación no encontrada');
        }
        await this.access.ensureAssembly(user, q.rows[0].assembly_id);
        return q.rows[0];
    }
};
exports.VotingService = VotingService;
exports.VotingService = VotingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        access_service_1.AccessService,
        qr_token_service_1.QrTokenService,
        audit_service_1.AuditService,
        proxy_service_1.ProxyService])
], VotingService);
//# sourceMappingURL=voting.service.js.map