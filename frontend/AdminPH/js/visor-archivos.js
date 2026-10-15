/* AdminPH V4.2 — Visor de archivos adjuntos.
 * Abre el archivo dentro de la aplicación (sin descargarlo): PDF, imágenes, texto/CSV, Excel (.xlsx), Word (.docx) y PowerPoint (.pptx).
 * Los formatos antiguos (.doc, .xls, .ppt, .odt…) no se pueden mostrar en el navegador: se ofrece la descarga.
 * Uso: AdminPHVisor.abrir({ nombre, tipo, data })   (data = "data:...;base64,...")
 */
(function () {
    "use strict";
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const ext = (n) => (String(n || "").toLowerCase().match(/\.([a-z0-9]+)$/) || [, ""])[1];
    const dec = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

    function estilos() {
        if (document.getElementById("visorCss")) return;
        const s = document.createElement("style"); s.id = "visorCss";
        s.textContent = `#visorArch{position:fixed;inset:0;z-index:10050;background:rgba(10,20,15,.72);display:flex;align-items:center;justify-content:center;padding:12px}
#visorArch .vb{background:#fff;color:#1f2d24;border-radius:14px;width:min(1200px,100%);height:min(94vh,100%);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)}
#visorArch .vh{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #dce7df;background:#f3f7f4}
#visorArch .vh h3{margin:0;flex:1;font-size:1rem;min-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#visorArch .vh button{font:inherit;font-weight:700;font-size:.85rem;border:0;border-radius:9px;padding:8px 12px;cursor:pointer;background:#2d6a4f;color:#fff}
#visorArch .vh button.s{background:#e8f5ec;color:#1f5c43}
#visorArch .vc{flex:1;overflow:auto;padding:0;min-height:0}
#visorArch iframe,#visorArch embed{width:100%;height:100%;border:0;display:block}
#visorArch img{max-width:100%;max-height:100%;display:block;margin:auto;object-fit:contain}
#visorArch .vt{padding:16px;white-space:pre-wrap;font:14px/1.6 system-ui,sans-serif}
#visorArch .vs{padding:6px 12px;display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid #dce7df}
#visorArch .vs button{border:1px solid #dce7df;background:#fff;color:#1f2d24;border-radius:8px;padding:5px 10px;cursor:pointer;font:inherit;font-size:.82rem}
#visorArch .vs button.on{background:#2d6a4f;color:#fff;border-color:#2d6a4f}
#visorArch table{border-collapse:collapse;font-size:.85rem;margin:10px}
#visorArch td,#visorArch th{border:1px solid #dce7df;padding:4px 8px;white-space:nowrap}
#visorArch .vm{padding:30px;text-align:center;color:#5a6b60}`;
        document.head.appendChild(s);
    }

    async function aBlob(a) {
        const r = await fetch(a.data); const b = await r.blob();
        return b.type && b.type !== "application/octet-stream" ? b : new Blob([b], { type: a.tipo || b.type });
    }

    function tablaHTML(rows, max) {
        const filas = rows.slice(0, max || 500);
        const cols = Math.min(60, filas.reduce((m, r) => Math.max(m, (r || []).length), 0));
        let h = "<table>";
        filas.forEach((r, i) => { h += "<tr>"; for (let c = 0; c < cols; c++) { const v = (r || [])[c]; h += `<${i === 0 ? "th" : "td"}>${esc(v == null ? "" : v)}</${i === 0 ? "th" : "td"}>`; } h += "</tr>"; });
        return h + "</table>" + (rows.length > filas.length ? `<div class="vm">Se muestran las primeras ${filas.length} de ${rows.length} filas. Descargue el original para verlo completo.</div>` : "");
    }

    async function textoOffice(buf, kind) {
        const z = await window.XLSXMini.unzip(buf);
        if (kind === "docx") {
            const x = (await z.text("word/document.xml")) || "";
            return x.split(/<\/w:p>/).map((p) => (p.match(/<w:t[^>]*>[^<]*<\/w:t>|<w:tab\/>/g) || []).map((t) => (t === "<w:tab/>" ? "\t" : dec(t.replace(/<[^>]+>/g, "")))).join("")).filter((l, i, a) => l || (a[i - 1] && a[i - 1] !== "")).join("\n");
        }
        const slides = z.names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
        const out = [];
        for (let i = 0; i < slides.length; i++) { const x = (await z.text(slides[i])) || ""; out.push(`— Diapositiva ${i + 1} —\n` + (x.match(/<a:t>[^<]*<\/a:t>/g) || []).map((t) => dec(t.replace(/<[^>]+>/g, ""))).join("\n")); }
        return out.join("\n\n");
    }

    function cerrar() { const m = document.getElementById("visorArch"); if (m) { if (m._url) URL.revokeObjectURL(m._url); m.remove(); } document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") cerrar(); }

    async function abrir(a) {
        estilos(); cerrar();
        const nombre = a.nombre || "archivo", e = ext(nombre);
        const m = document.createElement("div"); m.id = "visorArch";
        m.innerHTML = `<div class="vb"><div class="vh"><h3>📄 ${esc(nombre)}</h3><button class="s" data-v="nueva" style="display:none">↗ Pestaña nueva</button><button class="s" data-v="desc">⬇ Descargar original</button><button data-v="cerrar">✖ Cerrar</button></div><div class="vc"><div class="vm">Abriendo…</div></div></div>`;
        document.body.appendChild(m);
        m.addEventListener("click", (ev) => { if (ev.target === m) cerrar(); });
        document.addEventListener("keydown", onKey);
        const cont = m.querySelector(".vc");
        const btn = (k) => m.querySelector(`[data-v="${k}"]`);
        btn("cerrar").onclick = cerrar;
        try {
            if (!a.data) throw new Error("El archivo no tiene contenido guardado.");
            const blob = await aBlob(a);
            const url = URL.createObjectURL(blob); m._url = url;
            btn("desc").onclick = () => { const l = document.createElement("a"); l.href = url; l.download = nombre; document.body.appendChild(l); l.click(); l.remove(); };
            const nueva = btn("nueva"); nueva.onclick = () => window.open(url, "_blank");
            if (e === "pdf" || /pdf/i.test(a.tipo || "")) {
                const pdf = new Blob([blob], { type: "application/pdf" }); URL.revokeObjectURL(url); m._url = URL.createObjectURL(pdf);
                btn("desc").onclick = () => { const l = document.createElement("a"); l.href = m._url; l.download = nombre; document.body.appendChild(l); l.click(); l.remove(); };
                nueva.style.display = ""; nueva.onclick = () => window.open(m._url, "_blank");
                cont.innerHTML = `<iframe title="${esc(nombre)}" src="${m._url}"></iframe>`;
            } else if (/^(png|jpe?g|gif|webp|bmp|svg)$/.test(e) || /^image\//.test(a.tipo || "")) {
                nueva.style.display = ""; cont.innerHTML = `<img alt="${esc(nombre)}" src="${url}">`;
            } else if (e === "txt" || e === "csv" || /^text\//.test(a.tipo || "")) {
                const t = await blob.text();
                if (e === "csv") { const rows = t.split(/\r?\n/).filter(Boolean).map((l) => l.split(/[;,\t]/)); cont.innerHTML = tablaHTML(rows); }
                else cont.innerHTML = `<div class="vt">${esc(t)}</div>`;
            } else if (e === "xlsx" || e === "xlsm") {
                const hojas = await window.XLSXMini.read(await blob.arrayBuffer());
                if (!hojas.length) throw new Error("El Excel no tiene hojas.");
                cont.innerHTML = `<div class="vs">${hojas.map((h, i) => `<button data-h="${i}" class="${i ? "" : "on"}">${esc(h.name)}</button>`).join("")}</div><div data-hv></div>`;
                const pinta = (i) => { cont.querySelector("[data-hv]").innerHTML = tablaHTML(hojas[i].rows); cont.querySelectorAll(".vs button").forEach((b, j) => b.classList.toggle("on", j === i)); };
                cont.querySelectorAll(".vs button").forEach((b) => (b.onclick = () => pinta(Number(b.dataset.h)))); pinta(0);
            } else if (e === "docx" || e === "pptx") {
                const t = await textoOffice(await blob.arrayBuffer(), e);
                cont.innerHTML = `<div class="vt">${t ? esc(t) : "El documento no tiene texto."}</div><div class="vm">Vista de solo texto. Para ver el formato, imágenes y tablas originales, use «Descargar original».</div>`;
            } else {
                cont.innerHTML = `<div class="vm"><p style="font-size:2rem;margin:0">📄</p><p>Este formato (<b>.${esc(e || "?")}</b>) no se puede mostrar dentro del navegador.</p><p>Use <b>«Descargar original»</b> y ábralo con su programa de oficina. Si lo guarda como <b>PDF</b> o <b>.docx/.xlsx</b> antes de adjuntarlo, AdminPH lo abrirá aquí.</p></div>`;
            }
        } catch (err) {
            cont.innerHTML = `<div class="vm">No se pudo abrir el archivo: ${esc(err.message || err)}</div>`;
        }
    }

    window.AdminPHVisor = { abrir, cerrar };
})();
