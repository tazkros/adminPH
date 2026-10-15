/*
 * AdminPH - Pantalla pública de votación por QR (Patch V1)
 * ---------------------------------------------------------------
 * Se activa SOLO cuando la URL trae ?voteToken=...
 * Habla directamente con el backend (no usa localStorage para los votos):
 *   GET  /api/public/voting/access?token=...            -> votaciones abiertas
 *   POST /api/public/voting/sessions/:id/vote           -> registra el voto
 *
 * El token del QR NO se "gasta": lo que el backend limita es una papeleta
 * por unidad en cada votación. Cuando el administrador abre una NUEVA
 * votación, el mismo QR vuelve a servir para esa votación.
 *
 * Debe cargarse DESPUÉS de api.js y ANTES de app.js.
 */
(function () {
    "use strict";

    const TOKEN = new URLSearchParams(location.search).get("voteToken");
    if (!TOKEN) return; // no es un enlace de votación: no hace nada

    window.ADMINPH_PUBLIC_VOTE = true;

    // Evita el parpadeo del login/dashboard mientras carga la pantalla pública.
    const ocultar = document.createElement("style");
    ocultar.textContent = "body > * { display: none !important; }";
    document.head.appendChild(ocultar);

    const POLL_MS = 5000;
    const state = {
        loading: true,
        error: null,      // { fatal: boolean, text: string }
        offline: false,
        data: null,       // respuesta de /public/voting/access
        selected: {},     // sessionId -> optionId
        sending: {},      // sessionId -> boolean
        msg: {},          // sessionId -> { ok?: true, err?: string }
        sig: ""
    };

    const esc = (v) =>
        String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const CSS = `
    #pv-root{max-width:520px;margin:0 auto;padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1b2a1b}
    #pv-root *{box-sizing:border-box}
    .pv-head{background:#2d6a4f;color:#fff;border-radius:14px;padding:16px;text-align:center;margin-bottom:14px}
    .pv-head h1{font-size:18px;margin:0 0 4px}
    .pv-head p{margin:2px 0;font-size:14px;opacity:.95}
    .pv-card{background:#fff;border:1px solid #d7e5d7;border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.05)}
    .pv-card h3{margin:0 0 4px;font-size:17px;color:#2d6a4f}
    .pv-meta{margin:0 0 10px;font-size:12px;color:#6c7a6c}
    .pv-opt{display:flex;align-items:center;gap:12px;padding:14px;margin:8px 0;border:2px solid #d0e0d0;border-radius:12px;cursor:pointer;font-size:16px}
    .pv-opt input{transform:scale(1.4);flex:none}
    .pv-opt.sel{border-color:#2d6a4f;background:#eef7f0}
    .pv-btn{width:100%;margin-top:8px;padding:14px;font-size:17px;font-weight:600;border:0;border-radius:12px;background:#2d6a4f;color:#fff;cursor:pointer}
    .pv-btn[disabled]{background:#a9bfae;cursor:not-allowed}
    .pv-btn.sec{background:#e8f5e9;color:#2d6a4f}
    .pv-ok{background:#e8f5e9;border:1px solid #b7dfc0;color:#1f5a35;padding:12px;border-radius:10px;font-weight:600}
    .pv-warn{background:#fff8e1;border:1px solid #ffe08a;color:#7a5b00;padding:12px;border-radius:10px}
    .pv-err{background:#fdecea;border:1px solid #f5b5ae;color:#8a1f14;padding:12px;border-radius:10px;margin-top:8px}
    .pv-foot{text-align:center;font-size:12px;color:#8a9a8a;margin-top:16px}
    `;

    function montar() {
        const estilo = document.createElement("style");
        estilo.textContent = CSS;
        document.head.appendChild(estilo);
        document.body.innerHTML = '<div id="pv-root"></div>';
        ocultar.remove();
        const root = document.getElementById("pv-root");

        root.addEventListener("change", (e) => {
            const r = e.target.closest("input[type=radio][data-session]");
            if (!r) return;
            state.selected[r.dataset.session] = r.value;
            state.msg[r.dataset.session] = null;
            render();
        });
        root.addEventListener("click", (e) => {
            const send = e.target.closest("[data-send]");
            if (send) return enviar(send.dataset.send);
            if (e.target.closest("[data-refresh]")) return cargar(false);
        });
    }

    function firma() {
        const ss = (state.data?.sessions || []).map((s) => [s.id, s.already_voted, (s.options || []).length]);
        return JSON.stringify([ss, state.error, state.offline, state.data?.unitNumber]);
    }

    function renderSesion(s) {
        const opciones = s.options || [];
        const metodo = s.counting_method === "coefficient" ? "Voto ponderado por coeficiente" : "Un voto por unidad";
        let h = `<section class="pv-card"><h3>🗳️ ${esc(s.title)}</h3><p class="pv-meta">${metodo}</p>`;

        if (s.already_voted) {
            h += `<div class="pv-ok">✅ Su voto quedó registrado. ¡Gracias por participar!</div>`;
        } else if (!opciones.length) {
            h += `<div class="pv-warn">⏳ Esta votación aún no tiene opciones.</div>`;
        } else {
            const sel = state.selected[s.id];
            opciones.forEach((o) => {
                const on = sel === o.id;
                h += `<label class="pv-opt ${on ? "sel" : ""}">
                        <input type="radio" name="opt_${esc(s.id)}" data-session="${esc(s.id)}" value="${esc(o.id)}" ${on ? "checked" : ""}>
                        <span>${esc(o.label)}</span></label>`;
            });
            const busy = !!state.sending[s.id];
            h += `<button class="pv-btn" data-send="${esc(s.id)}" ${!sel || busy ? "disabled" : ""}>${busy ? "Enviando…" : "ENVIAR VOTO"}</button>`;
            const m = state.msg[s.id];
            if (m?.err) h += `<div class="pv-err">⚠️ ${esc(m.err)}</div>`;
        }
        return h + "</section>";
    }

    function render() {
        const root = document.getElementById("pv-root");
        if (!root) return;
        let h = "";

        if (state.loading) {
            h = `<div class="pv-card" style="text-align:center">Cargando su información de votación…</div>`;
        } else if (state.error?.fatal) {
            h = `<div class="pv-head"><h1>🏢 AdminPH</h1><p>Votación electrónica</p></div>
                 <div class="pv-card"><div class="pv-err" style="margin:0">🚫 <strong>${esc(state.error.text)}</strong></div>
                 <p class="pv-meta" style="margin-top:12px">Si cree que es un error, acérquese al operador de la asamblea para verificar su asistencia o reemitir su código QR.</p>
                 <button class="pv-btn sec" data-refresh>🔄 Reintentar</button></div>`;
        } else if (state.data) {
            const d = state.data;
            h = `<div class="pv-head"><h1>🏢 ${esc(d.assemblyName || "Asamblea")}</h1>
                 <p><strong>Unidad ${esc(d.unitNumber)}</strong></p>
                 ${d.attendeeName ? `<p>${esc(d.attendeeName)}</p>` : ""}</div>`;
            if (d.proxy && d.proxy.units && d.proxy.units.length > 1) {
                h += `<div class="pv-ok" style="margin-bottom:12px;text-align:left">🤝 <strong>Su voto vale por ${d.proxy.units.length} unidades</strong> (coeficiente sumado ${Number(d.proxy.totalCoefficient || 0).toFixed(4)}%):<br><span style="font-weight:400">${d.proxy.units.map((x) => esc(x.unitNumber)).join(", ")}</span></div>`;
            }
            if (state.offline) h += `<div class="pv-warn" style="margin-bottom:12px">📶 Sin conexión con el servidor. Reintentando…</div>`;
            if (d.sessions.length && d.sessions.every((x) => x.already_voted)) {
                h += `<div class="pv-ok" style="margin-bottom:12px">🙌 Ya votó en todas las votaciones abiertas. <strong>Puede cerrar esta página.</strong><br><span style="font-weight:400">Si el administrador abre otra votación, este mismo QR volverá a funcionar.</span></div>`;
            }
            if (!d.sessions.length) {
                h += `<div class="pv-card" style="text-align:center"><div class="pv-warn">⏳ No hay votaciones abiertas en este momento.<br>Esta pantalla se actualiza sola cuando el administrador abra una.</div>
                      <button class="pv-btn sec" data-refresh>🔄 Actualizar ahora</button></div>`;
            } else {
                h += d.sessions.map(renderSesion).join("");
            }
        } else if (state.error) {
            h = `<div class="pv-card"><div class="pv-err" style="margin:0">⚠️ ${esc(state.error.text)}</div>
                 <button class="pv-btn sec" data-refresh>🔄 Reintentar</button>
                 ${state.error.diag ? `<p class="pv-meta" style="margin-top:12px;text-align:center"><a href="diagnostico.html">Abrir diagnóstico de conexión</a></p>` : ""}</div>`;
        }
        root.innerHTML = h + `<p class="pv-foot">AdminPH · Ley 675 de 2001</p>`;
    }

    async function cargar(silencioso) {
        try {
            state.data = await apiPublicVotingAccess(TOKEN);
            state.error = null;
            state.offline = false;
        } catch (e) {
            if (e.status === 401 || e.status === 400) {
                state.data = null;
                state.error = { fatal: true, text: e.message || "QR no válido" };
            } else if (state.data) {
                state.offline = true; // conservamos lo último que se vio
            } else {
                const donde = typeof API_URL !== "undefined" ? API_URL : "el servidor";
                state.error = { fatal: false, text: `No se pudo conectar con ${donde}. Verifique que el celular esté en la misma red Wi-Fi que el computador y que el backend esté encendido.`, diag: true };
            }
        }
        state.loading = false;
        const nueva = firma();
        if (!silencioso || nueva !== state.sig) {
            state.sig = nueva;
            render();
        }
    }

    async function enviar(sessionId) {
        const optionId = state.selected[sessionId];
        const sesion = state.data?.sessions.find((s) => s.id === sessionId);
        const opcion = sesion?.options.find((o) => o.id === optionId);
        if (!optionId || !opcion || state.sending[sessionId]) return;

        if (!window.confirm(`¿Confirma su voto por:\n\n"${opcion.label}"?\n\nUna vez enviado no podrá cambiarlo.`)) return;

        state.sending[sessionId] = true;
        state.msg[sessionId] = null;
        render();
        try {
            await apiPublicCastVote(sessionId, TOKEN, optionId);
            delete state.selected[sessionId];
            await cargar(false); // trae already_voted=true desde el servidor
        } catch (e) {
            state.msg[sessionId] = { err: e.message || "No se pudo registrar el voto" };
            if (e.status === 409) await cargar(true); // ya votó / votación cerrada
        } finally {
            state.sending[sessionId] = false;
            render();
        }
    }

    function iniciar() {
        montar();
        render();
        cargar(false);
        setInterval(() => { if (!document.hidden) cargar(true); }, POLL_MS);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
})();
