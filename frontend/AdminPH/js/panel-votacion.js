/*
 * AdminPH - Panel de votación en vivo (Patch V1)
 * Flujo real contra el backend:
 *   Asamblea -> Iniciar -> Asistencia (genera QR) -> Crear votación -> Abrir
 *   -> propietarios votan con su QR -> resultados en vivo -> Cerrar
 *   -> "Nueva votación" con el mismo QR.
 */
(function () {
    "use strict";

    const $ = (id) => document.getElementById(id);
    const esc = (v) =>
        String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const ESTADO_ASM = { preparation: "En preparación", active: "Activa", closed: "Cerrada", cancelled: "Cancelada" };
    const ESTADO_VOT = { draft: "Borrador", open: "Abierta", closed: "Cerrada", cancelled: "Archivada" };

    const S = {
        user: null,
        propertyId: null,
        assemblies: [],
        assembly: null,
        attendance: [],
        sessions: [],
        results: {},
        showArchived: false,
        poll: null
    };

    function aviso(id, tipo, texto) {
        $(id).innerHTML = texto ? `<div class="msg ${tipo}">${esc(texto)}</div>` : "";
    }

    async function seguro(id, fn) {
        try {
            aviso(id, "", "");
            return await fn();
        } catch (e) {
            if (e.status === 401) { mostrarLogin("Su sesión venció. Ingrese de nuevo."); return null; }
            aviso(id, "err", e.message || "Error inesperado");
            return null;
        }
    }

    // ------------------------------------------------------------ SESIÓN
    function mostrarLogin(mensaje) {
        detenerPolling();
        localStorage.removeItem("accessToken");
        $("app").classList.add("hide");
        $("loginBox").classList.remove("hide");
        $("logoutBtn").classList.add("hide");
        $("whoami").textContent = "";
        aviso("loginMsg", "err", mensaje || "");
    }

    async function entrar() {
        aviso("loginMsg", "", "");
        try {
            const r = await apiLogin($("loginUser").value.trim(), $("loginPass").value);
            localStorage.setItem("accessToken", r.accessToken);
            S.user = r.user;
            localStorage.setItem("panelUser", JSON.stringify(r.user));
            await iniciarApp();
        } catch (e) {
            aviso("loginMsg", "err", e.message || "No se pudo iniciar sesión");
        }
    }

    async function iniciarApp() {
        $("loginBox").classList.add("hide");
        $("app").classList.remove("hide");
        $("logoutBtn").classList.remove("hide");
        try { S.user = S.user || JSON.parse(localStorage.getItem("panelUser") || "null"); } catch (_) { /* nada */ }
        $("whoami").textContent = S.user ? `${S.user.fullName || S.user.username} (${(S.user.roles || []).join(", ")})` : "";
        const props = await apiListProperties();
        $("propSel").innerHTML = props.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
        if (!props.length) { aviso("asmMsg", "warn", "No hay conjuntos disponibles para este usuario."); return; }
        S.propertyId = sessionStorage.getItem("panelProp") || puenteId("propertyId") || props[0].id;
        if (![...$("propSel").options].some((o) => o.value === S.propertyId)) S.propertyId = props[0].id;
        $("propSel").value = S.propertyId;
        await cargarAsambleas();
    }

    // V4.2: conjunto y asamblea que AdminPH (Fase 1) tiene seleccionados en este navegador.
    function puenteId(k) { try { return JSON.parse(localStorage.getItem("adminph_bridge") || "{}")[k] || null; } catch (_) { return null; } }

    // ------------------------------------------------------------ ASAMBLEA
    async function cargarAsambleas(preferidaId) {
        sessionStorage.setItem("panelProp", S.propertyId);
        S.assemblies = (await apiListPropertyAssemblies(S.propertyId)) || [];
        $("asmSel").innerHTML = S.assemblies.length
            ? S.assemblies.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")
            : `<option value="">(sin asambleas)</option>`;
        const previa = preferidaId || sessionStorage.getItem("panelAsm") || puenteId("assemblyId");
        const elegida = S.assemblies.find((a) => a.id === previa) || S.assemblies[0] || null;
        if (elegida) $("asmSel").value = elegida.id;
        if (!S.assemblies.length) $("newAsmBox").classList.remove("hide");
        await seleccionarAsamblea(elegida);
    }

    async function seleccionarAsamblea(asm) {
        detenerPolling();
        S.assembly = asm;
        S.attendance = []; S.sessions = []; S.results = {};
        if (asm) sessionStorage.setItem("panelAsm", asm.id);
        pintarAsamblea();
        pintarAsistencia();
        pintarSesiones();
        if (!asm) return;
        await Promise.all([cargarAsistencia(), cargarSesiones()]);
    }

    function pintarAsamblea() {
        const a = S.assembly;
        const st = a ? String(a.status || "").toLowerCase() : "";
        $("asmBadge").innerHTML = a ? `<span class="badge ${esc(st)}">${esc(ESTADO_ASM[st] || st)}</span>` : "";
        $("startBtn").classList.toggle("hide", st !== "preparation");
        $("closeAsmBtn").classList.toggle("hide", st !== "active");
        const aviso_ = a && st !== "active"
            ? (st === "preparation"
                ? "La asamblea está en preparación: los QR todavía NO funcionan. Inicie la asamblea en Fase 1 → «Servidor y Asamblea»."
                : "La asamblea está cerrada: los QR ya no permiten votar.")
            : "";
        $("voteWarn").innerHTML = aviso_ ? `<div class="msg warn">${esc(aviso_)}</div>` : "";
    }

    async function iniciarAsamblea() {
        if (!S.assembly) return;
        await seguro("asmMsg", async () => {
            await apiStartAssembly(S.assembly.id);
            aviso("asmMsg", "ok", "Asamblea iniciada. Los QR de las unidades presentes ya pueden votar.");
            await cargarAsambleas(S.assembly.id);
        });
    }

    async function cerrarAsamblea() {
        if (!S.assembly) return;
        if (!confirm("¿Cerrar la asamblea?\n\nSe cerrarán las votaciones abiertas y los QR dejarán de funcionar.")) return;
        await seguro("asmMsg", async () => {
            const r = await apiCloseAssembly(S.assembly.id);
            aviso("asmMsg", "ok", `Asamblea cerrada.${r.closedSessions ? ` Se cerraron ${r.closedSessions} votación(es) abiertas.` : ""}`);
            await cargarAsambleas(S.assembly.id);
        });
    }

    async function crearAsamblea() {
        const name = $("newAsmName").value.trim();
        const meetingDate = $("newAsmDate").value;
        if (!name) return aviso("asmMsg", "err", "Escriba el nombre de la asamblea.");
        if (!meetingDate) return aviso("asmMsg", "err", "Seleccione la fecha (es obligatoria).");
        await seguro("asmMsg", async () => {
            const a = await apiCreateAssembly({ propertyId: S.propertyId, name, meetingDate });
            $("newAsmName").value = "";
            $("newAsmBox").classList.add("hide");
            aviso("asmMsg", "ok", "Asamblea creada en estado «preparación».");
            await cargarAsambleas(a.id);
        });
    }

    // ------------------------------------------------------------ ASISTENCIA / QR
    async function cargarAsistencia() {
        await seguro("attMsg", async () => {
            S.attendance = (await apiGetAssemblyAttendance(S.assembly.id)) || [];
            // Unidades representadas por un apoderado: votan con el QR de la unidad principal.
            S.represented = {};
            try {
                const grupos = (await apiGetProxyGroups(S.assembly.id)) || [];
                grupos.forEach((g) => { if (String(g.unit_id) !== String(g.principal_unit_id)) S.represented[g.unit_id] = g; });
            } catch (_) { /* sin apoderados */ }
            await aplicarEstadoFase2();
            pintarAsistencia();
        });
    }

    // V4.2: la lista de asistencia de la Fase 2 manda. Se lee la asistencia local (mismo navegador) y,
    // si una unidad figura ausente allí pero presente en el servidor, se muestra ausente y se corrige el servidor.
    function estadoFase2() {
        let mapa = {};
        try { mapa = (JSON.parse(localStorage.getItem("adminph_bridge") || "{}").unitMap) || {}; } catch (_) { mapa = {}; }
        const out = {};
        leerLocal("asistencia").forEach((a) => { const b = mapa[String(a && a.unidadId)]; if (b) out[b] = a.presente === true; });
        return out;
    }
    async function aplicarEstadoFase2() {
        const f2 = estadoFase2();
        for (const r of S.attendance) {
            if (S.represented && S.represented[r.unit_id]) continue;      // vota con el QR de su apoderado
            if (!(r.unit_id in f2)) continue;
            r.attendedServidor = r.attended;
            if (r.attended && f2[r.unit_id] === false) {
                r.attended = false; r.desfase = true;
                try { await marcar(r.unit_id, false); r.desfase = "corregido"; } catch (_) { /* queda solo en pantalla */ }
            }
        }
    }

    function pintarAsistencia() {
        const tot = S.attendance.length;
        const pres = S.attendance.filter((r) => r.attended).length;
        const coef = S.attendance.filter((r) => r.attended).reduce((t, r) => t + Number(r.total_coefficient || 0), 0);
        $("attSummary").innerHTML = tot
            ? `<strong>${pres}</strong> de ${tot} unidades presentes · coeficiente presente: <strong>${coef.toFixed(4)}</strong>`
            : "Sin unidades cargadas.";
        pintarUnidadesInfo();
        pintarCandidatos();
        $("attBody").innerHTML = S.attendance.map((r) => `
            <tr>
              <td><strong>${esc(r.unit_number)}</strong>${r.attendee_name_snapshot ? `<br><small style="color:#6c7a6c">${esc(r.attendee_name_snapshot)}</small>` : ""}</td>
              <td>${Number(r.total_coefficient || 0).toFixed(4)}</td>
              <td>${r.attended ? '<span style="color:#1b5e20;font-weight:700">✔ Presente</span>' : '<span style="color:#9a9a9a">— Ausente</span>'}${r.desfase ? '<br><small style="color:#b45309">Según la lista de asistencia (Fase 2)</small>' : ""}<input type="checkbox" data-att="${esc(r.unit_id)}" ${r.attended ? "checked" : ""} style="width:auto"></td>
              <td>${S.represented && S.represented[r.unit_id] ? `<small style="color:#2d6a4f">🤝 Vota con el QR de su apoderado${S.represented[r.unit_id].proxy_name ? ": " + esc(S.represented[r.unit_id].proxy_name) : ""}</small>` : (r.attended && r.qrUrl ? `<button class="b sec" data-qr="${esc(r.unit_id)}">Ver QR</button>` : "—")}</td>
            </tr>`).join("");
    }

    async function marcar(unitId, attended, extra) {
        return apiUpsertAssemblyAttendance(S.assembly.id, unitId, { attended, verificationMethod: "operator", ...(extra || {}) });
    }

    async function alternarAsistencia(unitId, attended, checkbox) {
        try {
            aviso("attMsg", "", "");
            try {
                await marcar(unitId, attended);
            } catch (e) {
                // Unidad sin propietario registrado: el backend pide el nombre del asistente.
                if (attended && /attendeeName/i.test(e.message || "")) {
                    const nombre = prompt("Esta unidad no tiene propietario registrado.\nEscriba el nombre de quien asiste:");
                    if (!nombre || !nombre.trim()) throw new Error("Asistencia no registrada: falta el nombre del asistente.");
                    await marcar(unitId, true, { attendeeName: nombre.trim() });
                } else throw e;
            }
            await cargarAsistencia();
        } catch (e) {
            if (e.status === 401) return mostrarLogin("Su sesión venció. Ingrese de nuevo.");
            checkbox.checked = !attended;
            aviso("attMsg", "err", e.message || "No se pudo registrar la asistencia");
        }
    }

    async function marcarTodas() {
        const pendientes = S.attendance.filter((r) => !r.attended);
        if (!pendientes.length) return aviso("attMsg", "ok", "Todas las unidades ya están presentes.");
        if (!confirm(`¿Marcar ${pendientes.length} unidad(es) como presentes?\n(Útil para pruebas o cuando el conjunto ya verificó la asistencia.)`)) return;
        let ok = 0; const fallos = [];
        for (const r of pendientes) {
            try { await marcar(r.unit_id, true); ok++; }
            catch (e) { if (e.status === 401) return mostrarLogin("Su sesión venció."); fallos.push(`${r.unit_number}: ${e.message}`); }
            aviso("attMsg", "warn", `Procesando… ${ok + fallos.length}/${pendientes.length}`);
        }
        await cargarAsistencia();
        aviso("attMsg", fallos.length ? "warn" : "ok",
            `${ok} unidad(es) marcadas.${fallos.length ? ` No se pudieron marcar ${fallos.length}: ${fallos.slice(0, 3).join(" | ")}` : ""}`);
    }

    // La URL del QR se arma con la MISMA dirección con la que el administrador abrió este panel
    // (misma IP/puerto/carpeta), así no depende de PUBLIC_APP_URL del .env del backend.
    function urlVotoPublica(r) {
        let token = r.qrToken || null;
        if (!token && r.qrUrl) { try { token = new URL(r.qrUrl).searchParams.get("voteToken"); } catch (_) { /* nada */ } }
        if (!token) return r.qrUrl;
        let pub = "";
        try { pub = localStorage.getItem("adminph_public_base") || ""; } catch (_) { /* nada */ }
        const u = pub ? new URL(pub) : new URL("index.html", location.href);
        u.search = ""; u.hash = "";
        u.searchParams.set("voteToken", token);
        return u.toString();
    }

    function verQr(unitId) {
        const r = S.attendance.find((x) => x.unit_id === unitId);
        if (!r || !(r.qrToken || r.qrUrl)) return;
        const url = urlVotoPublica(r);
        $("qrTitle").textContent = `Unidad ${r.unit_number}`;
        $("qrUrl").textContent = url;
        const cont = $("qrCanvas");
        cont.innerHTML = "";
        if (typeof QRCode !== "undefined") new QRCode(cont, { text: url, width: 240, height: 240 });
        else cont.innerHTML = '<div class="msg warn">No cargó la librería de QR (¿sin internet?). Use el enlace.</div>';
        let pubActiva = false;
        try { pubActiva = !!localStorage.getItem("adminph_public_base"); } catch (_) { /* nada */ }
        $("qrWarn").innerHTML = (!pubActiva && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname))
            ? `<div class="msg warn">⚠️ Abrió este panel con <strong>${esc(location.hostname)}</strong>: el celular NO podrá abrir este QR. Escriba la <strong>dirección pública</strong> en AdminPH → Fase 1 → Servidor y Asamblea (sección 4), o abra el panel con la IP de su computador, y vuelva a pulsar «Ver QR».</div>`
            : "";
        try { $("qrWarn").innerHTML += `<p class="hint" style="margin:8px 0 0">¿El celular no abre el QR? Abra en el celular: <br><code>${esc(new URL("diagnostico.html", location.href).toString())}</code></p>`; } catch (_) { /* nada */ }
        $("qrModal").classList.add("on");
        $("qrCopy").onclick = async () => {
            try { await navigator.clipboard.writeText(url); $("qrCopy").textContent = "¡Copiado!"; }
            catch (_) { prompt("Copie el enlace:", url); }
            setTimeout(() => ($("qrCopy").textContent = "Copiar enlace"), 1500);
        };
    }


    // ------------------------------------------------------------ UNIDADES DE FASE 1 -> BACKEND
    function leerLocal(clave) {
        try { const v = JSON.parse(localStorage.getItem(clave) || "null"); return Array.isArray(v) ? v : []; } catch (_) { return []; }
    }

    function pintarUnidadesInfo() {
        const locales = leerLocal("unidades").length;
        const enBackend = S.attendance.length;
        const dif = locales && locales !== enBackend;
        $("unitsInfo").innerHTML = `Unidades en el backend: <strong>${enBackend}</strong> · en Fase 1 (este navegador): <strong>${locales}</strong>` +
            (dif ? ` <span style="color:#8a6100">← no coinciden: sincronice en Fase 1 → «Servidor y Asamblea»</span>` : "");
    }

    // Convierte una unidad de Fase 1 al formato exacto que acepta el backend (rechaza campos desconocidos).
    function unidadParaBackend(u, idx) {
        const txt = (v, max) => (v == null ? undefined : String(v).slice(0, max));
        const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 1e8) / 1e8 : undefined; };
        const fila = parseInt(u.numeroFila, 10);
        return {
            id: u.id != null ? String(u.id) : undefined,
            numeroFila: fila >= 1 ? fila : idx + 1,
            concatenado: String(u.concatenado || `Unidad ${idx + 1}`).trim().slice(0, 200),
            tipo: txt(u.tipo, 30),
            jerarquia: u.jerarquia && typeof u.jerarquia === "object" && !Array.isArray(u.jerarquia) ? u.jerarquia : {},
            propietario: txt(u.propietario, 200),
            numeroDocumento: txt(u.numeroDocumento, 80),
            correo: txt(u.correo, 255),
            telefono: txt(u.telefono, 80),
            coeficiente: num(u.coeficiente),
            coeficienteParqueadero: num(u.coeficienteParqueadero),
            coeficienteTotal: num(u.coeficienteTotal),
            sextoNivelValor: txt(u.sextoNivelValor, 200)
        };
    }

    async function importarDeFase1() {
        const locales = leerLocal("unidades");
        if (!locales.length) {
            return aviso("attMsg", "warn", "No hay unidades de Fase 1 en ESTE navegador. Abra el panel con la misma dirección con la que abre AdminPH (mismo http://IP:puerto), porque cada dirección guarda sus propios datos.");
        }
        const vistos = new Set();
        const unidades = locales.map(unidadParaBackend).filter((u) => (vistos.has(u.concatenado.toLowerCase()) ? false : vistos.add(u.concatenado.toLowerCase())));
        if (!confirm(`Se enviarán ${unidades.length} unidades de Fase 1 al backend.\n\nLas unidades del backend que NO estén en esa lista (por ejemplo las del demo) se desactivarán.\n\n¿Continuar?`)) return;

        await seguro("attMsg", async () => {
            aviso("attMsg", "warn", "Enviando unidades…");
            const res = await apiSyncPropertyUnits(S.propertyId, unidades, true);
            const backend = res.units || [];
            let extra = "";

            const presentes = leerLocal("asistencia").filter((a) => a && a.presente === true);
            if (presentes.length && S.assembly && confirm(`¿Copiar también la asistencia de Fase 2 (${presentes.length} unidad(es) presentes) a la asamblea «${S.assembly.name}»?`)) {
                let ok = 0; const sinNombre = [];
                for (const a of presentes) {
                    const lu = locales.find((x) => String(x.id) === String(a.unidadId));
                    const bu = lu && backend.find((b) => String(b.concatenado).trim().toLowerCase() === String(lu.concatenado).trim().toLowerCase());
                    if (!bu) continue;
                    const nombre = String(a.nombreAsistente || lu.propietario || "").trim();
                    try { await marcar(bu.id, true, nombre ? { attendeeName: nombre } : {}); ok++; }
                    catch (e) { if (e.status === 401) throw e; sinNombre.push(lu.concatenado); }
                    aviso("attMsg", "warn", `Copiando asistencia… ${ok + sinNombre.length}/${presentes.length}`);
                }
                extra = ` Asistencia copiada: ${ok}.` + (sinNombre.length ? ` Sin nombre de asistente (márquelas a mano en la tabla): ${sinNombre.join(", ")}.` : "");
            }
            await cargarAsistencia();
            aviso("attMsg", "ok", `Unidades en el backend: ${backend.length}${res.deactivated ? ` (${res.deactivated} desactivadas)` : ""}.${extra}`);
        });
    }

    // ------------------------------------------------------------ CANDIDATOS DESDE ASISTENTES
    const presentesAhora = () => S.attendance.filter((r) => r.attended);
    const etiquetaCandidato = (r) => {
        const n = String(r.attendee_name_snapshot || "").trim();
        return n ? `${n} (${r.unit_number})` : `Unidad ${r.unit_number}`;
    };

    function pintarCandidatos() {
        const p = presentesAhora();
        $("candSel").innerHTML = p.length
            ? p.map((r) => `<option value="${esc(r.unit_id)}">${esc(etiquetaCandidato(r))}</option>`).join("")
            : `<option value="">(primero marque asistentes presentes)</option>`;
    }

    function agregarOpciones(lineas) {
        const actuales = leerOpciones($("vOptions").value);
        const vistas = new Set(actuales.map((x) => x.toLowerCase()));
        lineas.forEach((l) => { if (!vistas.has(l.toLowerCase())) { actuales.push(l); vistas.add(l.toLowerCase()); } });
        $("vOptions").value = actuales.join("\n");
    }

    // ------------------------------------------------------------ VOTACIONES
    async function cargarSesiones() {
        await seguro("voteMsg", async () => {
            const lista = (await apiListVotingSessions(S.assembly.id)) || [];
            S.sessions = lista.slice().reverse(); // la más reciente primero
            await refrescarResultados(true);
            pintarSesiones();
            ajustarPolling();
        });
    }

    async function refrescarResultados(todas) {
        const objetivo = S.sessions.filter((s) => s.status === "open" || (todas && s.status === "closed"));
        await Promise.all(objetivo.map(async (s) => {
            try { S.results[s.id] = await apiGetVotingResults(s.id); } catch (_) { /* se reintenta en el siguiente ciclo */ }
        }));
    }

    function pintarResultados(s) {
        const r = S.results[s.id];
        if (!r) return s.status === "draft" ? "" : `<p class="hint">Sin resultados todavía.</p>`;
        const usaCoef = r.session.countingMethod === "coefficient";
        const base = (o) => (usaCoef ? o.coefficientTotal : o.voteCount);
        const total = r.options.reduce((t, o) => t + base(o), 0);
        const max = Math.max(0, ...r.options.map(base));
        const lideres = r.options.filter((o) => base(o) === max).length;
        const filas = r.options.map((o) => {
            const pct = total ? (base(o) / total) * 100 : 0;
            const lider = max > 0 && lideres === 1 && base(o) === max;
            return `<div class="opt"><span>${lider ? "🏆 " : ""}${esc(o.label)}</span><span><strong>${o.voteCount}</strong> voto(s) · coef. ${o.coefficientTotal.toFixed(4)} · ${pct.toFixed(1)}%</span></div>
                    <div class="bar"><i style="width:${pct}%"></i></div>`;
        }).join("");
        return `<p class="hint" style="margin-top:10px">Se decide por: <strong>${usaCoef ? "coeficiente" : "nominal (1 unidad = 1 voto)"}</strong> · Votos emitidos: <strong>${r.ballotsCast}</strong> de ${r.eligibleUnitsPresent} unidades presentes · faltan ${r.remainingUnits}. El % usa ese criterio; se muestran ambos conteos.</p>${filas}`;
    }

    function pintarSesiones() {
        const asmActiva = S.assembly && String(S.assembly.status).toLowerCase() === "active";
        const visibles = S.sessions.filter((s) => S.showArchived || s.status !== "cancelled");
        if (!visibles.length) { $("sessions").innerHTML = S.assembly ? `<p class="hint" style="margin-top:14px">No hay votaciones para mostrar en esta asamblea.</p><div class="row"><button class="b sec" data-refreshall="1">↻ Actualizar todo</button></div>` : ""; return; }
        const barra = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0"><button class="b sec" data-refreshall="1">↻ Actualizar todo</button><span class="hint" style="margin:0">Se actualiza solo cada 4 segundos${S.lastSync ? " · última lectura " + S.lastSync : ""}. «Archivar» solo oculta la votación en este panel; no borra nada de la Fase 3.</span></div>`;
        $("sessions").innerHTML = barra + visibles.map((s) => {
            const opts = (s.options || []).map((o) => esc(o.label)).join(" · ");
            let btns = "";
            if (s.status === "draft") btns += `<button class="b" data-open="${esc(s.id)}" ${asmActiva ? "" : "disabled title='Inicie la asamblea en Fase 1'"}>▶ Abrir votación</button>`;
            if (s.status === "open") btns += `<button class="b dan" data-close="${esc(s.id)}">■ Cerrar votación</button>`;
            if (s.status === "closed") btns += `<button class="b sec" data-dup="${esc(s.id)}">↻ Nueva votación con las mismas opciones</button>`;
            if (s.status === "open" || s.status === "closed") btns += ` <button class="b sec" data-refresh="${esc(s.id)}">Actualizar resultados</button>`;
            if (s.status === "draft" || s.status === "closed") btns += ` <button class="b dan" data-arch="${esc(s.id)}" title="Solo se oculta en este panel; los votos y la auditoría se conservan y la Fase 3 no cambia">🗑 Archivar (ocultar)</button>`;
            return `<div class="sess">
                <div class="row" style="align-items:center"><h3 style="flex:1">${esc(s.title)}</h3><span class="badge ${esc(s.status)} auto">${esc(ESTADO_VOT[s.status] || s.status)}</span></div>
                <p class="hint" style="margin:0 0 6px">${s.voting_type === "coefficient" ? "Por coeficiente" : "Nominal"} · Opciones: ${opts || "—"}</p>
                ${pintarResultados(s)}
                <div style="margin-top:10px">${btns}</div>
            </div>`;
        }).join("");
    }

    function leerOpciones(texto) {
        const vistas = new Set();
        return String(texto || "").split("\n").map((l) => l.trim()).filter((l) => {
            const k = l.toLowerCase();
            if (!l || vistas.has(k)) return false;
            vistas.add(k); return true;
        });
    }

    async function crearVotacion(titulo, metodo, ganadores, opciones) {
        const s = await apiCreateVotingSession(S.assembly.id, {
            title: titulo, countingMethod: metodo, inputMode: "qr", winnersRequired: Number(ganadores) || 1
        });
        for (const label of opciones) await apiAddVotingOption(s.id, label);
        return s;
    }

    async function onCrearVotacion() {
        if (!S.assembly) return aviso("voteMsg", "err", "Seleccione una asamblea.");
        const titulo = $("vTitle").value.trim();
        const opciones = leerOpciones($("vOptions").value);
        if (titulo.length < 2) return aviso("voteMsg", "err", "Escriba el título de la votación.");
        if (opciones.length < 2) return aviso("voteMsg", "err", "Agregue al menos dos opciones (una por línea).");
        await seguro("voteMsg", async () => {
            await crearVotacion(titulo, $("vMethod").value, $("vWinners").value, opciones);
            $("vTitle").value = ""; $("vOptions").value = "";
            aviso("voteMsg", "ok", "Votación creada en borrador. Presione «Abrir votación» cuando quiera que los propietarios voten.");
            await cargarSesiones();
        });
    }

    async function duplicar(id) {
        const base = S.sessions.find((s) => s.id === id);
        if (!base) return;
        const titulo = prompt("Título de la nueva votación:", `${base.title} (nueva ronda)`);
        if (!titulo || titulo.trim().length < 2) return;
        await seguro("voteMsg", async () => {
            await crearVotacion(titulo.trim(), base.voting_type === "coefficient" ? "coefficient" : "nominal",
                base.winners_required || 1, (base.options || []).map((o) => o.label));
            aviso("voteMsg", "ok", "Nueva votación creada en borrador. Los propietarios usarán el mismo QR.");
            await cargarSesiones();
        });
    }

    async function abrir(id) {
        const otras = S.sessions.filter((s) => s.status === "open" && s.id !== id);
        if (otras.length && !confirm(`Ya hay ${otras.length} votación(es) abierta(s): «${otras.map((s) => s.title).join("», «")}».\n\nSi abre esta también, los propietarios verán AMBAS a la vez en su celular.\n\n¿Desea abrirla de todos modos?\n(Normalmente conviene cerrar primero la anterior.)`)) return;
        await seguro("voteMsg", async () => { await apiOpenVotingSession(id); await cargarSesiones(); });
    }

    async function archivar(id) {
        if (!confirm("¿Archivar esta votación?\n\nDejará de verse en el panel. Los votos y la auditoría se conservan en la base de datos.")) return;
        await seguro("voteMsg", async () => { await apiArchiveVotingSession(id); await cargarSesiones(); });
    }

    async function archivarCerradas() {
        const lista = S.sessions.filter((x) => x.status === "closed");
        if (!lista.length) return aviso("voteMsg", "warn", "No hay votaciones cerradas por archivar.");
        if (!confirm(`¿Archivar ${lista.length} votación(es) cerrada(s)?\n\nDejarán de verse en el panel; los votos y la auditoría se conservan.`)) return;
        await seguro("voteMsg", async () => {
            for (const x of lista) await apiArchiveVotingSession(x.id);
            aviso("voteMsg", "ok", `${lista.length} votación(es) archivada(s).`);
            await cargarSesiones();
        });
    }

    async function cerrar(id) {
        if (!confirm("¿Cerrar esta votación?\n\nLos propietarios ya no podrán votar en ella.")) return;
        await seguro("voteMsg", async () => { await apiCloseVotingSession(id); await cargarSesiones(); });
    }

    // ------------------------------------------------------------ RESULTADOS EN VIVO
    function ajustarPolling() {
        // V4.0: el monitor se actualiza SIEMPRE (no solo si había una votación abierta al cargar): así aparecen solas
        // las votaciones nuevas que se abren desde la Fase 3 y los cambios de asistencia.
        if (S.poll) return;
        S.poll = setInterval(async () => {
            if (document.hidden || !S.assembly || S.busy) return;
            await sincronizarTodo(false);
        }, 4000);
    }

    async function sincronizarTodo(mostrarError) {
        if (!S.assembly) return;
        S.busy = true;
        try {
            const lista = (await apiListVotingSessions(S.assembly.id)) || [];
            S.sessions = lista.slice().reverse();
            await refrescarResultados(true);
            S.lastSync = new Date().toLocaleTimeString("es-CO");
            pintarSesiones();
            await recargarAsistenciaSilencioso();
        } catch (e) { if (mostrarError) aviso("voteMsg", "err", e.message || "No se pudo actualizar"); }
        finally { S.busy = false; }
    }

    async function recargarAsistenciaSilencioso() {
        try { S.attendance = (await apiGetAssemblyAttendance(S.assembly.id)) || S.attendance; pintarAsistencia(); } catch (_) { /* silencioso */ }
    }

    function detenerPolling() { if (S.poll) { clearInterval(S.poll); S.poll = null; } }

    // ------------------------------------------------------------ EVENTOS
    function enlazar() {
        $("loginBtn").onclick = entrar;
        $("loginPass").onkeydown = (e) => { if (e.key === "Enter") entrar(); };
        $("logoutBtn").onclick = () => { try { detenerPolling(); } catch (_) {} location.href = "index.html?fase=3"; };
        $("propSel").onchange = async (e) => { S.propertyId = e.target.value; await seguro("asmMsg", () => cargarAsambleas()); };
        $("asmSel").onchange = async (e) => seleccionarAsamblea(S.assemblies.find((a) => a.id === e.target.value) || null);
        $("startBtn").onclick = iniciarAsamblea;
        $("closeAsmBtn").onclick = cerrarAsamblea;
        $("newAsmToggle").onclick = () => $("newAsmBox").classList.toggle("hide");
        $("newAsmBtn").onclick = crearAsamblea;
        $("allPresentBtn").onclick = marcarTodas;
        $("reloadAttBtn").onclick = cargarAsistencia;
        $("createVoteBtn").onclick = onCrearVotacion;
        $("importBtn").onclick = importarDeFase1;
        $("candAdd").onclick = () => {
            const r = S.attendance.find((x) => x.unit_id === $("candSel").value);
            if (r) agregarOpciones([etiquetaCandidato(r)]);
        };
        $("candAddAll").onclick = () => agregarOpciones(presentesAhora().map(etiquetaCandidato));
        $("showArch").onchange = (e) => { S.showArchived = e.target.checked; pintarSesiones(); };
        $("archClosedBtn").onclick = archivarCerradas;
        $("qrClose").onclick = () => $("qrModal").classList.remove("on");
        $("qrModal").onclick = (e) => { if (e.target === $("qrModal")) $("qrModal").classList.remove("on"); };

        $("attBody").addEventListener("change", (e) => {
            const cb = e.target.closest("input[data-att]");
            if (cb) alternarAsistencia(cb.dataset.att, cb.checked, cb);
        });
        $("attBody").addEventListener("click", (e) => {
            const b = e.target.closest("[data-qr]");
            if (b) verQr(b.dataset.qr);
        });
        $("sessions").addEventListener("click", async (e) => {
            const t = e.target.closest("button");
            if (!t) return;
            if (t.dataset.open) abrir(t.dataset.open);
            else if (t.dataset.close) cerrar(t.dataset.close);
            else if (t.dataset.dup) duplicar(t.dataset.dup);
            else if (t.dataset.arch) archivar(t.dataset.arch);
            else if (t.dataset.refresh) { await refrescarResultados(true); pintarSesiones(); }
            else if (t.dataset.refreshall) await sincronizarTodo(true);
        });
    }

    async function arrancar() {
        $("newAsmDate").value = new Date().toISOString().slice(0, 10);
        enlazar();
        if (!localStorage.getItem("accessToken")) return mostrarLogin("");
        try { await iniciarApp(); }
        catch (e) {
            if (e.status === 401 || e.status === 403) mostrarLogin("Su sesión venció. Ingrese de nuevo.");
            else { mostrarLogin(`No se pudo conectar con el backend (${e.message}). Verifique que esté encendido.`); }
        }
    }

    arrancar();
})();
