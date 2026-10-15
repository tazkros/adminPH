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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const access_service_1 = require("../common/access.service");
const qr_token_service_1 = require("../common/qr-token.service");
const audit_service_1 = require("../audit/audit.service");
const mail_service_1 = require("./mail.service");
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let NotificationsService = class NotificationsService {
    db;
    access;
    qr;
    audit;
    mail;
    constructor(db, access, qr, audit, mail) {
        this.db = db;
        this.access = access;
        this.qr = qr;
        this.audit = audit;
        this.mail = mail;
    }
    status() { return this.mail.status(); }
    async sendQrEmails(user, assemblyId, body, meta) {
        const asm = await this.access.ensureAssembly(user, assemblyId);
        const isAdmin = user.roles.includes('admin') || user.roles.includes('superadmin');
        const scope = body?.scope === 'todos' ? 'todos' : 'asistentes';
        if (scope === 'todos' && !isAdmin)
            throw new common_1.BadRequestException('Solo el administrador puede enviar los QR a todas las unidades');
        const recipients = Array.isArray(body?.recipients) ? body.recipients : [];
        if (!recipients.length)
            throw new common_1.BadRequestException('No hay destinatarios');
        if (recipients.length > 25)
            throw new common_1.BadRequestException('Máximo 25 correos por lote');
        let base;
        try {
            base = new URL(String(body?.baseUrl || ''));
            if (!/^https?:$/.test(base.protocol))
                throw new Error('x');
        }
        catch (_) {
            throw new common_1.BadRequestException('Falta la dirección pública de la página (baseUrl)');
        }
        base.search = '';
        base.hash = '';
        const operatorOnly = !isAdmin;
        const q = await this.db.query(`SELECT qt.id, qt.unit_id, u.unit_number, a.attended, qt.active
         FROM qr_tokens qt
         JOIN units u ON u.id=qt.unit_id
         LEFT JOIN attendance a ON a.assembly_id=qt.assembly_id AND a.unit_id=qt.unit_id
        WHERE qt.assembly_id=$1 AND qt.revoked_at IS NULL
          AND ($2::boolean=false OR (qt.active=true AND a.attended=true))
          AND ($3::text='todos' OR (qt.active=true AND a.attended=true))`, [assemblyId, operatorOnly, scope]);
        const byUnit = new Map();
        for (const r of q.rows)
            if (!byUnit.has(r.unit_id))
                byUnit.set(r.unit_id, r);
        const conjunto = String(body?.conjuntoNombre || '').slice(0, 120);
        const asamblea = String(body?.asambleaNombre || '').slice(0, 120);
        const fecha = String(body?.asambleaFecha || '').slice(0, 60);
        const prepared = [];
        const out = [];
        for (const r of recipients) {
            const row = byUnit.get(String(r?.unitId || ''));
            const email = String(r?.email || '').trim();
            const label = String(r?.unitLabel || '').slice(0, 80);
            if (!row) {
                out.push({ unitId: r?.unitId, unitLabel: label, email, ok: false, error: 'La unidad no está habilitada para este envío (¿no está presente?)' });
                continue;
            }
            const png = String(r?.png || '').replace(/^data:image\/png;base64,/, '');
            if (!/^[A-Za-z0-9+/=]+$/.test(png) || png.length < 100 || png.length > 400000) {
                out.push({ unitId: r.unitId, unitLabel: label, email, ok: false, error: 'Imagen del QR inválida' });
                continue;
            }
            const url = new URL(base.toString());
            url.searchParams.set('voteToken', this.qr.build(row.id));
            const nombre = String(r?.ownerName || '').slice(0, 120);
            const subject = `Su código QR para votar${asamblea ? ' – ' + asamblea : ''}${label ? ' (' + label + ')' : ''}`;
            const text = `Hola${nombre ? ' ' + nombre : ''},\n\nEste es su código QR personal para votar en la asamblea${asamblea ? ' "' + asamblea + '"' : ''}${conjunto ? ' de ' + conjunto : ''}${fecha ? ' (' + fecha + ')' : ''}. Corresponde a la unidad ${label}.\n\nPara votar, abra este enlace desde su celular:\n${url.toString()}\n\nEl código es personal e intransferible: no lo reenvíe. La votación se habilita cuando se registra su asistencia.\n\nMensaje enviado por AdminPH.`;
            const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f2937">
<h2 style="color:#1e3a8a;margin-bottom:4px">Su código QR para votar</h2>
<p>Hola${nombre ? ' <strong>' + esc(nombre) + '</strong>' : ''},</p>
<p>Este es su código QR personal para la asamblea${asamblea ? ' <strong>' + esc(asamblea) + '</strong>' : ''}${conjunto ? ' de <strong>' + esc(conjunto) + '</strong>' : ''}${fecha ? ' (' + esc(fecha) + ')' : ''}.<br>Unidad: <strong>${esc(label)}</strong></p>
<p style="text-align:center"><img src="cid:qr-unidad" alt="Código QR" width="240" height="240" style="border:1px solid #e5e7eb;padding:8px;border-radius:8px"></p>
<p style="text-align:center"><a href="${esc(url.toString())}" style="background:#1e3a8a;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Abrir mi votación</a></p>
<p style="font-size:13px;color:#4b5563">Puede escanear el QR con la cámara del celular o tocar el botón. El código es <strong>personal e intransferible</strong>: no lo reenvíe. La votación se habilita cuando se registra su asistencia.</p>
<p style="font-size:11px;color:#9ca3af">Mensaje enviado por AdminPH.</p></div>`;
            prepared.push({ unitId: r.unitId, msg: { to: email, subject, text, html, attachments: [{ cid: 'qr-unidad', filename: 'qr-votacion.png', contentType: 'image/png', base64: png }] } });
        }
        let sent = 0;
        if (prepared.length) {
            const res = await this.mail.sendMany(prepared.map((p) => p.msg));
            res.forEach((x, i) => { if (x.ok)
                sent++; out.push({ unitId: prepared[i].unitId, unitLabel: '', email: x.to, ok: x.ok, error: x.error }); });
        }
        await this.audit.write({
            organizationId: user.organizationId, assemblyId, userId: user.id, action: 'QR_EMAIL_SENT', entityType: 'assembly', entityId: assemblyId,
            newValues: { scope, requested: recipients.length, sent, failed: out.filter((o) => !o.ok).length }, ipAddress: meta.ip, userAgent: meta.userAgent,
        }).catch(() => undefined);
        return { scope, sent, failed: out.filter((o) => !o.ok).length, results: out, assemblyStatus: asm.status };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService,
        access_service_1.AccessService,
        qr_token_service_1.QrTokenService,
        audit_service_1.AuditService,
        mail_service_1.MailService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map