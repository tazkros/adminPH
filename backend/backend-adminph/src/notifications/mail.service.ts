import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';
import * as tls from 'tls';
import { randomBytes } from 'crypto';

export interface MailAttachment { cid: string; filename: string; contentType: string; base64: string; }
export interface MailMessage { to: string; subject: string; text: string; html: string; attachments?: MailAttachment[]; }
export interface MailResult { to: string; ok: boolean; error?: string; }

/**
 * Cliente SMTP mínimo (sin dependencias externas) para Office 365 / Outlook / Gmail / cualquier SMTP.
 * Soporta STARTTLS (puerto 587, el de Office 365) y TLS directo (puerto 465).
 */
@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}

  private get host() { return (this.config.get<string>('MAIL_HOST') || '').trim(); }
  private get port() { return Number(this.config.get<string>('MAIL_PORT') || 587); }
  private get user() { return (this.config.get<string>('MAIL_USER') || '').trim(); }
  private get pass() { return this.config.get<string>('MAIL_PASSWORD') || ''; }
  private get from() { return (this.config.get<string>('MAIL_FROM') || this.user).trim(); }
  private get fromName() { return (this.config.get<string>('MAIL_FROM_NAME') || 'AdminPH').trim(); }
  private get starttls() { return String(this.config.get<string>('MAIL_STARTTLS') ?? 'true').toLowerCase() !== 'false'; }
  private get implicitTls() { return this.port === 465; }

  status() {
    const configured = !!(this.host && this.user && this.pass);
    return { configured, host: this.host || null, port: this.port, from: configured ? this.from : null };
  }

  private enc(s: string) { return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`; }
  private wrap(b64: string) { return (b64.match(/.{1,76}/g) || []).join('\r\n'); }
  private clean(s: string) { return String(s || '').replace(/[\r\n]+/g, ' ').trim(); }

  private build(m: MailMessage): string {
    const b1 = 'mix_' + randomBytes(8).toString('hex');
    const b2 = 'alt_' + randomBytes(8).toString('hex');
    const domain = (this.from.split('@')[1] || 'adminph.local').replace(/[^a-z0-9.-]/gi, '');
    const h = [
      `From: ${this.enc(this.fromName)} <${this.from}>`,
      `To: ${m.to}`,
      `Subject: ${this.enc(this.clean(m.subject))}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${randomBytes(12).toString('hex')}@${domain}>`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/related; boundary="${b1}"`,
    ].join('\r\n');
    const parts: string[] = [];
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

  /** Envía varios correos en una sola sesión SMTP. Devuelve el resultado de cada uno. */
  async sendMany(messages: MailMessage[]): Promise<MailResult[]> {
    if (!this.status().configured) throw new Error('El correo no está configurado en el servidor (archivo .env: MAIL_HOST, MAIL_USER, MAIL_PASSWORD).');
    let sock: net.Socket | tls.TLSSocket = await this.connect();
    let buf = '';
    let waiter: ((r: { code: number; text: string }) => void) | null = null;
    let failer: ((e: Error) => void) | null = null;
    const lines: string[] = [];
    const onData = (d: Buffer) => {
      buf += d.toString('utf8');
      let i: number;
      while ((i = buf.indexOf('\r\n')) >= 0) { lines.push(buf.slice(0, i)); buf = buf.slice(i + 2); }
      flush();
    };
    const flush = () => {
      if (!waiter || !lines.length) return;
      // respuesta completa = última línea con formato "NNN " (sin guion)
      const idx = lines.findIndex((l) => /^\d{3} /.test(l) || /^\d{3}$/.test(l));
      if (idx < 0) return;
      const chunk = lines.splice(0, idx + 1);
      const w = waiter; waiter = null;
      w({ code: Number(chunk[idx].slice(0, 3)), text: chunk.join('\n') });
    };
    const onErr = (e: Error) => { if (failer) { const f = failer; failer = null; waiter = null; f(e); } };
    const attach = (s: net.Socket) => { s.on('data', onData); s.on('error', onErr); s.on('close', () => onErr(new Error('Conexión cerrada por el servidor de correo'))); s.setTimeout(30000, () => onErr(new Error('Tiempo de espera agotado con el servidor de correo'))); };
    attach(sock);
    const read = () => new Promise<{ code: number; text: string }>((res, rej) => { waiter = res; failer = rej; flush(); });
    const cmd = async (c: string, ok: number[]) => {
      sock.write(c + '\r\n');
      const r = await read();
      if (!ok.includes(r.code)) throw new Error(r.text.replace(/\n/g, ' ').slice(0, 300));
      return r;
    };
    const results: MailResult[] = [];
    try {
      let r = await read();
      if (r.code !== 220) throw new Error('El servidor de correo no respondió correctamente: ' + r.text);
      await cmd('EHLO adminph.local', [250]);
      if (!this.implicitTls && this.starttls) {
        await cmd('STARTTLS', [220]);
        sock.removeAllListeners('data'); sock.removeAllListeners('error'); sock.removeAllListeners('close');
        const plain = sock;
        sock = tls.connect({ socket: plain, servername: this.host });
        await new Promise<void>((res, rej) => { (sock as tls.TLSSocket).once('secureConnect', () => res()); sock.once('error', rej); });
        sock.removeAllListeners('error');
        attach(sock);
        await cmd('EHLO adminph.local', [250]);
      }
      const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
      await cmd('AUTH LOGIN', [334]);
      await cmd(b64(this.user), [334]);
      await cmd(b64(this.pass), [235]);
      for (const m of messages) {
        try {
          if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(m.to)) throw new Error('Correo no válido');
          await cmd(`MAIL FROM:<${this.from}>`, [250]);
          await cmd(`RCPT TO:<${m.to}>`, [250, 251]);
          await cmd('DATA', [354]);
          const body = this.build(m).replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
          sock.write(body + '\r\n.\r\n');
          const fin = await read();
          if (fin.code !== 250) throw new Error(fin.text.replace(/\n/g, ' ').slice(0, 300));
          results.push({ to: m.to, ok: true });
        } catch (e: any) {
          results.push({ to: m.to, ok: false, error: String(e?.message || e) });
          try { await cmd('RSET', [250]); } catch (_) { break; }
        }
      }
      try { await cmd('QUIT', [221]); } catch (_) { /* nada */ }
    } catch (e: any) {
      const msg = String(e?.message || e);
      const hint = /535|5\.7\.139|5\.7\.3|Authentication/i.test(msg)
        ? ' (Verifique usuario/contraseña y que "SMTP autenticado" esté habilitado para ese buzón en Microsoft 365)' : '';
      for (const m of messages) if (!results.find((x) => x.to === m.to)) results.push({ to: m.to, ok: false, error: msg + hint });
    } finally {
      try { sock.destroy(); } catch (_) { /* nada */ }
    }
    return results;
  }

  private connect(): Promise<net.Socket | tls.TLSSocket> {
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error(`No se pudo conectar a ${this.host}:${this.port}`)), 15000);
      const s: any = this.implicitTls
        ? tls.connect({ host: this.host, port: this.port, servername: this.host }, () => { clearTimeout(t); res(s); })
        : net.connect({ host: this.host, port: this.port }, () => { clearTimeout(t); res(s); });
      s.once('error', (e: Error) => { clearTimeout(t); rej(new Error(`No se pudo conectar a ${this.host}:${this.port} (${e.message})`)); });
    });
  }
}
