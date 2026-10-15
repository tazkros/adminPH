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
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const net = require("net");
const tls = require("tls");
const crypto_1 = require("crypto");
let MailService = class MailService {
    config;
    constructor(config) {
        this.config = config;
    }
    get host() { return (this.config.get('MAIL_HOST') || '').trim(); }
    get port() { return Number(this.config.get('MAIL_PORT') || 587); }
    get user() { return (this.config.get('MAIL_USER') || '').trim(); }
    get pass() { return this.config.get('MAIL_PASSWORD') || ''; }
    get from() { return (this.config.get('MAIL_FROM') || this.user).trim(); }
    get fromName() { return (this.config.get('MAIL_FROM_NAME') || 'AdminPH').trim(); }
    get starttls() { return String(this.config.get('MAIL_STARTTLS') ?? 'true').toLowerCase() !== 'false'; }
    get implicitTls() { return this.port === 465; }
    status() {
        const configured = !!(this.host && this.user && this.pass);
        return { configured, host: this.host || null, port: this.port, from: configured ? this.from : null };
    }
    enc(s) { return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`; }
    wrap(b64) { return (b64.match(/.{1,76}/g) || []).join('\r\n'); }
    clean(s) { return String(s || '').replace(/[\r\n]+/g, ' ').trim(); }
    build(m) {
        const b1 = 'mix_' + (0, crypto_1.randomBytes)(8).toString('hex');
        const b2 = 'alt_' + (0, crypto_1.randomBytes)(8).toString('hex');
        const domain = (this.from.split('@')[1] || 'adminph.local').replace(/[^a-z0-9.-]/gi, '');
        const h = [
            `From: ${this.enc(this.fromName)} <${this.from}>`,
            `To: ${m.to}`,
            `Subject: ${this.enc(this.clean(m.subject))}`,
            `Date: ${new Date().toUTCString()}`,
            `Message-ID: <${(0, crypto_1.randomBytes)(12).toString('hex')}@${domain}>`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/related; boundary="${b1}"`,
        ].join('\r\n');
        const parts = [];
        parts.push(`--${b1}\r\nContent-Type: multipart/alternative; boundary="${b2}"\r\n\r\n` +
            `--${b2}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${this.wrap(Buffer.from(m.text, 'utf8').toString('base64'))}\r\n` +
            `--${b2}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${this.wrap(Buffer.from(m.html, 'utf8').toString('base64'))}\r\n` +
            `--${b2}--\r\n`);
        for (const a of m.attachments || []) {
            parts.push(`--${b1}\r\nContent-Type: ${a.contentType}; name="${a.filename}"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <${a.cid}>\r\nContent-Disposition: inline; filename="${a.filename}"\r\n\r\n${this.wrap(a.base64)}\r\n`);
        }
        parts.push(`--${b1}--\r\n`);
        return h + '\r\n\r\n' + parts.join('');
    }
    async sendMany(messages) {
        if (!this.status().configured)
            throw new Error('El correo no está configurado en el servidor (archivo .env: MAIL_HOST, MAIL_USER, MAIL_PASSWORD).');
        let sock = await this.connect();
        let buf = '';
        let waiter = null;
        let failer = null;
        const lines = [];
        const onData = (d) => {
            buf += d.toString('utf8');
            let i;
            while ((i = buf.indexOf('\r\n')) >= 0) {
                lines.push(buf.slice(0, i));
                buf = buf.slice(i + 2);
            }
            flush();
        };
        const flush = () => {
            if (!waiter || !lines.length)
                return;
            const idx = lines.findIndex((l) => /^\d{3} /.test(l) || /^\d{3}$/.test(l));
            if (idx < 0)
                return;
            const chunk = lines.splice(0, idx + 1);
            const w = waiter;
            waiter = null;
            w({ code: Number(chunk[idx].slice(0, 3)), text: chunk.join('\n') });
        };
        const onErr = (e) => { if (failer) {
            const f = failer;
            failer = null;
            waiter = null;
            f(e);
        } };
        const attach = (s) => { s.on('data', onData); s.on('error', onErr); s.on('close', () => onErr(new Error('Conexión cerrada por el servidor de correo'))); s.setTimeout(30000, () => onErr(new Error('Tiempo de espera agotado con el servidor de correo'))); };
        attach(sock);
        const read = () => new Promise((res, rej) => { waiter = res; failer = rej; flush(); });
        const cmd = async (c, ok) => {
            sock.write(c + '\r\n');
            const r = await read();
            if (!ok.includes(r.code))
                throw new Error(r.text.replace(/\n/g, ' ').slice(0, 300));
            return r;
        };
        const results = [];
        try {
            let r = await read();
            if (r.code !== 220)
                throw new Error('El servidor de correo no respondió correctamente: ' + r.text);
            await cmd('EHLO adminph.local', [250]);
            if (!this.implicitTls && this.starttls) {
                await cmd('STARTTLS', [220]);
                sock.removeAllListeners('data');
                sock.removeAllListeners('error');
                sock.removeAllListeners('close');
                const plain = sock;
                sock = tls.connect({ socket: plain, servername: this.host });
                await new Promise((res, rej) => { sock.once('secureConnect', () => res()); sock.once('error', rej); });
                sock.removeAllListeners('error');
                attach(sock);
                await cmd('EHLO adminph.local', [250]);
            }
            const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
            await cmd('AUTH LOGIN', [334]);
            await cmd(b64(this.user), [334]);
            await cmd(b64(this.pass), [235]);
            for (const m of messages) {
                try {
                    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(m.to))
                        throw new Error('Correo no válido');
                    await cmd(`MAIL FROM:<${this.from}>`, [250]);
                    await cmd(`RCPT TO:<${m.to}>`, [250, 251]);
                    await cmd('DATA', [354]);
                    const body = this.build(m).replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
                    sock.write(body + '\r\n.\r\n');
                    const fin = await read();
                    if (fin.code !== 250)
                        throw new Error(fin.text.replace(/\n/g, ' ').slice(0, 300));
                    results.push({ to: m.to, ok: true });
                }
                catch (e) {
                    results.push({ to: m.to, ok: false, error: String(e?.message || e) });
                    try {
                        await cmd('RSET', [250]);
                    }
                    catch (_) {
                        break;
                    }
                }
            }
            try {
                await cmd('QUIT', [221]);
            }
            catch (_) { }
        }
        catch (e) {
            const msg = String(e?.message || e);
            const hint = /535|5\.7\.139|5\.7\.3|Authentication/i.test(msg)
                ? ' (Verifique usuario/contraseña y que "SMTP autenticado" esté habilitado para ese buzón en Microsoft 365)' : '';
            for (const m of messages)
                if (!results.find((x) => x.to === m.to))
                    results.push({ to: m.to, ok: false, error: msg + hint });
        }
        finally {
            try {
                sock.destroy();
            }
            catch (_) { }
        }
        return results;
    }
    connect() {
        return new Promise((res, rej) => {
            const t = setTimeout(() => rej(new Error(`No se pudo conectar a ${this.host}:${this.port}`)), 15000);
            const s = this.implicitTls
                ? tls.connect({ host: this.host, port: this.port, servername: this.host }, () => { clearTimeout(t); res(s); })
                : net.connect({ host: this.host, port: this.port }, () => { clearTimeout(t); res(s); });
            s.once('error', (e) => { clearTimeout(t); rej(new Error(`No se pudo conectar a ${this.host}:${this.port} (${e.message})`)); });
        });
    }
};
exports.MailService = MailService;
exports.MailService = MailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map