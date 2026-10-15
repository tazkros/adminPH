/* AdminPH V4.1 — Simulador de cuotas de administración (anexo pedagógico).
 * Todo se calcula en el navegador. Reparte un valor total entre las unidades:
 *   - por coeficiente de copropiedad:  cuota = coeficiente × valor mensual
 *   - nominal (partes iguales):        cuota = valor mensual ÷ número de unidades
 * Las funciones puras (parseUnidades, calcular) se exponen en window.SimCuotas para pruebas.
 */
(function () {
    "use strict";

    const KEY = "adminph_simulador_cuotas_v1";
    const S = { nombre: "", total: 0, periodo: "mensual", redondeo: 0, fuente: "digitado", modo: "coef", anterior: false, unidades: [] };

    // ------------------------------------------------------------------ utilidades
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const norm = (s) => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
    const fmtCOP = (n) => { const v = Math.round(n || 0); return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("es-CO"); };
    const fmtN = (n, d) => Number(n || 0).toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
    const fmtPct = (f, d = 4) => fmtN((f || 0) * 100, d) + " %";

    function parseNum(v) {
        if (v == null || v === "") return null;
        if (typeof v === "number") return isFinite(v) ? v : null;
        let s = String(v).replace(/[$\s%]/g, "");
        if (!s) return null;
        const pc = s.indexOf("."), cm = s.indexOf(",");
        if (pc >= 0 && cm >= 0) {
            if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
            else s = s.replace(/,/g, "");
        } else if (cm >= 0) {
            s = /^\d{1,3}(,\d{3}){2,}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
        } else if (pc >= 0) {
            if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
        }
        const n = Number(s);
        return isFinite(n) ? n : null;
    }

    function redondear(x, paso) { return paso > 0 ? Math.round(x / paso) * paso : Math.round(x); }

    // ------------------------------------------------------------------ cálculo (puro)
    function calcular(st) {
        const us = st.unidades, n = us.length;
        const M = st.periodo === "anual" ? (st.total || 0) / 12 : (st.total || 0);
        const sumA = us.reduce((a, u) => a + (u.area || 0), 0);
        const coefs = us.map((u) => (st.fuente === "area" ? (sumA > 0 ? (u.area || 0) / sumA : 0) : (u.coef || 0)));
        const sumC = coefs.reduce((a, b) => a + b, 0);
        const filas = us.map((u, i) => {
            const cc = redondear(coefs[i] * M, st.redondeo);
            const cn = n ? redondear(M / n, st.redondeo) : 0;
            const act = st.modo === "nominal" ? cn : cc;
            const ant = u.ant == null ? null : u.ant;
            return { i, nombre: u.nombre, area: u.area || 0, coef: coefs[i], cc, cn, dif: cn - cc, act, ant, inc: ant == null ? null : act - ant, incPct: ant ? (act - ant) / ant : null };
        });
        const totCC = filas.reduce((a, f) => a + f.cc, 0), totCN = filas.reduce((a, f) => a + f.cn, 0);
        const totAct = st.modo === "nominal" ? totCN : totCC;
        const vals = filas.map((f) => f.act);
        return { n, M, sumA, sumC, filas, totCC, totCN, totAct, min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 0, prom: n ? totAct / n : 0 };
    }

    // ------------------------------------------------------------------ lector de Excel
    function parseUnidades(rows) {
        const out = { unidades: [], total: null, fuente: "digitado", avisos: [], anterior: false };
        const R = (i) => rows[i] || [];
        const maxR = Math.min(rows.length, 60);
        const esEnc = (t) => /^(n[°º.o]*|no\.?|nro\.?|numero|item|#|unidad|apto|apartamento|casa|inmueble|predio|local|nombre|manzana|torre|bloque|piso|propietario|coe\w*|area.*|metro.*|m2|m²|cuota.*)$/.test(t);
        let h = -1, mejor = 1;
        for (let r = 0; r < maxR; r++) {
            let c = 0; R(r).forEach((v) => { if (typeof v === "string" && esEnc(norm(v))) c++; });
            if (c >= 2 && c > mejor) { h = r; mejor = c; }   // la fila con más encabezados reconocidos
        }
        // presupuesto mensual (si el archivo lo trae)
        for (let r = 0; r < Math.min(rows.length, 20); r++) {
            R(r).forEach((v, c) => {
                if (out.total || typeof v !== "string" || !/presupuesto/.test(norm(v))) return;
                for (let k = r + 1; k <= r + 2; k++) { const x = parseNum(R(k)[c]); if (x && x > 0) { out.total = x; return; } }
                for (let k = c + 1; k <= c + 2; k++) { const x = parseNum(R(r)[k]); if (x && x > 0) { out.total = x; return; } }
            });
        }
        let nameCols = [], coefCol = -1, areaCol = -1, antCol = -1, start = 0;
        if (h >= 0) {
            start = h + 1;
            const hd = R(h).map((v) => norm(v));
            hd.forEach((t, c) => {
                if (!t) return;
                if (/^(n[°º.o]*|no\.?|nro\.?|numero|item|#)$/.test(t)) return;
                if (/^coe/.test(t) && coefCol < 0) coefCol = c;
                else if (/cuota/.test(t) && /(anterior|actual|vigente|20\d\d)/.test(t) && antCol < 0) antCol = c;
                else if (/(area|metro|m2|m²)/.test(t) && !/comun/.test(t)) { if (areaCol < 0 || (/privad/.test(t) && !/privad/.test(hd[areaCol] || ""))) areaCol = c; }
                else if (/^(unidad|apto|apartamento|casa|inmueble|predio|local|nombre|manzana|torre|bloque|piso|propietario)/.test(t)) nameCols.push(c);
            });
            if (nameCols.length >= 2 && hd[nameCols[0]] === "unidad") {
                const seq = [0, 1, 2, 3, 4].every((k) => parseNum(R(start + k)[nameCols[0]]) === k + 1 || R(start + k)[nameCols[0]] == null);
                if (seq) nameCols.shift();
            }
        } else {
            // sin encabezados: primera columna de texto = nombre; numéricas = coeficiente o área
            const f = R(0); let cols = f.length;
            for (let c = 0; c < cols; c++) { if (typeof f[c] === "string" && parseNum(f[c]) == null) { nameCols = [c]; break; } }
            const numCols = []; for (let c = 0; c < cols; c++) if (!nameCols.includes(c) && parseNum(f[c]) != null) numCols.push(c);
            if (numCols.length) { const vals = rows.map((r) => parseNum((r || [])[numCols[0]])).filter((x) => x != null); if (vals.length && vals.every((x) => x < 1.0001)) coefCol = numCols[0]; else areaCol = numCols[0]; }
            if (numCols.length > 1) { if (coefCol < 0) coefCol = numCols[1]; else areaCol = numCols[1]; }
        }
        if (coefCol < 0 && areaCol < 0) { out.avisos.push("No encontré columnas de coeficiente ni de área. Use la plantilla (columnas: Unidad, Área, Coeficiente)."); return out; }
        const encab = h >= 0 ? R(h).map((v) => norm(v)) : [];
        const etiquetas = /^(manzana|torre|bloque|piso)/;
        let sumC = 0, hayCoef = false, hayArea = false;
        for (let r = start; r < rows.length; r++) {
            const row = R(r); if (!row.length) continue;
            const coef = coefCol >= 0 ? parseNum(row[coefCol]) : null;
            const area = areaCol >= 0 ? parseNum(row[areaCol]) : null;
            const ant = antCol >= 0 ? parseNum(row[antCol]) : null;
            if (coef == null && area == null) continue;
            const partes = nameCols.map((c) => { const v = row[c]; if (v == null || v === "") return ""; const t = encab[c] || ""; return etiquetas.test(t) ? `${t.charAt(0).toUpperCase() + t.slice(1)} ${v}` : String(v); }).filter(Boolean);
            const nombre = partes.join(" · ");
            if (/^total/.test(norm(nombre)) || /^total/.test(norm(row[0]))) continue;
            if (coef != null) { hayCoef = true; sumC += coef; }
            if (area != null) hayArea = true;
            out.unidades.push({ nombre: nombre || `Unidad ${out.unidades.length + 1}`, area: area || 0, coef: coef || 0, ant });
        }
        if (!out.unidades.length) { out.avisos.push("No encontré filas con datos de unidades."); return out; }
        if (hayCoef && sumC > 0) {
            if (Math.abs(sumC - 100) <= 1) out.unidades.forEach((u) => { u.coef = u.coef / 100; });
            else if (Math.abs(sumC - 1) > 0.02) out.avisos.push(`Los coeficientes del archivo suman ${fmtN(sumC, 4)} (no suman 1 ni 100). Revíselos o use «Normalizar a 100 %».`);
        }
        if (!hayCoef && hayArea) { out.fuente = "area"; out.avisos.push("El archivo no trae coeficientes con valor: se calcularán por área privada."); }
        out.anterior = out.unidades.some((u) => u.ant != null);
        return out;
    }

    // ------------------------------------------------------------------ estado y almacenamiento
    function guardar() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* sin almacenamiento */ } }
    function restaurar() {
        try { const t = JSON.parse(localStorage.getItem(KEY) || "null"); if (t && Array.isArray(t.unidades)) Object.assign(S, t); } catch (e) { /* ignorar */ }
    }
    function msgCarga(html, tipo) { $("msgCarga").innerHTML = html ? `<div class="msg ${tipo || "info"}">${html}</div>` : ""; }

    // ------------------------------------------------------------------ pintura
    function pintarControles() {
        $("inNombre").value = S.nombre || "";
        $("inTotal").value = S.total ? S.total.toLocaleString("es-CO") : "";
        $("inPeriodo").value = S.periodo; $("inRedondeo").value = String(S.redondeo); $("inFuente").value = S.fuente;
        $("inCantidad").value = S.unidades.length || "";
        $("chkAnterior").checked = !!S.anterior;
        document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.m === S.modo));
    }

    function pintarTabla() {
        const c = calcular(S), m = S.modo, ant = S.anterior;
        let h = `<thead><tr><th>N°</th><th>Unidad</th><th>Área m²</th><th>Coeficiente %</th>`;
        if (m === "coef") h += `<th>Cuota mensual</th>`;
        else if (m === "nominal") h += `<th>Cuota mensual</th>`;
        else h += `<th>Cuota por coeficiente</th><th>Cuota nominal</th><th>Diferencia (nominal − coef.)</th><th>Peso relativo</th>`;
        if (ant) h += `<th>Cuota anterior</th><th>Incremento $</th><th>Incremento %</th>`;
        h += `<th class="noprint"></th></tr></thead><tbody>`;
        const mx = Math.max(1, ...c.filas.map((f) => Math.max(f.cc, f.cn)));
        c.filas.forEach((f, i) => {
            const u = S.unidades[i];
            const coefIn = S.fuente === "area"
                ? `<span data-c="coef">${fmtN(f.coef * 100, 4)}</span>`
                : `<input type="text" inputmode="decimal" data-i="${i}" data-f="coef" value="${fmtN(u.coef * 100, 4)}">`;
            h += `<tr><td>${i + 1}</td><td><input class="nm" type="text" data-i="${i}" data-f="nombre" value="${esc(u.nombre)}"></td>`
                + `<td><input type="text" inputmode="decimal" data-i="${i}" data-f="area" value="${u.area ? fmtN(u.area, 2) : ""}"></td><td>${coefIn}</td>`;
            if (m === "comparar") {
                h += `<td data-c="cc">${fmtCOP(f.cc)}</td><td data-c="cn">${fmtCOP(f.cn)}</td><td data-c="dif" class="${f.dif > 0 ? "pos" : f.dif < 0 ? "neg" : ""}">${f.dif > 0 ? "+" : ""}${fmtCOP(f.dif)}</td>`
                    + `<td style="text-align:left"><span class="bar" data-c="b1" style="width:${(f.cc / mx) * 90}px"></span><br><span class="bar" data-c="b2" style="width:${(f.cn / mx) * 90}px;background:#b45309"></span></td>`;
            } else h += `<td data-c="act"><b>${fmtCOP(f.act)}</b></td>`;
            if (ant) h += `<td><input type="text" inputmode="decimal" data-i="${i}" data-f="ant" value="${u.ant != null ? fmtN(u.ant, 0) : ""}"></td><td data-c="inc">${f.inc == null ? "—" : (f.inc > 0 ? "+" : "") + fmtCOP(f.inc)}</td><td data-c="incp">${f.incPct == null ? "—" : fmtN(f.incPct * 100, 1) + " %"}</td>`;
            h += `<td class="noprint"><button class="x" data-del="${i}" title="Quitar esta unidad">✕</button></td></tr>`;
        });
        h += `</tbody><tfoot><tr><td></td><td>TOTAL (${c.n})</td><td data-c="tA">${fmtN(c.sumA, 2)}</td><td data-c="tC">${fmtN(c.sumC * 100, 4)}</td>`;
        if (m === "comparar") h += `<td data-c="tCC">${fmtCOP(c.totCC)}</td><td data-c="tCN">${fmtCOP(c.totCN)}</td><td></td><td></td>`;
        else h += `<td data-c="tAct">${fmtCOP(c.totAct)}</td>`;
        if (ant) h += `<td></td><td></td><td></td>`;
        h += `<td class="noprint"></td></tr></tfoot>`;
        $("tabla").innerHTML = h;
    }

    // Actualiza solo los números (sin reconstruir la tabla, para no perder el cursor al escribir)
    function pintarCalculos() {
        const c = calcular(S), m = S.modo;
        const T = $("tabla"); const q = (sel) => T.querySelector(sel);
        const mx = Math.max(1, ...c.filas.map((f) => Math.max(f.cc, f.cn)));
        c.filas.forEach((f, i) => {
            const row = T.tBodies[0] && T.tBodies[0].rows[i]; if (!row) return;
            const set = (k, t) => { const e = row.querySelector(`[data-c="${k}"]`); if (e) e.innerHTML = t; };
            set("coef", fmtN(f.coef * 100, 4)); set("act", `<b>${fmtCOP(f.act)}</b>`);
            set("cc", fmtCOP(f.cc)); set("cn", fmtCOP(f.cn));
            const d = row.querySelector('[data-c="dif"]'); if (d) { d.className = f.dif > 0 ? "pos" : f.dif < 0 ? "neg" : ""; d.textContent = (f.dif > 0 ? "+" : "") + fmtCOP(f.dif); }
            const b1 = row.querySelector('[data-c="b1"]'), b2 = row.querySelector('[data-c="b2"]');
            if (b1) b1.style.width = (f.cc / mx) * 90 + "px"; if (b2) b2.style.width = (f.cn / mx) * 90 + "px";
            set("inc", f.inc == null ? "—" : (f.inc > 0 ? "+" : "") + fmtCOP(f.inc)); set("incp", f.incPct == null ? "—" : fmtN(f.incPct * 100, 1) + " %");
        });
        const sf = (k, t) => { const e = q(`[data-c="${k}"]`); if (e) e.textContent = t; };
        sf("tA", fmtN(c.sumA, 2)); sf("tC", fmtN(c.sumC * 100, 4)); sf("tAct", fmtCOP(c.totAct)); sf("tCC", fmtCOP(c.totCC)); sf("tCN", fmtCOP(c.totCN));
        pintarResumen(c);
    }

    function pintarResumen(c) {
        const m = S.modo, al = [];
        if (!c.n) al.push(["info", "Agregue unidades: escriba la <b>cantidad</b>, cargue un <b>Excel</b> o use el <b>ejemplo</b>."]);
        else if (!(c.M > 0)) al.push(["warn", "Escriba el <b>valor total a repartir</b> para ver las cuotas."]);
        if (c.n && m !== "nominal") {
            if (S.fuente === "area" && c.sumA <= 0) al.push(["warn", "Para calcular por área, escriba el <b>área privada</b> de cada unidad."]);
            else if (S.fuente === "digitado" && Math.abs(c.sumC - 1) > 0.00005) al.push(["warn", `Los coeficientes suman <b>${fmtPct(c.sumC, 4)}</b>, no 100 %. El total recaudado no será igual al presupuesto. Corrija o use «Normalizar a 100 %».`]);
        }
        if (c.n && c.M > 0) {
            const dif = c.totAct - c.M;
            if (Math.abs(dif) >= 1) al.push(["info", `Por el redondeo, la suma de las cuotas es <b>${fmtCOP(c.totAct)}</b> frente a un presupuesto de <b>${fmtCOP(c.M)}</b> (diferencia ${dif > 0 ? "+" : ""}${fmtCOP(dif)}). Es normal; esa diferencia se ajusta en el ejercicio contable.`]);
            else if (c.n) al.push(["ok", "La suma de las cuotas coincide con el valor a repartir ✔"]);
        }
        $("alertas").innerHTML = al.map((a) => `<div class="msg ${a[0]}">${a[1]}</div>`).join("");
        $("kpis").innerHTML = c.n ? [
            [c.n, "unidades"], [fmtCOP(c.M), "valor mensual a repartir"], [fmtCOP(c.M * 12), "equivalente anual"],
            [fmtCOP(c.min), "cuota mínima"], [fmtCOP(c.max), "cuota máxima"], [fmtCOP(c.prom), "cuota promedio"],
        ].map((k) => `<div class="kpi"><b>${k[0]}</b><span>${k[1]}</span></div>`).join("") : "";
        pintarExplica(c);
    }

    function pintarExplica(c) {
        const box = $("explica");
        if (!c.n || !(c.M > 0)) { box.innerHTML = '<p style="color:var(--muted)">Cuando haya unidades y un valor total, aquí verá el cálculo paso a paso con los números de la primera unidad.</p>'; return; }
        const f = c.filas[0], u = S.unidades[0];
        const p1 = S.periodo === "anual" ? `<div class="formula"><b>Paso 1 · Valor mensual.</b> ${fmtCOP(S.total)} al año ÷ 12 = <b>${fmtCOP(c.M)}</b> al mes.</div>` : `<div class="formula"><b>Paso 1 · Valor mensual.</b> El presupuesto mensual a repartir es <b>${fmtCOP(c.M)}</b>.</div>`;
        const p2 = S.fuente === "area"
            ? `<div class="formula"><b>Paso 2 · Coeficiente de «${esc(u.nombre)}».</b> Área privada ÷ área total = ${fmtN(u.area, 2)} ÷ ${fmtN(c.sumA, 2)} = <b>${fmtPct(f.coef, 4)}</b>.</div>`
            : `<div class="formula"><b>Paso 2 · Coeficiente de «${esc(u.nombre)}».</b> Es el digitado o importado: <b>${fmtPct(f.coef, 4)}</b> (todos deben sumar 100 %).</div>`;
        const p3 = `<div class="formula"><b>Paso 3 · Cuota por coeficiente.</b> ${fmtPct(f.coef, 4)} × ${fmtCOP(c.M)} = ${fmtCOP(f.coef * c.M)}${S.redondeo ? ` → redondeo a ${fmtCOP(S.redondeo)}: <b>${fmtCOP(f.cc)}</b>` : `: <b>${fmtCOP(f.cc)}</b>`}.</div>`;
        const p4 = `<div class="formula"><b>Paso 4 · Cuota nominal (partes iguales).</b> ${fmtCOP(c.M)} ÷ ${c.n} unidades = <b>${fmtCOP(f.cn)}</b> para todas por igual (cada una aporta ${fmtPct(1 / c.n, 4)}).</div>`;
        const d = f.cn - f.cc;
        const p5 = `<div class="formula"><b>Paso 5 · Comparar.</b> ${Math.abs(d) < 1 ? "Para esta unidad ambos métodos dan lo mismo." : d > 0 ? `Con el reparto nominal esta unidad pagaría <b>${fmtCOP(d)} más</b> que por coeficiente: su coeficiente (${fmtPct(f.coef, 4)}) es menor que el promedio (${fmtPct(1 / c.n, 4)}).` : `Con el reparto nominal esta unidad pagaría <b>${fmtCOP(-d)} menos</b> que por coeficiente: su coeficiente (${fmtPct(f.coef, 4)}) es mayor que el promedio (${fmtPct(1 / c.n, 4)}).`}</div>`;
        box.innerHTML = p1 + p2 + p3 + p4 + p5 + `<p style="color:var(--muted);font-size:.88rem">Idea clave: el coeficiente hace que quien tiene un inmueble más grande contribuya más a los gastos comunes; el reparto nominal ignora el tamaño.</p>`;
    }

    function pintarTodo() { pintarControles(); pintarTabla(); pintarResumen(calcular(S)); }

    // ------------------------------------------------------------------ acciones
    function aplicarCantidad() {
        const n = Math.max(0, Math.min(5000, Math.floor(parseNum($("inCantidad").value) || 0)));
        if (!n) { msgCarga("Escriba una cantidad de unidades mayor que 0.", "warn"); return; }
        if (!S.unidades.length) {
            S.fuente = "digitado";
            S.unidades = Array.from({ length: n }, (_, i) => ({ nombre: `Unidad ${i + 1}`, area: 0, coef: 1 / n, ant: null }));
            msgCarga(`Creé ${n} unidades con coeficientes iguales (${fmtPct(1 / n, 4)} cada una). Edite nombre, área o coeficiente en la tabla.`, "ok");
        } else if (n > S.unidades.length) {
            for (let i = S.unidades.length; i < n; i++) S.unidades.push({ nombre: `Unidad ${i + 1}`, area: 0, coef: 0, ant: null });
            msgCarga("Agregué unidades nuevas con coeficiente 0: complételo en la tabla.", "warn");
        } else { S.unidades.length = n; msgCarga(`Dejé las primeras ${n} unidades.`, "info"); }
        guardar(); pintarTodo();
    }

    async function cargarExcel(file) {
        try {
            const hojas = await XLSXMini.read(await file.arrayBuffer());
            let res = null, usada = "";
            for (const h of hojas) { const r = parseUnidades(h.rows); if (r.unidades.length && (!res || r.unidades.length > res.unidades.length)) { res = r; usada = h.name; } }
            if (!res) { msgCarga("No encontré unidades en el archivo. Descargue la plantilla y use sus columnas.", "bad"); return; }
            S.unidades = res.unidades; S.fuente = res.fuente; if (res.anterior) S.anterior = true;
            let extra = "";
            if (res.total) { S.total = res.total; S.periodo = "mensual"; extra = ` Tomé el presupuesto mensual del archivo: <b>${fmtCOP(res.total)}</b>.`; }
            guardar(); pintarTodo();
            msgCarga(`Cargué <b>${res.unidades.length}</b> unidades de la hoja «${esc(usada)}».${extra}${res.avisos.length ? "<br>⚠️ " + res.avisos.map(esc).join("<br>⚠️ ") : ""}`, res.avisos.length ? "warn" : "ok");
        } catch (e) { msgCarga("No pude leer el archivo: " + esc(e.message || e) + ". Guárdelo como .xlsx.", "bad"); }
    }

    function ejemplo() {
        const areas = [105.8, 91.6, 81, 81, 81, 81, 91.6, 105.8, 105.8, 81];
        S.nombre = "Conjunto de ejemplo"; S.total = 4300000; S.periodo = "mensual"; S.redondeo = 1000; S.fuente = "area"; S.modo = "comparar"; S.anterior = false;
        S.unidades = areas.map((a, i) => ({ nombre: `Casa ${i + 1}`, area: a, coef: 0, ant: null }));
        guardar(); pintarTodo(); msgCarga("Ejemplo cargado: 10 casas de distinto tamaño, cuota total de $4.300.000. Compare las pestañas «Por coeficiente» y «Nominal».", "ok");
    }

    function traerAdminph() {
        let us = [];
        try { us = JSON.parse(localStorage.getItem("unidades") || "[]"); } catch (e) { /* ignorar */ }
        us = (us || []).filter((u) => u && (u.concatenado || u.nombre || u.numeroFila));
        if (!us.length) { msgCarga("No encontré unidades de AdminPH en este navegador. Abra AdminPH, cargue las unidades de la asamblea y vuelva aquí.", "warn"); return; }
        const lista = us.map((u) => ({ nombre: String(u.concatenado || u.nombre || u.numeroFila), area: parseNum(u.area) || 0, coef: (parseFloat(u.coeficiente) || 0) + (parseFloat(u.coeficienteParqueadero) || 0), ant: null }));
        const sum = lista.reduce((a, u) => a + u.coef, 0);
        if (Math.abs(sum - 100) <= 1) lista.forEach((u) => { u.coef /= 100; });
        S.unidades = lista; S.fuente = "digitado"; guardar(); pintarTodo();
        msgCarga(`Traje <b>${lista.length}</b> unidades de AdminPH (coeficientes sumando ${fmtPct(lista.reduce((a, u) => a + u.coef, 0), 4)}).`, "ok");
    }

    function normalizar() {
        const s = S.unidades.reduce((a, u) => a + (u.coef || 0), 0);
        if (!(s > 0)) { msgCarga("No hay coeficientes que normalizar.", "warn"); return; }
        S.unidades.forEach((u) => { u.coef = (u.coef || 0) / s; });
        S.fuente = "digitado"; guardar(); pintarTodo(); msgCarga("Coeficientes proporcionalmente ajustados para sumar 100 %.", "ok");
    }

    const dig = () => (S.redondeo >= 1000 ? -3 : S.redondeo >= 100 ? -2 : 0);

    async function plantilla() {
        const enc = ["N°", "Unidad", "Área privada (m²)", "Coeficiente (%)", "Cuota anterior (opcional)"].map((v) => ({ v, s: "enc" }));
        const ej = [["Casa 1", 105.8], ["Casa 2", 91.6], ["Casa 3", 81], ["Casa 4", 81], ["Casa 5", 91.6]];
        const rows = [["PLANTILLA DE UNIDADES — Simulador de cuotas AdminPH"], [], enc];
        ej.forEach((e, i) => rows.push([{ v: i + 1, s: "centro" }, { v: e[0], s: "celda" }, { v: e[1], s: "celda" }, { v: null, s: "celda" }, { v: null, s: "celda" }]));
        rows.push([], [{ v: "Borre los ejemplos y escriba sus unidades. Con el área basta (el simulador calcula el coeficiente); si ya tiene los coeficientes, escríbalos en %.", s: "nota" }]);
        const blob = await XLSXMini.write([{ name: "Unidades", rows, cols: [8, 28, 18, 16, 22], freeze: { row: 3, col: 0 }, merges: ["A1:E1", "A10:E10"], heights: { 9: 40 }, first: true }]);
        XLSXMini.download(blob, "PLANTILLA_UNIDADES_SIMULADOR_CUOTAS.xlsx");
    }

    async function exportar() {
        const c = calcular(S); if (!c.n) { msgCarga("No hay unidades para exportar.", "warn"); return; }
        const d = dig(), ant = S.anterior;
        const first = 12, last = first + c.n - 1;               // filas de datos (numeración de Excel)
        const rows = [];
        rows[0] = [{ v: "SIMULADOR DE CUOTAS DE ADMINISTRACIÓN — anexo pedagógico AdminPH", s: "titulo" }];
        rows[1] = [{ v: "Conjunto", s: "negrita" }, S.nombre || ""];
        rows[2] = [{ v: "Valor ingresado (COP)", s: "negrita" }, { v: S.total || 0, s: "celda" }];
        rows[3] = [{ v: "El valor es", s: "negrita" }, S.periodo];
        rows[4] = [{ v: "Valor mensual a repartir", s: "negrita" }, { f: S.periodo === "anual" ? "B3/12" : "B3", s: "celda" }];
        rows[5] = [{ v: "Cantidad de unidades", s: "negrita" }, { f: `COUNTA(B${first}:B${last})`, s: "celda" }];
        rows[6] = [{ v: "Redondeo (decimales de ROUND)", s: "negrita" }, { v: d, s: "celda" }];
        rows[7] = [{ v: "Cálculo de coeficiente", s: "negrita" }, S.fuente === "area" ? "Por área privada (área ÷ área total)" : "Digitado / importado"];
        rows[8] = [{ v: "Cuota por coeficiente = ROUND(coeficiente × valor mensual). Cuota nominal = ROUND(valor mensual ÷ unidades). Las fórmulas se recalculan si cambia el valor.", s: "nota" }];
        const head = ["N°", "Unidad", "Área m²", "Coeficiente (%)", "Cuota por coeficiente", "Cuota nominal", "Diferencia (nominal − coef.)"];
        if (ant) head.push("Cuota anterior", "Incremento $", "Incremento %");
        rows[10] = head.map((v) => ({ v, s: "enc" }));
        S.unidades.forEach((u, i) => {
            const r = first + i;
            const row = [{ v: i + 1, s: "centro" }, { v: u.nombre, s: "celda" }, { v: u.area || 0, s: "celda" },
                S.fuente === "area" ? { f: `IF(SUM(C$${first}:C$${last})=0,0,C${r}/SUM(C$${first}:C$${last})*100)`, s: "num" } : { v: (u.coef || 0) * 100, s: "num" },
                { f: `ROUND(D${r}/100*$B$5,${d})`, s: "celda" }, { f: `ROUND($B$5/$B$6,${d})`, s: "celda" }, { f: `F${r}-E${r}`, s: "celda" }];
            if (ant) row.push({ v: u.ant == null ? null : u.ant, s: "celda" }, u.ant == null ? { v: null, s: "celda" } : { f: `E${r}-H${r}`, s: "celda" }, u.ant ? { f: `(E${r}-H${r})/H${r}`, s: "celda" } : { v: null, s: "celda" });
            rows[first - 1 + i] = row;
        });
        const t = last + 1;
        rows[t - 1] = [{ v: "", s: "totalTxt" }, { v: "TOTAL", s: "totalTxt" }, { f: `SUM(C${first}:C${last})`, s: "totalTxt" }, { f: `SUM(D${first}:D${last})`, s: "total" }, { f: `SUM(E${first}:E${last})`, s: "totalTxt" }, { f: `SUM(F${first}:F${last})`, s: "totalTxt" }, { f: `SUM(G${first}:G${last})`, s: "totalTxt" }];
        rows[t + 1] = [{ v: "Anexo pedagógico: ejercicio de aprendizaje. La cuota real la aprueba la asamblea según el reglamento de propiedad horizontal (Ley 675 de 2001).", s: "nota" }];
        const blob = await XLSXMini.write([{ name: "Simulador", rows, cols: [8, 30, 12, 16, 20, 16, 22, 18, 16, 14], freeze: { row: 11, col: 2 }, merges: ["A1:G1", "A9:G9", `A${t + 2}:G${t + 2}`], heights: { 8: 36, [t + 1]: 36 }, first: true }]);
        XLSXMini.download(blob, "SIMULADOR_CUOTAS_ADMINISTRACION.xlsx");
    }

    // Deja el simulador y las calculadoras como al inicio (todo en cero).
    function reiniciar() {
        if (!confirm("¿Reiniciar todo? Se borran las unidades, los valores y las calculadoras (queda en cero).")) return;
        Object.assign(S, { nombre: "", total: 0, periodo: "mensual", redondeo: 0, fuente: "digitado", modo: "coef", anterior: false, unidades: [] });
        guardar(); msgCarga(""); pintarTodo();
        document.querySelectorAll("[data-calc]").forEach((c) => c._reset && c._reset());
    }

    // Calculadora de tres cajas: primer valor, operación y segundo valor → resultado.
    function operar(a, op, b) {
        if (a == null || b == null) return { v: 0, err: "" };
        if (op === "+") return { v: a + b };
        if (op === "-") return { v: a - b };
        if (op === "*") return { v: a * b };
        if (op === "/") return b === 0 ? { v: 0, err: "No se puede dividir entre 0" } : { v: a / b };
        return { v: 0 };
    }
    const fmtC = (n) => Number(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 4 });
    function calculadora(box) {
        const q = (k) => box.querySelector(`[data-c="${k}"]`);
        let ultimo = 0;
        const calc = () => {
            const r = operar(parseNum(q("a").value), q("op").value, parseNum(q("b").value));
            ultimo = r.v;
            q("res").textContent = r.err || fmtC(r.v);
        };
        ["a", "b"].forEach((k) => q(k).addEventListener("input", calc));
        q("op").addEventListener("change", calc);
        q("usar").addEventListener("click", () => { q("a").value = fmtC(ultimo); q("b").value = ""; calc(); q("b").focus(); });
        box._reset = () => { q("a").value = ""; q("b").value = ""; q("op").value = "+"; calc(); };
        q("cero").addEventListener("click", box._reset);
        calc();
    }

    // ------------------------------------------------------------------ eventos
    function iniciar() {
        restaurar(); pintarTodo();
        $("inNombre").addEventListener("input", (e) => { S.nombre = e.target.value; guardar(); });
        $("inTotal").addEventListener("change", (e) => { S.total = Math.max(0, parseNum(e.target.value) || 0); e.target.value = S.total ? S.total.toLocaleString("es-CO") : ""; guardar(); pintarCalculos(); });
        $("inPeriodo").addEventListener("change", (e) => { S.periodo = e.target.value; guardar(); pintarCalculos(); });
        $("inRedondeo").addEventListener("change", (e) => { S.redondeo = Number(e.target.value); guardar(); pintarCalculos(); });
        $("inFuente").addEventListener("change", (e) => { S.fuente = e.target.value; guardar(); pintarTabla(); pintarResumen(calcular(S)); });
        $("chkAnterior").addEventListener("change", (e) => { S.anterior = e.target.checked; guardar(); pintarTabla(); pintarResumen(calcular(S)); });
        $("btnGenerar").addEventListener("click", aplicarCantidad);
        $("inCantidad").addEventListener("keydown", (e) => { if (e.key === "Enter") aplicarCantidad(); });
        $("btnCargar").addEventListener("click", () => $("fileExcel").click());
        $("fileExcel").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) cargarExcel(f); });
        $("btnPlantilla").addEventListener("click", plantilla);
        $("btnEjemplo").addEventListener("click", ejemplo);
        $("btnAdminph").addEventListener("click", traerAdminph);
        ["btnReiniciar", "btnReiniciar2"].forEach((id) => $(id).addEventListener("click", reiniciar));
        document.querySelectorAll("[data-calc]").forEach(calculadora);
        $("btnAgregar").addEventListener("click", () => { S.unidades.push({ nombre: `Unidad ${S.unidades.length + 1}`, area: 0, coef: 0, ant: null }); guardar(); pintarTodo(); });
        $("btnNormalizar").addEventListener("click", normalizar);
        $("btnExcel").addEventListener("click", exportar);
        $("btnImprimir").addEventListener("click", () => window.print());
        $("tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-m]"); if (!b) return; S.modo = b.dataset.m; guardar(); pintarTodo(); });
        $("tabla").addEventListener("change", (e) => {
            const t = e.target; if (!t.dataset || t.dataset.i == null) return;
            const u = S.unidades[Number(t.dataset.i)]; if (!u) return; const f = t.dataset.f;
            if (f === "nombre") u.nombre = t.value;
            else if (f === "coef") { u.coef = Math.max(0, (parseNum(t.value) || 0) / 100); t.value = fmtN(u.coef * 100, 4); }
            else if (f === "area") { u.area = Math.max(0, parseNum(t.value) || 0); t.value = u.area ? fmtN(u.area, 2) : ""; }
            else if (f === "ant") { const v = parseNum(t.value); u.ant = v == null ? null : Math.max(0, v); t.value = u.ant != null ? fmtN(u.ant, 0) : ""; }
            guardar(); pintarCalculos();
        });
        $("tabla").addEventListener("click", (e) => {
            const b = e.target.closest("button[data-del]"); if (!b) return;
            S.unidades.splice(Number(b.dataset.del), 1); guardar(); pintarTodo();
        });
    }

    window.SimCuotas = { parseUnidades, calcular, parseNum, redondear, operar, reiniciar, estado: S };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
