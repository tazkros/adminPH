/*
 * AdminPH - Puente Frontend <-> Backend (Patch V2)
 * ---------------------------------------------------------------------------
 * Conecta las Fases 1, 2 y 3 (app.js) con el servidor para que los QR y los
 * votos de los celulares sean REALES:
 *
 *   Fase 1  -> conjunto real + unidades + asamblea (crear / iniciar / cerrar)
 *   Fase 2  -> la asistencia marcada genera el QR real de cada unidad
 *   Fase 3  -> abrir/cerrar una votación la crea/cierra en el servidor y los
 *              votos que llegan desde los celulares alimentan las pantallas
 *
 * app.js le entrega sus datos mediante AdminPHBridge.register({...}); este
 * archivo NO conoce el interior de app.js. Si el servidor no responde, app.js
 * sigue funcionando como antes (todo local).
 *
 * Debe cargarse DESPUÉS de api.js y ANTES de app.js.
 */
(function () {
    "use strict";

    // En la pantalla pública de votación (celular) el puente no debe activarse.
    if (new URLSearchParams(location.search).get("voteToken")) return;

    const LS_KEY = "adminph_bridge";
    const DEMO_PROPERTY_ID = "00000000-0000-0000-0000-000000000010";
    const TICK_MS = 3000;

    // ------------------------------------------------------------------ estado
    const blank = () => ({
        propertyId: null, propertyName: "",
        assemblyId: null, assemblyName: "", assemblyStatus: "",
        unitsSig: "", unitMap: {},        // idLocal -> idBackend
        attSig: {},                       // idLocal -> firma de la última asistencia enviada
        qr: {},                           // idLocal -> token QR activo
        sessions: {}                      // claveVotacion -> { sessionId, labels, optionIds, backendStatus }
    });

    let st = blank();
    try { st = Object.assign(blank(), JSON.parse(localStorage.getItem(LS_KEY) || "{}")); } catch (_) { st = blank(); }
    const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (_) { /* nada */ } };

    const rt = {
        offline: false,      // no se pudo llegar al servidor en el último intento
        authFailed: false,   // el servidor rechazó la llave de sesión (vencida)
        lastError: "",       // último mensaje de error legible
        attIssues: [],       // asistencias que no se pudieron enviar (mensajes)
        handlers: null,
        running: false, again: false, timer: null, lastQrAt: 0, lastStatusAt: 0
    };

    const token = () => { try { return localStorage.getItem("accessToken"); } catch (_) { return null; } };
    const hasApi = () => typeof apiRequest === "function";

    function isConnected() { return !!token() && !rt.authFailed && hasApi(); }
    function user() { try { return JSON.parse(localStorage.getItem("adminph_bridge_user") || "null"); } catch (_) { return null; } }

    // Interpreta un error de red / servidor y actualiza las banderas.
    function noteError(e) {
        const status = e && e.status;
        if (status === 401) { rt.authFailed = true; rt.lastError = "La sesión con el servidor venció. Conéctese de nuevo en Fase 1."; }
        else if (status) { rt.lastError = e.message || `Error ${status}`; rt.offline = false; }
        else { rt.offline = true; rt.lastError = "No se pudo conectar con el servidor."; }
        badge();
        return e;
    }
    function noteOk() { rt.offline = false; }

    // ------------------------------------------------------------------ sesión
    async function login(username, password) {
        const r = await apiLogin(String(username || "").trim(), password);
        localStorage.setItem("accessToken", r.accessToken);
        localStorage.setItem("adminph_bridge_user", JSON.stringify(r.user || {}));
        rt.authFailed = false; rt.offline = false; rt.lastError = "";
        badge(); kick();
        return r.user;
    }

    function logout() {
        try { localStorage.removeItem("accessToken"); localStorage.removeItem("adminph_bridge_user"); } catch (_) { /* nada */ }
        rt.authFailed = false; rt.lastError = "";
        badge();
    }

    // ------------------------------------------------------------------ conjunto / unidades
    const H = () => rt.handlers || {};

    function unidadParaBackend(u, idx) {
        const txt = (v, max) => (v == null || v === "" ? undefined : String(v).slice(0, max));
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

    function unitsSignature(units) {
        return (units || []).map((u) => [u.id, u.concatenado, u.numeroFila, u.propietario, u.numeroDocumento,
            u.coeficiente, u.coeficienteParqueadero, u.coeficienteTotal].join("|")).join("~");
    }

    async function ensureProperty() {
        const cfg = (H().getConfig && H().getConfig()) || {};
        const name = String(cfg.nombreConjunto || "").trim();
        if (name.length < 2) throw new Error("Escriba el nombre del conjunto en Fase 1 → Configuración.");
        if (st.propertyId && st.propertyName.toLowerCase() === name.toLowerCase()) return st.propertyId;

        const r = await apiRequest("/properties", {
            method: "POST",
            body: JSON.stringify({ name, nit: cfg.nit || undefined, city: cfg.ciudad || undefined, address: cfg.direccion || undefined })
        });
        if (r.id === DEMO_PROPERTY_ID) {
            throw new Error("Ese nombre corresponde al conjunto de DEMOSTRACIÓN. Cambie el nombre del conjunto en Configuración para no mezclar datos reales con el demo.");
        }
        // Cambió de conjunto: lo asociado al anterior deja de valer.
        st = Object.assign(blank(), { propertyId: r.id, propertyName: r.name });
        save();
        return r.id;
    }

    async function syncUnits(soloConjuntoActual) {
        // Desde el ciclo automático nunca se cambia de conjunto (evita perder la asamblea activa).
        const propertyId = soloConjuntoActual && st.propertyId ? st.propertyId : await ensureProperty();
        if (propertyId === DEMO_PROPERTY_ID) throw new Error("No se sincronizan unidades sobre el conjunto de demostración.");
        const locales = (H().getUnits && H().getUnits()) || [];
        if (!locales.length) throw new Error("Aún no hay unidades creadas en Fase 1.");

        const vistos = new Set();
        const items = [];
        locales.forEach((u, i) => {
            const it = unidadParaBackend(u, i);
            const k = it.concatenado.toLowerCase();
            if (vistos.has(k)) throw new Error(`La unidad "${it.concatenado}" está repetida. Cada unidad debe tener un nombre distinto.`);
            vistos.add(k);
            items.push(it);
        });

        const res = await apiSyncPropertyUnits(propertyId, items, true);
        const byName = new Map((res.units || []).map((b) => [String(b.concatenado).trim().toLowerCase(), b.id]));
        const map = {};
        locales.forEach((u) => { const id = byName.get(String(u.concatenado || "").trim().toLowerCase()); if (id) map[String(u.id)] = id; });
        st.unitMap = map;
        st.unitsSig = unitsSignature(locales);
        save();
        noteOk();
        return { total: (res.units || []).length, deactivated: res.deactivated || 0, mapped: Object.keys(map).length };
    }

    // ------------------------------------------------------------------ asamblea
    async function listAssemblies() {
        if (!st.propertyId) return [];
        return (await apiListPropertyAssemblies(st.propertyId)) || [];
    }

    function applyAssembly(a) {
        const cambio = st.assemblyId !== a.id;
        st.assemblyId = a.id;
        st.assemblyName = a.name || st.assemblyName;
        st.assemblyStatus = String(a.status || "").toLowerCase();
        if (cambio) { st.attSig = {}; st.qr = {}; st.sessions = {}; st.proxySig = ""; }
        try { localStorage.setItem("activeAssemblyId", a.id); } catch (_) { /* nada */ }
        save(); badge();
    }

    async function selectAssembly(id) {
        const a = (await listAssemblies()).find((x) => x.id === id);
        if (!a) throw new Error("Asamblea no encontrada en el servidor.");
        applyAssembly(a);
        kick();
        return a;
    }

    async function refreshStatus() {
        if (!st.propertyId || !st.assemblyId) return;
        const a = (await listAssemblies()).find((x) => x.id === st.assemblyId);
        if (a) { st.assemblyStatus = String(a.status || "").toLowerCase(); st.assemblyName = a.name || st.assemblyName; save(); }
        rt.lastStatusAt = Date.now();
    }

    async function createAssembly(name, meetingDate) {
        await syncUnits();                       // unidades primero: el conjunto debe tenerlas
        const a = await apiCreateAssembly({
            propertyId: st.propertyId, name, assemblyType: "ordinaria", meetingDate, meetingTime: "19:00"
        });
        applyAssembly({ id: a.id, name: a.name, status: a.status || "preparation" });
        kick();
        return a;
    }

    async function startAssembly() {
        if (!st.assemblyId) throw new Error("Primero cree o seleccione una asamblea.");
        const r = await apiStartAssembly(st.assemblyId);
        st.assemblyStatus = String(r.status || "active").toLowerCase();
        save(); badge(); kick();
        return r;
    }

    async function closeAssembly() {
        if (!st.assemblyId) return null;
        // Antes de cerrar, traer los votos finales de las votaciones abiertas.
        try { await pollVotes(true); } catch (_) { /* se cierra igual */ }
        if (st.assemblyStatus === "closed") return { status: "closed" };
        const r = await apiCloseAssembly(st.assemblyId);
        st.assemblyStatus = String(r.status || "closed").toLowerCase();
        Object.keys(st.sessions).forEach((k) => { if (st.sessions[k].backendStatus === "open") st.sessions[k].backendStatus = "closed"; });
        save(); badge();
        return r;
    }

    // ------------------------------------------------------------------ asistencia y QR
    const attSignature = (a) => [a.present ? 1 : 0, a.role, a.name, a.doc].join("|");

    async function pushAttendance() {
        const list = (H().getAttendance && H().getAttendance()) || [];
        rt.attIssues = [];
        let changed = false;
        for (const a of list) {
            const backendId = st.unitMap[String(a.localId)];
            if (!backendId) continue;
            const sig = attSignature(a);
            const prev = st.attSig[String(a.localId)];
            if (prev === sig) continue;
            if (prev === undefined && !a.present) { st.attSig[String(a.localId)] = sig; continue; }   // ausente sin historial: nada que enviar
            if (a.incomplete) { rt.attIssues.push(`${a.label || "Unidad"}: apoderado sin nombre o documento`); continue; }
            try {
                await apiUpsertAssemblyAttendance(st.assemblyId, backendId, {
                    attended: !!a.present,
                    attendanceRole: a.role,
                    attendeeName: a.name || undefined,
                    attendeeDocument: a.role === "proxy" ? a.doc : undefined,
                    verificationMethod: "operator"
                });
                st.attSig[String(a.localId)] = sig;
                changed = true;
                noteOk();
            } catch (e) {
                if (e.status === 401 || !e.status) throw e;
                rt.attIssues.push(`${a.label || "Unidad"}: ${e.message}`);
            }
        }
        if (changed) { save(); rt.lastQrAt = 0; }
    }

    // V3.7: grupos de apoderados (un QR para varias unidades) → servidor.
    async function pushProxyGroups() {
        if (!H().getProxyGroups || !st.assemblyId) return;
        const groups = [];
        for (const g of H().getProxyGroups() || []) {
            const principal = st.unitMap[String(g.principalLocalId)];
            const ids = (g.unitLocalIds || []).map((l) => st.unitMap[String(l)]);
            if (!principal || ids.some((x) => !x)) continue; // aún no sincronizadas
            groups.push({ principalUnitId: principal, unitIds: ids, name: g.name, document: g.document });
        }
        const sig = hashStr(JSON.stringify(groups)) + "@" + st.assemblyId;
        if (st.proxySig === sig) return;
        await apiRequest(`/assemblies/${encodeURIComponent(st.assemblyId)}/proxy-groups`, { method: "PUT", body: JSON.stringify({ groups }) });
        st.proxySig = sig; save(); rt.lastQrAt = 0;
    }

    async function refreshQr() {
        if (!st.assemblyId) return;
        const rows = (await apiGetAssemblyAttendance(st.assemblyId)) || [];
        const rev = {};
        Object.keys(st.unitMap).forEach((l) => { rev[st.unitMap[l]] = l; });
        const nuevo = {};
        rows.forEach((r) => {
            const local = rev[r.unit_id];
            if (local && r.attended && r.qrToken) nuevo[local] = r.qrToken;
        });
        if (JSON.stringify(nuevo) !== JSON.stringify(st.qr)) { st.qr = nuevo; save(); }
        // V4.0: la Fase 2 manda. Si el servidor tiene como PRESENTE una unidad que en Fase 2 está ausente
        // (p. ej. quedó así de una sesión anterior), se corrige en el servidor.
        const locales = (H().getAttendance && H().getAttendance()) || [];
        for (const a of locales) {
            if (a.present) continue;
            const backendId = st.unitMap[String(a.localId)];
            const fila = backendId && rows.find((r) => r.unit_id === backendId);
            if (!fila || !fila.attended) continue;
            try {
                await apiUpsertAssemblyAttendance(st.assemblyId, backendId, { attended: false, attendanceRole: "owner", verificationMethod: "operator" });
                st.attSig[String(a.localId)] = attSignature(a); delete nuevo[a.localId];
            } catch (e) { if (e.status === 401 || !e.status) throw e; }
        }
        if (JSON.stringify(nuevo) !== JSON.stringify(st.qr)) { st.qr = nuevo; save(); }
        rt.lastQrAt = Date.now();
        noteOk();
    }

    // Dirección pública con la que los celulares abren el QR (p. ej. el enlace de Cloudflare Tunnel).
    const PUBLIC_KEY = "adminph_public_base";
    function getPublicBase() { try { return localStorage.getItem(PUBLIC_KEY) || ""; } catch (_) { return ""; } }
    function setPublicBase(value) {
        const v = String(value || "").trim();
        if (!v) { try { localStorage.removeItem(PUBLIC_KEY); } catch (_) { /* nada */ } kick(); return ""; }
        let u;
        try { u = new URL(/^https?:\/\//i.test(v) ? v : "https://" + v); } catch (_) { throw new Error("La dirección no es válida. Ejemplo: https://votar.midominio.com"); }
        u.search = ""; u.hash = "";
        if (!u.pathname || u.pathname === "") u.pathname = "/";
        const norm = u.toString();
        try { localStorage.setItem(PUBLIC_KEY, norm); } catch (_) { /* nada */ }
        rt.lastQrAt = 0; kick();
        return norm;
    }
    function qrBaseInfo() {
        const pub = getPublicBase();
        const host = location.hostname;
        const local = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
        const base = pub || location.origin + location.pathname;
        return { base, usingPublic: !!pub, unusable: !pub && local };
    }

    function qrUrlFor(localId) {
        const t = st.qr[String(localId)];
        if (!t) return null;
        const pub = getPublicBase();
        const u = pub ? new URL(pub) : new URL(location.pathname, location.origin);
        u.searchParams.set("voteToken", t);
        return u.toString();
    }

    // ------------------------------------------------------------------ votaciones
    const prefixOf = (a, b) => a.length <= b.length && a.every((x, i) => x === b[i]);

    async function backendArchive(sessionId) {
        try { await apiArchiveVotingSession(sessionId); } catch (_) { /* si no se puede archivar, se deja */ }
    }

    async function createSession(o) {
        const s = await apiCreateVotingSession(st.assemblyId, {
            title: String(o.title || o.key).slice(0, 200).padEnd(2, " "),
            countingMethod: o.method,
            inputMode: "qr",
            winnersRequired: Math.max(1, parseInt(o.winners, 10) || 1)
        });
        const optionIds = [];
        for (const label of o.labels) optionIds.push((await apiAddVotingOption(s.id, label)).id);
        return { sessionId: s.id, labels: o.labels.slice(), optionIds, backendStatus: "draft" };
    }

    async function reconcileVotes() {
        const open = (H().getOpenVotings && H().getOpenVotings()) || [];
        const openKeys = new Set(open.map((o) => o.key));

        // Votaciones que en Fase 3 ya se cerraron: traer votos finales y cerrar en el servidor.
        for (const key of Object.keys(st.sessions)) {
            const s = st.sessions[key];
            if (s.backendStatus === "open" && !openKeys.has(key)) {
                await pollOne(key, s, open);
                try { await apiCloseVotingSession(s.sessionId); } catch (e) { if (e.status !== 409) throw e; }
                s.backendStatus = "closed"; save();
            }
        }

        for (const o of open) {
            let s = st.sessions[o.key];
            if (s && !prefixOf(s.labels, o.labels)) {          // cambiaron/quitaron opciones: sesión nueva
                if (s.backendStatus === "open") { try { await apiCloseVotingSession(s.sessionId); } catch (_) { /* nada */ } }
                await backendArchive(s.sessionId);
                delete st.sessions[o.key]; s = null;
            }
            if (!s) { s = st.sessions[o.key] = await createSession(o); save(); }
            else if (s.labels.length < o.labels.length) {       // se agregaron opciones al final
                if (s.backendStatus === "open") continue;
                for (const label of o.labels.slice(s.labels.length)) s.optionIds.push((await apiAddVotingOption(s.sessionId, label)).id);
                s.labels = o.labels.slice(); save();
            }
            if (s.backendStatus !== "open") {
                try { await apiOpenVotingSession(s.sessionId); }
                catch (e) { if (e.status === 409) continue; throw e; }   // otra votación abierta o ya abierta: se reintenta en el próximo ciclo
                s.backendStatus = "open"; save();
            }
        }
    }

    async function pollOne(key, s, openList) {
        const res = await apiGetVotingResults(s.sessionId);
        const rev = {};
        Object.keys(st.unitMap).forEach((l) => { rev[st.unitMap[l]] = l; });
        const meta = (openList || []).find((x) => x.key === key) || (H().describeVoting && H().describeVoting(key)) || {};
        const options = s.optionIds.map((id) => (res.options || []).find((o) => o.id === id) || { voteCount: 0, coefficientTotal: 0, voters: [] });
        const data = {
            ballotsCast: res.ballotsCast, eligible: res.eligibleUnitsPresent,
            options: options.map((o, i) => ({
                index: i, votes: o.voteCount || 0, coefficient: o.coefficientTotal || 0,
                voters: (o.voters || []).map((v) => ({ localUnitId: rev[v.unitId] || null, coefficient: v.coefficient, castAt: v.castAt }))
            }))
        };
        if (H().applyVotes) H().applyVotes(key, meta.kind, data);
        noteOk();
    }

    async function pollVotes(includeAll) {
        for (const key of Object.keys(st.sessions)) {
            const s = st.sessions[key];
            if (s.backendStatus === "open" || includeAll) await pollOne(key, s, null);
        }
    }

    // Olvida (y archiva) la votación de una clave: se usa al "Reiniciar votos" o eliminarla.
    async function forgetVoting(key) {
        const s = st.sessions[key];
        if (!s) return;
        delete st.sessions[key]; save();
        if (!isConnected()) return;
        try {
            if (s.backendStatus === "open") await apiCloseVotingSession(s.sessionId);
        } catch (_) { /* nada */ }
        await backendArchive(s.sessionId);
    }

    // ------------------------------------------------------------------ ciclo
    async function tick() {
        if (rt.running) { rt.again = true; return; }
        if (!isConnected() || !rt.handlers) { badge(); return; }
        rt.running = true;
        try {
            await autoSnapshot();
            if (!st.assemblyId) return;
            const locales = (H().getUnits && H().getUnits()) || [];
            if (st.propertyId && locales.length && unitsSignature(locales) !== st.unitsSig) await syncUnits(true);
            await pushAttendance();
            await pushProxyGroups();
            await reconcileVotes();
            await pollVotes(false);
            if (Date.now() - rt.lastQrAt > 8000) await refreshQr();
            if (Date.now() - rt.lastStatusAt > 10000) await refreshStatus();
            rt.lastError = rt.attIssues.length ? `Asistencia pendiente: ${rt.attIssues.slice(0, 2).join(" · ")}` : "";
            noteOk();
        } catch (e) {
            noteError(e);
        } finally {
            rt.running = false;
            badge();
            if (rt.again) { rt.again = false; setTimeout(tick, 250); }
        }
    }

    let kickTimer = null;
    function kick() { clearTimeout(kickTimer); kickTimer = setTimeout(tick, 350); }

    // ------------------------------------------------------------------ copia de seguridad en el servidor (PostgreSQL)
    // Guarda todo lo que la parte antigua de app.js mantiene en el navegador para que
    // no se pierda al cambiar de dirección, de navegador o de computador.
    const SNAP_SKIP = new Set(["accessToken", "adminph_bridge_user", "currentUser", "adminph_snap_meta"]);
    const SNAP_MAX_KEY = 4 * 1024 * 1024;
    const snap = { conflict: false, lastAt: 0, lastOkAt: null, error: "", sig: "", skipped: [] };

    function snapMeta() { try { return JSON.parse(localStorage.getItem("adminph_snap_meta") || "{}"); } catch (_) { return {}; } }
    function setSnapMeta(propertyId, at) { try { localStorage.setItem("adminph_snap_meta", JSON.stringify({ propertyId, at })); } catch (_) { /* nada */ } }

    function collectSnapshot() {
        const keys = {}, skipped = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || SNAP_SKIP.has(k)) continue;
            const v = localStorage.getItem(k);
            if (v == null) continue;
            if (v.length > SNAP_MAX_KEY) { skipped.push(k); continue; }
            keys[k] = v;
        }
        return { keys, skipped };
    }
    function hashStr(x) { let h = 2166136261; for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ":" + x.length; }
    function localHasData() { return ((H().getUnits && H().getUnits()) || []).length > 0; }

    async function snapshotSave(force, label) {
        if (!st.propertyId) return false;
        if (!force && !localHasData()) return false;
        const { keys, skipped } = collectSnapshot();
        snap.skipped = skipped;
        const sig = hashStr(JSON.stringify(keys));
        if (!force && !label && sig === snap.sig) return false;
        // V3.5: ya no se bloquea por "conflicto": el servidor conserva un historial de versiones
        // y la copia vigente anterior siempre se archiva antes de ser reemplazada.
        const r = await apiRequest(`/app-state/${encodeURIComponent(st.propertyId)}`, {
            method: "PUT",
            body: JSON.stringify({ label: label || undefined, data: { savedAt: new Date().toISOString(), origin: location.origin, keys } })
        });
        setSnapMeta(st.propertyId, r.updatedAt);
        snap.sig = sig; snap.conflict = false; snap.lastOkAt = Date.now(); snap.error = "";
        return true;
    }

    async function autoSnapshot() {
        if (Date.now() - snap.lastAt < 12000) return;
        snap.lastAt = Date.now();
        try { await snapshotSave(false); }
        catch (e) { if (e && (e.status === 401 || !e.status)) throw e; snap.error = e.message || "No se pudo guardar la copia"; }
    }

    async function snapshotProperties() {
        try { return (await apiRequest("/app-state/summary/all")) || []; } catch (_) { return []; }
    }

    async function resolveProperty(explicitId) {
        if (explicitId) return explicitId;
        if (st.propertyId) return st.propertyId;
        const list = await snapshotProperties();
        const withCopy = list.filter((p) => p.updatedAt && p.id !== DEMO_PROPERTY_ID);
        const cfg = (H().getConfig && H().getConfig()) || {};
        const name = String(cfg.nombreConjunto || "").trim().toLowerCase();
        const byName = name && withCopy.find((p) => String(p.name || "").trim().toLowerCase() === name);
        if (byName) return byName.id;
        if (withCopy.length) return withCopy[0].id; // la copia más reciente
        throw new Error("El servidor aún no tiene ninguna copia guardada.");
    }

    async function snapshotInfo() {
        const out = { conflict: false, lastOkAt: snap.lastOkAt, error: snap.error, skipped: snap.skipped, server: null, properties: [], propertyId: null };
        try {
            out.properties = await snapshotProperties();
            const id = await resolveProperty();
            out.propertyId = id;
            out.server = await apiRequest(`/app-state/${encodeURIComponent(id)}/info`);
        } catch (e) { out.error = out.error || e.message; }
        return out;
    }

    async function snapshotHistory(propertyId) {
        const id = await resolveProperty(propertyId);
        const r = await apiRequest(`/app-state/${encodeURIComponent(id)}/history`);
        return { propertyId: id, items: (r && r.items) || [] };
    }

    // V4.0: elimina una versión guardada del historial (no toca la copia actual).
    async function snapshotDelete(versionId, propertyId) {
        const id = await resolveProperty(propertyId);
        return apiRequest(`/app-state/${encodeURIComponent(id)}/history/${encodeURIComponent(versionId)}`, { method: "DELETE" });
    }

    function applyKeys(keys) {
        Object.keys(keys).forEach((k) => { if (!SNAP_SKIP.has(k)) localStorage.setItem(k, keys[k]); });
    }

    // Restaura una versión (id de historial, "current" o "prev"); propertyId opcional.
    async function snapshotRestore(versionId, propertyId) {
        const id = await resolveProperty(propertyId);
        let r;
        if (versionId === true || versionId === "prev") r = await apiRequest(`/app-state/${encodeURIComponent(id)}?previous=1`);
        else r = await apiRequest(`/app-state/${encodeURIComponent(id)}/history/${encodeURIComponent(versionId || "current")}`);
        const keys = r && r.exists && r.data && r.data.keys;
        if (!keys) throw new Error("Esa copia no existe o está vacía.");
        // Antes de reemplazar, se guarda lo que hay en este navegador como versión etiquetada (si hay datos y propiedad conocida).
        try { if (st.propertyId && localHasData()) await snapshotSave(true, "Antes de restaurar (" + new Date().toLocaleString("es-CO") + ")"); } catch (_) { /* no impide restaurar */ }
        applyKeys(keys);
        try { const info = await apiRequest(`/app-state/${encodeURIComponent(id)}/info`); setSnapMeta(id, info.updatedAt); } catch (_) { /* nada */ }
        snap.conflict = false;
        setTimeout(() => location.reload(), 150);
        return { savedAt: r.data.savedAt || r.updatedAt };
    }

    // Copia a archivo (.json) y restauración desde archivo: funcionan aunque el servidor falle.
    function snapshotToFile() {
        const { keys } = collectSnapshot();
        const cfg = (H().getConfig && H().getConfig()) || {};
        const payload = { adminph: "snapshot", version: 1, savedAt: new Date().toISOString(), conjunto: cfg.nombreConjunto || "", origin: location.origin, keys };
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `AdminPH_copia_${stamp}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        return Object.keys(keys).length;
    }
    async function snapshotFromFile(file) {
        const txt = await file.text();
        let o; try { o = JSON.parse(txt); } catch (_) { throw new Error("El archivo no es una copia válida de AdminPH."); }
        const keys = o && o.keys;
        if (!keys || typeof keys !== "object" || o.adminph !== "snapshot") throw new Error("El archivo no es una copia válida de AdminPH.");
        applyKeys(keys);
        setTimeout(() => location.reload(), 150);
        return Object.keys(keys).length;
    }

    async function snapshotNow(force, label) {
        if (!isConnected()) throw new Error("Conéctese al servidor primero.");
        if (!st.propertyId) { throw new Error("Primero envíe las unidades al servidor (sección 2)."); }
        return snapshotSave(!!force, label);
    }

    // ------------------------------------------------------------------ indicador visual
    function status() {
        if (!token()) return { level: "off", text: "Servidor: sin conectar" };
        if (rt.authFailed) return { level: "bad", text: "Servidor: sesión vencida" };
        if (rt.offline) return { level: "bad", text: "Servidor: sin conexión" };
        if (snap.conflict) return { level: "warn", text: "Hay una copia distinta en el servidor · abra Fase 1 → Servidor" };
        if (!st.assemblyId) return { level: "warn", text: "Servidor conectado · falta asamblea" };
        if (st.assemblyStatus === "closed") return { level: "off", text: "Asamblea cerrada" };
        if (st.assemblyStatus !== "active") return { level: "warn", text: "Asamblea en preparación · QR aún inactivos" };
        const n = Object.keys(st.qr).length;
        return { level: "ok", text: `Servidor conectado · ${n} QR activos` };
    }

    function badge() {
        if (!document.body || !document.getElementById("dashboardContainer")) return;
        let el = document.getElementById("puenteBadge");
        if (!el) {
            el = document.createElement("div");
            el.id = "puenteBadge";
            el.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:50;padding:7px 12px;border-radius:18px;font:600 12px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.2);cursor:pointer;max-width:80vw";
            el.onclick = () => { if (H().abrirFase1) H().abrirFase1(); };
            document.body.appendChild(el);
        }
        const s = status();
        const col = { ok: ["#d9f2e0", "#14532d"], warn: ["#fff3cd", "#8a6100"], bad: ["#fdecea", "#b3261e"], off: ["#e5e7e5", "#444"] }[s.level];
        el.style.background = col[0]; el.style.color = col[1];
        el.textContent = `🔌 ${s.text}`;
        el.title = rt.lastError || "Clic para abrir Fase 1 → Servidor y Asamblea";
        const dash = document.getElementById("dashboardContainer");
        el.style.display = dash && dash.style.display === "none" ? "none" : "block";
    }

    function register(handlers) {
        rt.handlers = handlers;
        if (!rt.timer) rt.timer = setInterval(() => { if (!document.hidden) tick(); }, TICK_MS);
        badge(); kick();
    }

    window.AdminPHBridge = {
        register, kick, badge, forgetVoting, pollNow: () => pollVotes(true),
        isConnected, user, login, logout,
        syncUnits, listAssemblies, selectAssembly, createAssembly, startAssembly, closeAssembly, refreshStatus,
        qrUrlFor, refreshQr, getPublicBase, setPublicBase, qrBaseInfo,
        snapshotInfo, snapshotRestore, snapshotDelete, snapshotNow, snapshotHistory, snapshotProperties, snapshotToFile, snapshotFromFile, snapshotState: () => Object.assign({}, snap),
        state: () => Object.assign({}, st),
        runtime: () => Object.assign({}, rt, { handlers: undefined }),
        status
    };
})();
