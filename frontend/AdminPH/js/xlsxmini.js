/* AdminPH V3.6 — Mini lector/escritor de archivos .xlsx SIN librerías externas (funciona sin internet).
 * Escribe: textos, números, fórmulas, estilos básicos, combinar celdas, anchos, panel inmovilizado, impresión horizontal.
 * Lee: textos, números y valores calculados de la primera o de todas las hojas.
 * Uso:  const blob = await XLSXMini.write([{ name, rows, merges, cols, freeze, landscape }]);
 *       const hojas = await XLSXMini.read(arrayBuffer);  // [{ name, rows:[[...]] }]
 * Celdas: valor simple (texto / número / null) o { v, f, s }   (f = fórmula sin "=", s = nombre de estilo).
 */
(function () {
    "use strict";

    // ------------------------------------------------------------ estilos
    // Índices fijos en cellXfs (ver styles()).
    const ST = { normal: 0, titulo: 1, enc: 2, celda: 3, num: 4, marca: 5, res: 6, total: 7, negrita: 8, nota: 9, texto: 10, subtitulo: 11, centro: 12, pct: 13, totalTxt: 14, ok: 15, marcaLibre: 16 };

    function styles() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
            '<numFmts count="2"><numFmt numFmtId="164" formatCode="0.0000"/><numFmt numFmtId="165" formatCode="0.00&quot;%&quot;"/></numFmts>' +
            '<fonts count="6">' +
            '<font><sz val="11"/><name val="Calibri"/></font>' +
            '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
            '<font><b/><sz val="15"/><color rgb="FF1B4332"/><name val="Calibri"/></font>' +
            '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
            '<font><i/><sz val="10"/><color rgb="FF555555"/><name val="Calibri"/></font>' +
            '<font><b/><sz val="12"/><color rgb="FF1B4332"/><name val="Calibri"/></font>' +
            '</fonts>' +
            '<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
            '<fill><patternFill patternType="solid"><fgColor rgb="FF2D6A4F"/><bgColor indexed="64"/></patternFill></fill>' +
            '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF3B0"/><bgColor indexed="64"/></patternFill></fill>' +
            '<fill><patternFill patternType="solid"><fgColor rgb="FFDFF3E4"/><bgColor indexed="64"/></patternFill></fill>' +
            '<fill><patternFill patternType="solid"><fgColor rgb="FFE5E7E5"/><bgColor indexed="64"/></patternFill></fill>' +
            '<fill><patternFill patternType="solid"><fgColor rgb="FFC8E6C9"/><bgColor indexed="64"/></patternFill></fill>' +
            '</fills>' +
            '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
            '<border><left style="thin"><color rgb="FF888888"/></left><right style="thin"><color rgb="FF888888"/></right><top style="thin"><color rgb="FF888888"/></top><bottom style="thin"><color rgb="FF888888"/></bottom><diagonal/></border></borders>' +
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
            '<cellXfs count="17">' +
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +                                                                                       // 0 normal
            '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                                                        // 1 titulo
            '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' + // 2 enc
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +                 // 3 celda
            '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' + // 4 num
            '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' + // 5 marca
            '<xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' + // 6 res
            '<xf numFmtId="164" fontId="1" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' + // 7 total
            '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                                                        // 8 negrita
            '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +        // 9 nota
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +   // 10 texto
            '<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                                                                        // 11 subtitulo
            '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' + // 12 centro
            '<xf numFmtId="165" fontId="1" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' + // 13 pct
            '<xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' + // 14 totalTxt
            '<xf numFmtId="0" fontId="1" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' + // 15 ok
            '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment horizontal="center" vertical="center"/><protection locked="0"/></xf>' + // 16 marcaLibre (desbloqueada)
            '</cellXfs>' +
            '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    }

    // ------------------------------------------------------------ utilidades
    const enc = new TextEncoder();
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); }
    function colName(i) { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
    function colIndex(letters) { let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }
    function safeSheetName(n, used) {
        let b = String(n || "Hoja").replace(/[\\\/\?\*\[\]:]/g, " ").trim().slice(0, 28) || "Hoja", x = b, k = 2;
        while (used.has(x.toLowerCase())) { x = b.slice(0, 25) + " " + k++; }
        used.add(x.toLowerCase()); return x;
    }

    let CRC_T = null;
    function crc32(u8) {
        if (!CRC_T) { CRC_T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c >>> 0; } }
        let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function zipStore(files) { // files: [{name, data(Uint8Array)}]
        const parts = [], central = []; let offset = 0;
        const now = new Date();
        const dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
        const tm = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
        files.forEach((f) => {
            const nameB = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
            const lh = new DataView(new ArrayBuffer(30));
            lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
            lh.setUint16(10, tm, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true);
            lh.setUint16(26, nameB.length, true); lh.setUint16(28, 0, true);
            parts.push(new Uint8Array(lh.buffer), nameB, f.data);
            const ch = new DataView(new ArrayBuffer(46));
            ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
            ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
            ch.setUint16(28, nameB.length, true); ch.setUint32(42, offset, true);
            central.push(new Uint8Array(ch.buffer), nameB);
            offset += 30 + nameB.length + size;
        });
        let csize = 0; central.forEach((p) => { csize += p.length; });
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, offset, true);
        return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    }

    // ------------------------------------------------------------ escritura
    function cellXml(r, c, cell) {
        const ref = colName(c) + (r + 1);
        if (cell === null || cell === undefined || cell === "") return "";
        let v = cell, f = null, s = 0;
        if (typeof cell === "object") { v = cell.v; f = cell.f || null; s = typeof cell.s === "string" ? (ST[cell.s] || 0) : (cell.s || 0); }
        const sa = s ? ` s="${s}"` : "";
        if (f) return `<c r="${ref}"${sa}><f>${esc(f)}</f></c>`;
        if (v === null || v === undefined || v === "") return s ? `<c r="${ref}"${sa}/>` : "";
        if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${sa}><v>${v}</v></c>`;
        return `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }

    function sheetXml(sh) {
        const rows = sh.rows || [];
        let maxC = 0; rows.forEach((r) => { if (r && r.length > maxC) maxC = r.length; });
        let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
        x += `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`;
        x += `<dimension ref="A1:${colName(Math.max(maxC - 1, 0))}${Math.max(rows.length, 1)}"/>`;
        x += '<sheetViews><sheetView workbookViewId="0"' + (sh.first ? ' tabSelected="1"' : "") + ">";
        if (sh.freeze) { const fr = sh.freeze.row || 0, fc = sh.freeze.col || 0; x += `<pane${fc ? ` xSplit="${fc}"` : ""}${fr ? ` ySplit="${fr}"` : ""} topLeftCell="${colName(fc)}${fr + 1}" activePane="${fr && fc ? "bottomRight" : fr ? "bottomLeft" : "topRight"}" state="frozen"/>`; }
        x += "</sheetView></sheetViews><sheetFormatPr defaultRowHeight=\"18\"/>";
        if (sh.cols && sh.cols.length) { x += "<cols>"; sh.cols.forEach((w, i) => { x += `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`; }); x += "</cols>"; }
        x += "<sheetData>";
        rows.forEach((row, r) => {
            if (!row) return;
            const ht = sh.heights && sh.heights[r] ? ` ht="${sh.heights[r]}" customHeight="1"` : "";
            let cx = ""; row.forEach((cell, c) => { cx += cellXml(r, c, cell); });
            if (cx || ht) x += `<row r="${r + 1}"${ht}>${cx}</row>`;
        });
        x += "</sheetData>";
        if (sh.protect) x += '<sheetProtection sheet="1" objects="1" scenarios="1" formatColumns="0" formatRows="0" autoFilter="0"/>';
        if (sh.autofilter) x += `<autoFilter ref="${sh.autofilter}"/>`;
        if (sh.merges && sh.merges.length) { x += `<mergeCells count="${sh.merges.length}">`; sh.merges.forEach((m) => { x += `<mergeCell ref="${m}"/>`; }); x += "</mergeCells>"; }
        if (sh.validations && sh.validations.length) {
            x += `<dataValidations count="${sh.validations.length}">`;
            sh.validations.forEach((d) => { x += `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="${esc(d.title || "Dato no válido")}" error="${esc(d.msg || "")}" promptTitle="${esc(d.title || "")}" prompt="${esc(d.prompt || "")}" sqref="${d.sqref}"><formula1>${esc(d.formula)}</formula1></dataValidation>`; });
            x += "</dataValidations>";
        }
        x += '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>';
        x += `<pageSetup paperSize="9" orientation="${sh.landscape === false ? "portrait" : "landscape"}" fitToWidth="1" fitToHeight="0"/>`;
        if (sh.header) x += `<headerFooter><oddHeader>${esc(String(sh.header).replace(/&/g, "&&"))}</oddHeader><oddFooter>&amp;LAdminPH&amp;CPágina &amp;P de &amp;N</oddFooter></headerFooter>`;
        x += "</worksheet>";
        return x;
    }

    function definedNames(sheets, names) {
        let d = "";
        sheets.forEach((sh, i) => {
            const q = "'" + names[i].replace(/'/g, "''") + "'";
            if (sh.autofilter) { const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(sh.autofilter); if (m) d += `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${esc(q)}!$${m[1]}$${m[2]}:$${m[3]}$${m[4]}</definedName>`; }
            if (sh.printTitleRow) d += `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${esc(q)}!$${sh.printTitleRow}:$${sh.printTitleRow}</definedName>`;
        });
        return d ? "<definedNames>" + d + "</definedNames>" : "";
    }

    async function write(sheets) {
        const used = new Set(); const names = [];
        sheets.forEach((s, i) => { s.first = i === 0; names.push(safeSheetName(s.name, used)); });
        const files = [];
        const add = (n, t) => files.push({ name: n, data: enc.encode(t) });
        add("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
            sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") + "</Types>");
        add("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
        add("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' +
            names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + '</sheets>' + definedNames(sheets, names) + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
        add("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
            `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
        add("xl/styles.xml", styles());
        sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
        return zipStore(files);
    }

    // ------------------------------------------------------------ lectura
    async function inflateRaw(u8) {
        const ds = new DecompressionStream("deflate-raw");
        const stream = new Blob([u8]).stream().pipeThrough(ds);
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    async function unzip(buf) {
        const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
        let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
        if (e < 0) throw new Error("El archivo no es un Excel (.xlsx) válido.");
        const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
        const dec = new TextDecoder();
        for (let i = 0; i < n; i++) {
            if (dv.getUint32(p, true) !== 0x02014b50) break;
            const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
            const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
            const lnl = dv.getUint16(lo + 26, true), lel = dv.getUint16(lo + 28, true), ds = lo + 30 + lnl + lel;
            const raw = u8.subarray(ds, ds + csize);
            out[name] = { method, raw };
            p += 46 + nl + el + cl;
        }
        const text = async (name) => { const f = out[name]; if (!f) return null; const d = f.method === 0 ? f.raw : await inflateRaw(f.raw); return dec.decode(d); };
        return { text, names: Object.keys(out) };
    }

    const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    function xmlDoc(t) { const d = new DOMParser().parseFromString(t, "application/xml"); return d; }
    function textOf(el) { let s = ""; el.querySelectorAll("t").forEach((t) => { if (!t.closest("rPh")) s += t.textContent; }); return s; }

    async function read(buf) {
        const z = await unzip(buf);
        const wbT = await z.text("xl/workbook.xml"); if (!wbT) throw new Error("El archivo no es un Excel (.xlsx) válido.");
        const relT = (await z.text("xl/_rels/workbook.xml.rels")) || "";
        const rels = {}; xmlDoc(relT).querySelectorAll("Relationship").forEach((r) => { rels[r.getAttribute("Id")] = r.getAttribute("Target"); });
        const shared = []; const sst = await z.text("xl/sharedStrings.xml");
        if (sst) xmlDoc(sst).querySelectorAll("si").forEach((si) => shared.push(textOf(si)));
        const sheets = [];
        const sh = xmlDoc(wbT).querySelectorAll("sheet");
        for (const s of sh) {
            const rid = s.getAttribute("r:id") || s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
            let target = rels[rid] || ""; target = target.replace(/^\//, ""); if (!target.startsWith("xl/")) target = "xl/" + target;
            const st = await z.text(target); if (!st) continue;
            const rows = [];
            xmlDoc(st).querySelectorAll("sheetData > row").forEach((row) => {
                row.querySelectorAll(":scope > c").forEach((c) => {
                    const m = /^([A-Z]+)(\d+)$/.exec(c.getAttribute("r") || ""); if (!m) return;
                    const ci = colIndex(m[1]), ri = Number(m[2]) - 1, t = c.getAttribute("t");
                    const vEl = c.querySelector(":scope > v"); let val = null;
                    if (t === "inlineStr") val = textOf(c.querySelector(":scope > is") || c);
                    else if (vEl) { const raw = vEl.textContent; if (t === "s") val = shared[Number(raw)] ?? ""; else if (t === "str" || t === "e") val = raw; else if (t === "b") val = raw === "1"; else { const n = Number(raw); val = isNaN(n) ? raw : n; } }
                    if (val === null || val === "") return;
                    if (!rows[ri]) rows[ri] = [];
                    rows[ri][ci] = val;
                });
            });
            for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
            sheets.push({ name: s.getAttribute("name"), rows });
        }
        return sheets;
    }

    function download(blob, filename) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }

    window.XLSXMini = { write, read, download, colName, ST, unzip };
})();
