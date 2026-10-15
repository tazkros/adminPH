/* AdminPH V4.2 — Agenda mensual y panel de Reuniones virtuales.
 * Los eventos se guardan en localStorage ("agendaEventos") y viajan con la copia de seguridad / snapshot del servidor.
 * La videollamada la presta un servicio externo (por defecto Jitsi Meet, sin cuenta); también se puede pegar el enlace de
 * Google Meet, Zoom o Teams. AdminPH NO transmite video: organiza, programa y registra.
 */
(function () {
    "use strict";
    const KEY = "agendaEventos", KACT = "agendaActividad";
    const TIPOS = {
        asamblea: { n: "Asamblea", c: "#2d6a4f" },
        consejo: { n: "Reunión de consejo / comité", c: "#1e6fd9" },
        contractual: { n: "Reunión contractual", c: "#d97706" },
        evidencia: { n: "Envío de evidencias", c: "#7c3aed" },
        otro: { n: "Otro", c: "#64748b" },
    };
    const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

    // ------------------------------------------------------------------ utilidades
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const p2 = (n) => String(n).padStart(2, "0");
    const iso = (y, m, d) => `${y}-${p2(m + 1)}-${p2(d)}`;
    const hoyISO = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };
    const parseISO = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null; };
    const diasMes = (y, m) => new Date(y, m + 1, 0).getDate();
    const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const URL_OK = (u) => /^https?:\/\/[^\s<>"']+$/i.test(String(u || "").trim());

    function leer(k) { try { const v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
    function escribir(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } }
    const eventos = () => leer(KEY);
    const guardarEventos = (l) => escribir(KEY, l);
    function log(texto) { const l = leer(KACT); l.unshift({ t: new Date().toISOString(), texto }); escribir(KACT, l.slice(0, 200)); }

    // Evento «de solo lectura» tomado de la Fase 1 (fecha de la asamblea).
    function eventoFase1() {
        try {
            const c = JSON.parse(localStorage.getItem("configConjunto") || "null");
            if (c && parseISO(c.fechaReunion)) return { id: "fase1", tipo: "asamblea", titulo: `${c.tipoReunion ? "Asamblea " + c.tipoReunion : "Asamblea"} (Fase 1)`, fecha: c.fechaReunion, horaIni: c.horaReunion || "", horaFin: "", descripcion: "Fecha tomada de Fase 1 → Configuración de la asamblea.", fija: true };
        } catch (_) { /* sin datos */ }
        return null;
    }
    function todos() { const l = eventos(); const f = eventoFase1(); return f ? l.concat([f]) : l; }

    // Ocurrencias de un evento dentro de [desde, hasta] (cadenas ISO); soporta repetición semanal / mensual.
    function ocurrencias(ev, desde, hasta) {
        const o = parseISO(ev.fecha); if (!o) return [];
        const out = [];
        const push = (f) => { if (f >= desde && f <= hasta) out.push({ ev, fecha: f }); };
        if (!ev.repite || ev.repite === "no") { push(ev.fecha); return out; }
        const ini = new Date(o.y, o.m, o.d), fin = parseISO(hasta);
        const limite = new Date(fin.y, fin.m, fin.d);
        if (ev.repite === "semanal") {
            for (let t = new Date(ini); t <= limite; t.setDate(t.getDate() + 7)) push(iso(t.getFullYear(), t.getMonth(), t.getDate()));
        } else if (ev.repite === "mensual") {
            for (let k = 0; k < 600; k++) {
                const y = o.y + Math.floor((o.m + k) / 12), m = (o.m + k) % 12, d = Math.min(o.d, diasMes(y, m));
                const t = new Date(y, m, d); if (t > limite) break; push(iso(y, m, d));
            }
        }
        return out;
    }
    function ocurrenciasRango(desde, hasta, filtro) {
        let l = [];
        todos().forEach((ev) => { if (!filtro || filtro(ev)) l = l.concat(ocurrencias(ev, desde, hasta)); });
        return l.sort((a, b) => (a.fecha + (a.ev.horaIni || "99")).localeCompare(b.fecha + (b.ev.horaIni || "99")));
    }
    const inicioMs = (f, h) => { const o = parseISO(f); if (!o) return 0; const [hh, mm] = String(h || "00:00").split(":").map(Number); return new Date(o.y, o.m, o.d, hh || 0, mm || 0).getTime(); };
    const finMs = (oc) => { const f = oc.ev.horaFin ? inicioMs(oc.fecha, oc.ev.horaFin) : inicioMs(oc.fecha, oc.ev.horaIni || "00:00") + 3600000; return f; };
    const fmtFecha = (f) => { const o = parseISO(f); return o ? `${p2(o.d)} de ${MESES[o.m].toLowerCase()} de ${o.y}` : f; };
    const fmtHora = (ev) => (ev.horaIni ? ev.horaIni + (ev.horaFin ? " – " + ev.horaFin : "") : "Todo el día");

    function proximos(n, filtro) {
        const ahora = Date.now(), d0 = hoyISO(), t = new Date(); t.setDate(t.getDate() + 365);
        return ocurrenciasRango(d0, iso(t.getFullYear(), t.getMonth(), t.getDate()), filtro).filter((o) => finMs(o) >= ahora).slice(0, n || 5);
    }

    // ------------------------------------------------------------------ salas virtuales
    function slug(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "").slice(0, 18); }
    function crearSala() {
        let nom = ""; try { nom = (JSON.parse(localStorage.getItem("configConjunto") || "{}").nombreConjunto) || ""; } catch (_) { /* nada */ }
        const rnd = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 5);
        return `https://meet.jit.si/AdminPH${slug(nom)}${rnd}`;
    }
    function enlaceDesdeId(txt) {
        const t = String(txt || "").trim(); if (!t) return "";
        if (URL_OK(t)) return t;
        if (/^[\w-]{3,80}$/.test(t)) return "https://meet.jit.si/" + t;
        return "";
    }
    async function copiar(texto) {
        try { await navigator.clipboard.writeText(texto); return true; } catch (_) { try { window.prompt("Copie el enlace (Ctrl+C):", texto); } catch (e) { /* nada */ } return false; }
    }
    const mensajeInvitacion = (ev, fecha) => `Invitación: ${ev.titulo}\n${fmtFecha(fecha || ev.fecha)} · ${fmtHora(ev)}\n${ev.enlace ? "Enlace: " + ev.enlace : ""}`;

    // ------------------------------------------------------------------ estilos
    function estilos() {
        if (document.getElementById("agendaCss")) return;
        const s = document.createElement("style"); s.id = "agendaCss";
        s.textContent = `
.ag{--ag-line:#dce7df;--ag-soft:#e8f5ec;--ag-g:#2d6a4f;color:#1f2d24}
.ag-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0}
.ag-bar h3{flex:1;margin:0;text-align:center;font-size:1.25rem;color:#1f5c43;min-width:160px}
.ag-btn{font:inherit;font-weight:700;font-size:.9rem;border:0;border-radius:11px;padding:10px 14px;cursor:pointer;background:var(--ag-g);color:#fff;box-shadow:0 3px 0 #1b4332;min-height:42px}
.ag-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #1b4332}
.ag-btn.s{background:var(--ag-soft);color:#1f5c43;box-shadow:0 3px 0 var(--ag-line)}
.ag-btn.r{background:#b91c1c;box-shadow:0 3px 0 #7f1d1d}
.ag-btn.g{background:#16a34a;box-shadow:0 3px 0 #166534}
.ag-btn.sm{padding:6px 10px;font-size:.8rem;min-height:32px;box-shadow:none}
.ag-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.ag-dow{font-weight:800;text-align:center;font-size:.8rem;color:#5a6b60;padding:4px 0}
.ag-day{min-height:92px;border:1px solid var(--ag-line);border-radius:10px;padding:4px;background:#fff;cursor:pointer;overflow:hidden;display:flex;flex-direction:column;gap:2px}
.ag-day:hover{background:#f3faf5}
.ag-day.off{background:#f6f8f6;opacity:.6}
.ag-day.hoy{outline:2px solid #2d6a4f}
.ag-day.sel{background:#e8f5ec}
.ag-day b{font-size:.85rem}
.ag-chip{font-size:.72rem;line-height:1.25;color:#fff;border-radius:6px;padding:2px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;border:0;font-family:inherit;cursor:pointer;width:100%}
.ag-more{font-size:.7rem;color:#5a6b60}
.ag-lista{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.ag-item{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--ag-line);border-left:6px solid var(--c,#2d6a4f);border-radius:12px;padding:10px 12px;background:#fff}
.ag-item .t{flex:1;min-width:0}.ag-item .t b{display:block}.ag-item small{color:#5a6b60}
.ag-item .ac{display:flex;gap:6px;flex-wrap:wrap}
.ag-hero{display:flex;gap:14px;align-items:stretch;border:1px solid var(--ag-line);border-radius:16px;overflow:hidden;background:#fff;margin:10px 0}
.ag-hero .led{width:10px;background:#16a34a}.ag-hero.vivo .led{background:#b91c1c}
.ag-hero .cu{flex:1;padding:14px;min-width:0}.ag-hero h3{margin:0 0 4px}
.ag-hero .un{display:flex;align-items:center;padding:14px}
.ag-av{display:inline-flex;width:28px;height:28px;border-radius:50%;background:#2d6a4f;color:#fff;align-items:center;justify-content:center;font-size:.72rem;font-weight:800;margin-right:-6px;border:2px solid #fff}
.ag-un{font-size:1.1rem;padding:16px 26px}
.ag-layout{display:grid;grid-template-columns:200px 1fr;gap:14px}
.ag-side{display:flex;flex-direction:column;gap:6px}
.ag-side button{text-align:left;font:inherit;font-weight:600;border:0;border-radius:11px;padding:10px 12px;background:#f3f7f4;color:#1f2d24;cursor:pointer}
.ag-side button.on{background:#2d6a4f;color:#fff}
.ag-acc{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-bottom:8px}
.ag-time{border-left:3px solid var(--ag-line);margin-left:6px;padding-left:12px}
@media(max-width:820px){.ag-layout{grid-template-columns:1fr}.ag-side{flex-direction:row;overflow-x:auto}.ag-day{min-height:62px}.ag-chip{font-size:.62rem}.ag-hero{flex-direction:column}}
.ag-modal{position:fixed;inset:0;z-index:10040;background:rgba(10,20,15,.6);display:flex;align-items:center;justify-content:center;padding:12px}
.ag-modal .mb{background:#fff;color:#1f2d24;border-radius:16px;max-width:560px;width:100%;max-height:94vh;overflow:auto;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.ag-modal h3{margin:0 0 10px}
.ag-modal label{display:block;font-size:.8rem;font-weight:700;color:#5a6b60;margin:8px 0 3px}
.ag-modal input,.ag-modal select,.ag-modal textarea{width:100%;font:inherit;padding:8px 10px;border:1px solid #dce7df;border-radius:9px;box-sizing:border-box}
.ag-modal .fila{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ag-modal .pie{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;justify-content:flex-end}
.ag-nota{background:#eff6ff;color:#1e40af;border-radius:10px;padding:9px 12px;font-size:.88rem;margin:8px 0}`;
        document.head.appendChild(s);
    }

    // ------------------------------------------------------------------ modal / formulario
    function modal(html) {
        estilos();
        const m = document.createElement("div"); m.className = "ag-modal"; m.innerHTML = `<div class="mb">${html}</div>`;
        document.body.appendChild(m);
        m.addEventListener("click", (e) => { if (e.target === m) m.remove(); });
        return m;
    }

    function formulario(ctx, base, alGuardar) {
        const nuevo = !base.id;
        const ev = Object.assign({ tipo: "otro", titulo: "", fecha: hoyISO(), horaIni: "", horaFin: "", lugar: "", enlace: "", invitados: "", descripcion: "", notas: "", repite: "no", virtual: !!ctx.virtual }, base);
        const m = modal(`<h3>${nuevo ? "📅 Programar" : "✏️ Editar"} ${ev.virtual ? "reunión virtual" : "evento"}</h3>
<label>Título</label><input id="agT" value="${esc(ev.titulo)}" placeholder="Ej.: Reunión de consejo de administración">
<div class="fila"><div><label>Tipo</label><select id="agTipo">${Object.keys(TIPOS).map((k) => `<option value="${k}" ${ev.tipo === k ? "selected" : ""}>${TIPOS[k].n}</option>`).join("")}</select></div>
<div><label>Fecha</label><input type="date" id="agF" value="${esc(ev.fecha)}"></div></div>
<div class="fila"><div><label>Hora inicio</label><input type="time" id="agHi" value="${esc(ev.horaIni)}"></div><div><label>Hora fin</label><input type="time" id="agHf" value="${esc(ev.horaFin)}"></div></div>
<div class="fila"><div><label>Repetición</label><select id="agRep"><option value="no">No se repite</option><option value="semanal" ${ev.repite === "semanal" ? "selected" : ""}>Cada semana</option><option value="mensual" ${ev.repite === "mensual" ? "selected" : ""}>Cada mes</option></select></div>
<div><label>Lugar</label><input id="agL" value="${esc(ev.lugar)}" placeholder="Salón comunal, oficina…"></div></div>
<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="agV" style="width:auto" ${ev.virtual ? "checked" : ""}> Es reunión virtual (con enlace)</label>
<div id="agVBox" style="${ev.virtual ? "" : "display:none"}"><label>Enlace de la reunión</label><div style="display:flex;gap:6px"><input id="agE" value="${esc(ev.enlace)}" placeholder="https://…  (Meet, Zoom, Teams o Jitsi)"><button type="button" class="ag-btn s sm" id="agGen">Generar sala</button></div>
<div class="ag-nota">«Generar sala» crea una sala gratuita de Jitsi Meet (no requiere cuenta para entrar). También puede pegar el enlace de Google Meet, Zoom o Teams. Para asambleas no presenciales revise el art. 42 de la Ley 675 y su reglamento.</div></div>
<label>Invitados (nombres o correos, separados por coma)</label><input id="agI" value="${esc(ev.invitados)}">
<label>Descripción / orden del día</label><textarea id="agD" rows="2">${esc(ev.descripcion)}</textarea>
<label>Notas y archivos (enlaces)</label><textarea id="agN" rows="2" placeholder="Notas previas o enlaces a documentos">${esc(ev.notas)}</textarea>
<div id="agMsg" style="color:#b91c1c;font-size:.85rem;min-height:18px"></div>
<div class="pie">${nuevo ? "" : `<button class="ag-btn r sm" id="agDel" type="button">🗑 Eliminar</button>`}<button class="ag-btn s" id="agCan" type="button">Cancelar</button><button class="ag-btn" id="agOk" type="button">Guardar</button></div>`);
        const q = (id) => m.querySelector("#" + id);
        q("agV").onchange = () => { q("agVBox").style.display = q("agV").checked ? "" : "none"; };
        q("agGen").onclick = () => { q("agE").value = crearSala(); };
        q("agCan").onclick = () => m.remove();
        if (q("agDel")) q("agDel").onclick = () => { if (confirm("¿Eliminar este evento?")) { guardarEventos(eventos().filter((x) => x.id !== ev.id)); log(`Evento eliminado: ${ev.titulo}`); m.remove(); alGuardar(); } };
        q("agOk").onclick = () => {
            const t = q("agT").value.trim(), f = q("agF").value, v = q("agV").checked, e = q("agE").value.trim();
            if (!t) { q("agMsg").textContent = "Escriba un título."; return; }
            if (!parseISO(f)) { q("agMsg").textContent = "Elija una fecha."; return; }
            if (q("agHi").value && q("agHf").value && q("agHf").value <= q("agHi").value) { q("agMsg").textContent = "La hora de fin debe ser posterior a la de inicio."; return; }
            if (v && e && !URL_OK(e)) { q("agMsg").textContent = "El enlace debe empezar por http:// o https://"; return; }
            const nuevoEv = Object.assign({}, ev, { id: ev.id || nuevoId(), titulo: t, tipo: q("agTipo").value, fecha: f, horaIni: q("agHi").value, horaFin: q("agHf").value, repite: q("agRep").value, lugar: q("agL").value.trim(), virtual: v, enlace: v ? e : "", invitados: q("agI").value.trim(), descripcion: q("agD").value.trim(), notas: q("agN").value.trim() });
            const l = eventos(); const i = l.findIndex((x) => x.id === nuevoEv.id);
            if (i >= 0) l[i] = nuevoEv; else l.push(nuevoEv);
            guardarEventos(l); log(`${i >= 0 ? "Evento actualizado" : "Evento programado"}: ${t} (${fmtFecha(f)})`);
            m.remove(); alGuardar(nuevoEv);
        };
        q("agT").focus();
    }

    // ------------------------------------------------------------------ calendario mensual
    function calendario(cont, estado, opts) {
        const { y, m } = estado;
        const primero = new Date(y, m, 1), offset = (primero.getDay() + 6) % 7, n = diasMes(y, m);
        const desde = iso(y, m, 1), hasta = iso(y, m, n), hoy = hoyISO();
        const ocs = ocurrenciasRango(desde, hasta, opts.filtro);
        const porDia = {}; ocs.forEach((o) => { (porDia[o.fecha] = porDia[o.fecha] || []).push(o); });
        const barra = (pos) => `<div class="ag-bar"><button class="ag-btn s" data-nav="-12" title="Año anterior">⏪</button><button class="ag-btn s" data-nav="-1">◀ Mes anterior</button><h3>${pos === "top" ? `${MESES[m]} ${y}` : `${MESES[m]} ${y}`}</h3><button class="ag-btn s" data-nav="0">Hoy</button><button class="ag-btn s" data-nav="1">Mes siguiente ▶</button><button class="ag-btn s" data-nav="12" title="Año siguiente">⏩</button></div>`;
        let celdas = ""; for (let i = 0; i < offset; i++) celdas += `<div class="ag-day off"></div>`;
        for (let d = 1; d <= n; d++) {
            const f = iso(y, m, d), lista = porDia[f] || [];
            celdas += `<div class="ag-day ${f === hoy ? "hoy" : ""} ${f === estado.sel ? "sel" : ""}" data-dia="${f}"><b>${d}</b>${lista.slice(0, 3).map((o) => `<button class="ag-chip" data-ev="${esc(o.ev.id)}" data-f="${f}" style="background:${(TIPOS[o.ev.tipo] || TIPOS.otro).c}" title="${esc(o.ev.titulo)}">${o.ev.virtual ? "🎥 " : ""}${esc((o.ev.horaIni ? o.ev.horaIni + " " : "") + o.ev.titulo)}</button>`).join("")}${lista.length > 3 ? `<span class="ag-more">+${lista.length - 3} más</span>` : ""}</div>`;
        }
        cont.innerHTML = `${barra("top")}<div class="ag-grid">${DIAS.map((d) => `<div class="ag-dow">${d}</div>`).join("")}${celdas}</div>${barra("bottom")}
<div class="ag-lista" id="agDiaLista"></div>`;
        const pintaDia = () => {
            const f = estado.sel; if (!f) { cont.querySelector("#agDiaLista").innerHTML = ""; return; }
            const l = (porDia[f] || []);
            cont.querySelector("#agDiaLista").innerHTML = `<h4 style="margin:6px 0 0">${fmtFecha(f)}</h4>` + (l.length ? l.map((o) => tarjetaEvento(o, opts)).join("") : `<p style="color:#5a6b60;margin:4px 0">No hay eventos este día.${opts.editar ? " Pulse «Programar» o toque una casilla vacía del calendario." : ""}</p>`) + (opts.editar ? `<button class="ag-btn" data-nuevo="${f}" style="margin-top:6px">➕ Programar en este día</button>` : "");
        };
        pintaDia();
        cont.onclick = (e) => {
            const nav = e.target.closest("[data-nav]");
            if (nav) { const k = Number(nav.dataset.nav); if (k === 0) { const t = new Date(); estado.y = t.getFullYear(); estado.m = t.getMonth(); estado.sel = hoyISO(); } else { const d = new Date(estado.y, estado.m + k, 1); estado.y = d.getFullYear(); estado.m = d.getMonth(); estado.sel = null; } calendario(cont, estado, opts); return; }
            if (accionEvento(e, cont, opts)) return;
            const nuevo = e.target.closest("[data-nuevo]");
            if (nuevo) { if (opts.editar) formulario({ virtual: opts.virtual }, { fecha: nuevo.dataset.nuevo }, () => calendario(cont, estado, opts)); return; }
            const chip = e.target.closest("[data-ev]");
            if (chip) { abrirEvento(chip.dataset.ev, chip.dataset.f, opts, () => calendario(cont, estado, opts)); return; }
            const dia = e.target.closest("[data-dia]");
            if (dia) {
                const f = dia.dataset.dia; const vacio = !(porDia[f] || []).length;
                estado.sel = f;
                if (vacio && opts.editar) formulario({ virtual: opts.virtual }, { fecha: f }, () => calendario(cont, estado, opts));   // casilla vacía → programar
                else calendario(cont, estado, opts);
            }
        };
    }

    function tarjetaEvento(o, opts) {
        const ev = o.ev, c = (TIPOS[ev.tipo] || TIPOS.otro).c;
        return `<div class="ag-item" style="--c:${c}"><div class="t"><b>${ev.virtual ? "🎥 " : ""}${esc(ev.titulo)}</b><small>${esc(fmtHora(ev))} · ${esc((TIPOS[ev.tipo] || TIPOS.otro).n)}${ev.lugar ? " · " + esc(ev.lugar) : ""}${ev.repite && ev.repite !== "no" ? " · 🔁 " + ev.repite : ""}</small>${ev.descripcion ? `<div style="font-size:.88rem;margin-top:3px">${esc(ev.descripcion)}</div>` : ""}${ev.invitados ? `<small>👥 ${esc(ev.invitados)}</small>` : ""}</div>
<div class="ac">${ev.virtual && ev.enlace ? `<button class="ag-btn g sm" data-unir="${esc(ev.id)}">Unirse</button><button class="ag-btn s sm" data-copia="${esc(ev.id)}" data-f="${o.fecha}">🔗 Copiar enlace</button>` : ""}${ev.notas ? `<button class="ag-btn s sm" data-notas="${esc(ev.id)}">💬 Notas</button>` : ""}${opts.editar && !ev.fija ? `<button class="ag-btn s sm" data-edit="${esc(ev.id)}" data-f="${o.fecha}">✏️ Editar</button>` : ""}</div></div>`;
    }

    function buscar(id) { return todos().find((x) => x.id === id); }
    function accionEvento(e, cont, opts) {
        const b = e.target.closest("[data-unir],[data-copia],[data-notas],[data-edit]"); if (!b) return false;
        const id = b.dataset.unir || b.dataset.copia || b.dataset.notas || b.dataset.edit, ev = buscar(id); if (!ev) return true;
        if (b.dataset.unir) { if (URL_OK(ev.enlace)) { log(`Se abrió la reunión: ${ev.titulo}`); window.open(ev.enlace, "_blank", "noopener"); } }
        else if (b.dataset.copia) copiar(mensajeInvitacion(ev, b.dataset.f)).then((ok) => { if (ok) b.textContent = "✔ Copiado"; });
        else if (b.dataset.notas) modal(`<h3>💬 Notas · ${esc(ev.titulo)}</h3><div style="white-space:pre-wrap">${esc(ev.notas)}</div><div class="pie"><button class="ag-btn" onclick="this.closest('.ag-modal').remove()">Cerrar</button></div>`);
        else if (b.dataset.edit) { if (opts.editar) formulario({ virtual: ev.virtual }, ev, opts.refrescar || (() => {})); }
        return true;
    }
    function abrirEvento(id, fecha, opts, refrescar) {
        const ev = buscar(id); if (!ev) return;
        const o = { ev, fecha: fecha || ev.fecha };
        const m = modal(`<h3>${esc(ev.titulo)}</h3>${tarjetaEvento(o, Object.assign({}, opts, { editar: false }))}<div class="pie">${opts.editar && !ev.fija ? `<button class="ag-btn" id="agEd">✏️ Editar</button>` : ""}<button class="ag-btn s" id="agCl">Cerrar</button></div>`);
        m.querySelector("#agCl").onclick = () => m.remove();
        const ed = m.querySelector("#agEd"); if (ed) ed.onclick = () => { m.remove(); formulario({ virtual: ev.virtual }, ev, refrescar); };
        m.querySelectorAll("[data-unir],[data-copia],[data-notas]").forEach((b) => b.addEventListener("click", (e) => accionEvento(e, null, opts)));
    }

    // ------------------------------------------------------------------ AGENDA
    function renderAgenda(cont, opts) {
        estilos(); opts = Object.assign({ editar: true }, opts || {});
        const t = new Date(), estado = { y: t.getFullYear(), m: t.getMonth(), sel: hoyISO() };
        cont.innerHTML = `<div class="card ag"><div class="ag-bar"><h2 style="margin:0">📅 Agenda</h2><span style="flex:1"></span>${opts.editar ? `<button class="ag-btn" id="agNuevo">➕ Programar evento</button>` : ""}</div>
<p style="margin:4px 0;color:#5a6b60;font-size:.92rem">Programe asambleas, reuniones de consejo o contractuales y envíos de evidencias. Use las flechas para cambiar de mes y toque una casilla vacía para programar en ese día. La fecha de la asamblea de la Fase 1 aparece automáticamente.</p>
<div id="agCal"></div></div>`;
        const pintar = () => calendario(cont.querySelector("#agCal"), estado, Object.assign({}, opts, { refrescar: pintar }));
        opts.refrescar = pintar; pintar();
        const nb = cont.querySelector("#agNuevo"); if (nb) nb.onclick = () => formulario({}, { fecha: estado.sel || hoyISO() }, pintar);
    }

    // ------------------------------------------------------------------ REUNIONES VIRTUALES
    function renderReuniones(cont, opts) {
        estilos(); opts = Object.assign({ editar: true }, opts || {});
        const estado = { tab: "calendario", vista: "agenda", cal: (() => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth(), sel: hoyISO() }; })() };
        const esVirtual = (ev) => !!ev.virtual;
        const o2 = Object.assign({}, opts, { filtro: esVirtual, virtual: true });
        const pintar = () => {
            const tabs = [["calendario", "📅 Calendario"], ["actividad", "🔔 Actividad"], ["chats", "💬 Chats y canales"], ["archivos", "🎞️ Grabaciones y archivos"]];
            cont.innerHTML = `<div class="card ag"><div class="ag-bar"><h2 style="margin:0">🎥 Reuniones virtuales</h2><span style="flex:1"></span></div>
<div class="ag-acc">${opts.editar ? `<button class="ag-btn g" id="rvAhora">🟢 Reunirse ahora</button><button class="ag-btn" id="rvProg">📅 Programar reunión</button>` : ""}<button class="ag-btn s" id="rvId">🔑 Unirse con ID</button></div>
<div class="ag-layout"><div class="ag-side">${tabs.map((t) => `<button data-tab="${t[0]}" class="${estado.tab === t[0] ? "on" : ""}">${t[1]}</button>`).join("")}</div><div id="rvCuerpo"></div></div></div>`;
            cont.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { estado.tab = b.dataset.tab; pintar(); }));
            const ahora = cont.querySelector("#rvAhora"); if (ahora) ahora.onclick = reunirseAhora;
            const prog = cont.querySelector("#rvProg"); if (prog) prog.onclick = () => formulario({ virtual: true }, { fecha: hoyISO(), virtual: true }, pintar);
            cont.querySelector("#rvId").onclick = unirseConId;
            cuerpo();
        };
        function reunirseAhora() {
            const t = new Date(), f = iso(t.getFullYear(), t.getMonth(), t.getDate()), hi = `${p2(t.getHours())}:${p2(t.getMinutes())}`, tf = new Date(t.getTime() + 3600000);
            const ev = { id: nuevoId(), tipo: "otro", titulo: "Reunión instantánea", fecha: f, horaIni: hi, horaFin: `${p2(tf.getHours())}:${p2(tf.getMinutes())}`, virtual: true, enlace: crearSala(), repite: "no", lugar: "", invitados: "", descripcion: "", notas: "" };
            const l = eventos(); l.push(ev); guardarEventos(l); log("Reunión instantánea creada");
            window.open(ev.enlace, "_blank", "noopener");
            const m = modal(`<h3>🟢 Su sala está lista</h3><p>Se abrió en otra pestaña. Comparta este enlace con los participantes:</p><input readonly value="${esc(ev.enlace)}" onclick="this.select()">
<div class="pie"><button class="ag-btn s" id="rvC">🔗 Copiar</button><a class="ag-btn s" style="text-decoration:none;display:inline-flex;align-items:center" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent("Reunión virtual: " + ev.enlace)}">WhatsApp</a><a class="ag-btn s" style="text-decoration:none;display:inline-flex;align-items:center" href="mailto:?subject=${encodeURIComponent("Reunión virtual")}&body=${encodeURIComponent("Ingrese a la reunión: " + ev.enlace)}">Correo</a><button class="ag-btn" id="rvX">Cerrar</button></div>`);
            m.querySelector("#rvC").onclick = async (e) => { if (await copiar(ev.enlace)) e.target.textContent = "✔ Copiado"; };
            m.querySelector("#rvX").onclick = () => { m.remove(); pintar(); };
        }
        function unirseConId() {
            const m = modal(`<h3>🔑 Unirse con ID o enlace</h3><label>Código de la sala o enlace completo</label><input id="rvIdIn" placeholder="Ej.: AdminPHConjunto8f3k  ó  https://meet.google.com/…"><div id="rvIdMsg" style="color:#b91c1c;font-size:.85rem;min-height:18px"></div><div class="pie"><button class="ag-btn s" id="rvIdC">Cancelar</button><button class="ag-btn g" id="rvIdOk">Unirse</button></div>`);
            m.querySelector("#rvIdC").onclick = () => m.remove();
            const ir = () => { const u = enlaceDesdeId(m.querySelector("#rvIdIn").value); if (!u) { m.querySelector("#rvIdMsg").textContent = "Escriba un código (letras y números) o un enlace http(s)."; return; } log("Se unió a una reunión por ID"); window.open(u, "_blank", "noopener"); m.remove(); };
            m.querySelector("#rvIdOk").onclick = ir; m.querySelector("#rvIdIn").addEventListener("keydown", (e) => { if (e.key === "Enter") ir(); });
            m.querySelector("#rvIdIn").focus();
        }
        function cuerpo() {
            const c = cont.querySelector("#rvCuerpo");
            if (estado.tab === "calendario") return cuerpoCalendario(c);
            if (estado.tab === "actividad") {
                const l = leer(KACT);
                c.innerHTML = `<h3 style="margin-top:0">🔔 Actividad</h3>` + (l.length ? `<div class="ag-lista">${l.slice(0, 60).map((a) => `<div class="ag-item" style="--c:#64748b"><div class="t"><b>${esc(a.texto)}</b><small>${new Date(a.t).toLocaleString("es-CO")}</small></div></div>`).join("")}</div>` : `<p style="color:#5a6b60">Aún no hay actividad. Aquí aparecerán las reuniones programadas, modificadas o abiertas.</p>`);
                return;
            }
            if (estado.tab === "chats") {
                c.innerHTML = `<h3 style="margin-top:0">💬 Chats y canales</h3><div class="ag-nota">En desarrollo. AdminPH todavía no tiene chat propio. Mientras tanto use el chat de la plataforma de video de cada reunión, y las <b>notas</b> de cada reunión (botón 💬 Notas) para dejar enlaces y documentos previos.</div>`;
                return;
            }
            // grabaciones y archivos
            const hoy = hoyISO();
            const l = eventos().filter(esVirtual).sort((a, b) => b.fecha.localeCompare(a.fecha));
            c.innerHTML = `<h3 style="margin-top:0">🎞️ Grabaciones y archivos</h3><p style="color:#5a6b60;font-size:.9rem">Pegue aquí el enlace de la grabación (Meet, Zoom, Teams, Drive…) cuando termine la reunión. AdminPH guarda el enlace, no el video.</p>` +
                (l.length ? `<div class="ag-lista">${l.map((ev) => `<div class="ag-item" style="--c:${(TIPOS[ev.tipo] || TIPOS.otro).c}"><div class="t"><b>${esc(ev.titulo)}</b><small>${fmtFecha(ev.fecha)} ${ev.fecha > hoy ? "· próxima" : ""}</small><div style="display:flex;gap:6px;margin-top:6px"><input data-grab="${esc(ev.id)}" value="${esc(ev.grabacion || "")}" placeholder="Enlace de la grabación" style="flex:1;font:inherit;padding:6px 8px;border:1px solid #dce7df;border-radius:8px">${opts.editar ? `<button class="ag-btn s sm" data-gg="${esc(ev.id)}">Guardar</button>` : ""}${URL_OK(ev.grabacion) ? `<button class="ag-btn sm" data-ver="${esc(ev.id)}">▶ Abrir</button>` : ""}</div></div></div>`).join("")}</div>` : `<p style="color:#5a6b60">Todavía no hay reuniones virtuales.</p>`) +
                `<div class="ag-nota">Los documentos formales (actas, poderes, informes) se archivarán en el <b>Gestor documental</b> (en desarrollo).</div>`;
            c.onclick = (e) => {
                const g = e.target.closest("[data-gg]"), v = e.target.closest("[data-ver]");
                if (g) { const val = c.querySelector(`[data-grab="${g.dataset.gg}"]`).value.trim(); if (val && !URL_OK(val)) { alert("El enlace debe empezar por http:// o https://"); return; } const l2 = eventos(); const ev = l2.find((x) => x.id === g.dataset.gg); if (ev) { ev.grabacion = val; guardarEventos(l2); log(`Grabación registrada: ${ev.titulo}`); g.textContent = "✔ Guardado"; } }
                if (v) { const ev = buscar(v.dataset.ver); if (ev && URL_OK(ev.grabacion)) window.open(ev.grabacion, "_blank", "noopener"); }
            };
        }
        function cuerpoCalendario(c) {
            const sig = proximos(1, esVirtual)[0];
            const ahoraMs = Date.now();
            const hoy = hoyISO();
            let hero = `<div class="ag-nota">No hay reuniones virtuales próximas. Use «Programar reunión» o «Reunirse ahora».</div>`;
            if (sig) {
                const ev = sig.ev, vivo = inicioMs(sig.fecha, ev.horaIni || "00:00") <= ahoraMs && ahoraMs <= finMs(sig);
                const inv = String(ev.invitados || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8);
                hero = `<div class="ag-hero ${vivo ? "vivo" : ""}"><div class="led"></div><div class="cu"><small style="font-weight:800;color:${vivo ? "#b91c1c" : "#166534"}">${vivo ? "● EN CURSO" : "PRÓXIMA REUNIÓN"}</small><h3>${esc(ev.titulo)}</h3><div>${fmtFecha(sig.fecha)} · ${esc(fmtHora(ev))}</div><small>Organiza: ${esc(opts.usuario || "Administración")}</small>${inv.length ? `<div style="margin-top:8px">${inv.map((n) => `<span class="ag-av" title="${esc(n)}">${esc(n.slice(0, 2).toUpperCase())}</span>`).join("")}</div>` : ""}</div><div class="un">${URL_OK(ev.enlace) ? `<button class="ag-btn g ag-un" data-unir="${esc(ev.id)}">Unirse</button>` : `<small>Sin enlace</small>`}</div></div>`;
            }
            const delDia = ocurrenciasRango(hoy, hoy, esVirtual);
            c.innerHTML = `${hero}<h4 style="margin:12px 0 4px">Agenda de hoy · ${fmtFecha(hoy)}</h4><div class="ag-time">${delDia.length ? delDia.map((o) => tarjetaEvento(o, Object.assign({}, o2, { refrescar: pintar }))).join("") : `<p style="color:#5a6b60;margin:4px 0">No hay reuniones virtuales hoy.</p>`}</div>
<h4 style="margin:16px 0 4px">Calendario completo</h4><div id="rvCal"></div>`;
            c.onclick = (e) => { if (e.target.closest("#rvCal")) return; accionEvento(e, c, Object.assign({}, o2, { refrescar: pintar })); };
            calendario(c.querySelector("#rvCal"), estado.cal, Object.assign({}, o2, { refrescar: pintar }));
        }
        pintar();
    }

    window.AdminPHAgenda = { renderAgenda, renderReuniones, proximos, eventos, ocurrencias, crearSala, enlaceDesdeId, TIPOS };
})();
