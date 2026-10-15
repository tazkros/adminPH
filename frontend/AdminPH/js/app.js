(function(){
    // ==================== CONSTANTES ====================
    const TIPOS_UNIDAD = [
        { value: "residencial", label: "🏠 Residencial (Torre/Apto)", class: "badge-residencial", formatoEspecial: false },
        { value: "casa", label: "🏡 Casa", class: "badge-casa", formatoEspecial: true, prefijo: "Casa" },
        { value: "comercial", label: "🏪 Comercial", class: "badge-comercial", formatoEspecial: true, prefijo: "Local" },
        { value: "industrial", label: "🏭 Industrial", class: "badge-industrial", formatoEspecial: true, prefijo: "Bodega" },
        { value: "parqueadero", label: "🅿️ Parqueadero", class: "badge-parqueadero", formatoEspecial: true, prefijo: "P" },
        { value: "areacomun", label: "🌳 Área Común", class: "badge-areacomun", formatoEspecial: true, prefijo: "AC" }
    ];

    const ROLES = {
        superadmin: { name: "Super Administrador", permissions: { canCreateUsers: true, canEditAll: true, canConfigStructure: true, canEditAttendance: true, canEditCoefficients: true, canViewAll: true, canViewQuorum: true } },
        admin: { name: "Administrador", permissions: { canCreateUsers: false, canEditAll: true, canConfigStructure: true, canEditAttendance: true, canEditCoefficients: true, canViewAll: true, canViewQuorum: true } },
        operador: { name: "Operador", permissions: { canCreateUsers: false, canEditAll: false, canConfigStructure: false, canEditAttendance: true, canEditCoefficients: false, canViewAll: false, canViewQuorum: true } },
        usuario: { name: "Propietario", permissions: { canCreateUsers: false, canEditAll: false, canConfigStructure: false, canEditAttendance: false, canEditCoefficients: false, canViewAll: false, canViewQuorum: true, canSeeOwnUnitOnly: true, canVote: true } },
        invitado: { name: "Invitado", permissions: { canCreateUsers: false, canEditAll: false, canConfigStructure: false, canEditAttendance: false, canEditCoefficients: false, canViewAll: true, canViewQuorum: true, readOnly: true } }
    };

    // ==================== PERMISOS POR ROL ====================
    function rolActual() { return currentUser?.role || ''; }
    function esSuperAdmin() { return rolActual() === 'superadmin'; }
    function esAdministrador() { return rolActual() === 'admin' || rolActual() === 'superadmin'; }
    function puedePrepararAsamblea() { return esAdministrador(); }
    function puedeGestionarUsuarios() { return esSuperAdmin(); }
    function puedeOperarAsamblea() { return ['admin','superadmin','operador'].includes(rolActual()); }
    function esSoloConsulta() { return ['usuario','invitado'].includes(rolActual()); }
    function puedeExportarActa() { return !['usuario','invitado'].includes(rolActual()); }
    function puedeVerQRCompleto() { return esAdministrador(); }
    function puedeVerQRAasistentes() { return ['superadmin','admin','operador','usuario','invitado'].includes(rolActual()); }
    function puedeExportarQRAasistentes() { return ['superadmin','admin','operador'].includes(rolActual()); }

    const DEFAULT_USERS = {
        superadmin: { name: "Super Administrador", role: "superadmin", password: "SuperAdminPh123*" },
        admin: { name: "Administrador General", role: "admin", password: "AdminPh123*" },
        operador: { name: "Operador de Campo", role: "operador", password: "Admin123" },
        usuario: { name: "Propietario Demo", role: "usuario", password: "User123", unidadAsignada: 1 },
        invitado: { name: "Invitado", role: "invitado", password: "123" }
    };

    // ==================== ESTADO ====================
    let currentUser = null;
    let unidades = [];
    let asistencia = [];
    let votaciones = [];
    let faseActual = 1;
    let actividadActiva = null;
    let actividadActivaId = null;
    let archivosAsamblea = [];
    let cierreAsamblea = { registrado: false, fecha: '', hora: '', cerradoPor: '', reaperturaAutorizadaEn: '', reaperturaAutorizadaPor: '' };
    let asambleaEdicionAutorizada = false;
    const CLAVE_REAPERTURA_ASAMBLEA = 'AdminPH-REAPERTURA-2026';
    let intervaloQuorum = null;
    let intervaloQRAasistentes = null;
    let firmaQRAasistentes = '';

    let configConjunto = {
    nombreConjunto: "Mi Conjunto Residencial",
    nit: "",
    organizacionNombre: "AdminPH",
    organizacionContacto: "",
    organizacionTelefono: "",
    organizacionCorreo: "",
    organizacionWeb: "",
    ciudad: "",
    direccion: "",
    administradorNombre: "",
    administradorDocumento: "",
    fechaReunion: "",
    horaReunion: "",
    tipoReunion: "ordinaria",
    quorumPorcentaje: 50,
    convocatoriaActual: 1,
    quorumPrimeraPorcentaje: 50,
    quorumSegundaPorcentaje: 30,
    unidadesPorNivel: 4,
    niveles: [
            { nombre: "Etapa", activo: false, cantidad: 0 },
            { nombre: "Manzana", activo: false, cantidad: 0 },
            { nombre: "Bloque", activo: false, cantidad: 0 },
            { nombre: "Torre", activo: false, cantidad: 0 },
            { nombre: "Nivel", activo: false, cantidad: 0 },
            { nombre: "Unidad", activo: true, cantidad: 1 }
        ],
        formatoUnidad: "{NIVEL}{UNIDAD}"
    };

    // Orden del día persistente
    let puntosOrdenDia = [
        { id: 1, texto: "Verificación del Quórum", activo: true, completado: false, modulo: "quorum" },
        { id: 2, texto: "Nombramiento presidente de asamblea", activo: true, completado: false, modulo: "presidente" },
        { id: 3, texto: "Nombramiento secretario de asamblea", activo: true, completado: false, modulo: "secretario" },
        { id: 4, texto: "Aprobación del orden del día", activo: true, completado: false, modulo: "personalizado" },
        { id: 5, texto: "Designación comisión verificadora del acta", activo: true, completado: false, modulo: "comite" },
        { id: 6, texto: "Aprobación del acta anterior", activo: true, completado: false, modulo: "acta" },
        { id: 7, texto: "Informe de administración y consejo", activo: true, completado: false, modulo: "informe" },
        { id: 8, texto: "Informe de revisoría fiscal", activo: true, completado: false, modulo: "revisor" },
        { id: 9, texto: "Aprobación estados financieros", activo: true, completado: false, modulo: "financieros" },
        { id: 10, texto: "Aprobación presupuesto y cuota", activo: true, completado: false, modulo: "presupuesto" },
        { id: 11, texto: "Informe jurídico", activo: true, completado: false, modulo: "juridico" },
        { id: 12, texto: "Nombramiento consejo de administración", activo: true, completado: false, modulo: "consejo" },
        { id: 13, texto: "Nombramiento comité de convivencia", activo: true, completado: false, modulo: "convivencia" },
        { id: 14, texto: "Nombramiento revisor fiscal", activo: true, completado: false, modulo: "revisorFiscal" },
        { id: 15, texto: "Proposiciones y varios", activo: true, completado: false, modulo: "proposiciones" },
        { id: 16, texto: "Votaciones adicionales (fuera del orden del día)", activo: true, completado: false, modulo: "votacionesExtra", fueraOrdenDia: true },
        { id: 17, texto: "Cierre de la asamblea", activo: true, completado: false, modulo: "cierre" }
    ];
    let contadorPuntos = 18;

    // ==================== SISTEMA DE VOTACIÓN POR QR ====================
// Almacén de votos recibidos por QR (simula backend con localStorage)
// Estructura: { presidente: [{unidadId, unidadNombre, coeficiente, candidatoIdx, timestamp}], secretario: [...] }
let votosQR = { presidente: [], secretario: [], comite: [], ordenDia: [], actaAnterior: [], financieros: [], presupuesto: [], consejo: [], convivencia: [], revisorFiscal: [] };

// Timestamp de apertura de cada votación
let votacionApertura = { presidente: null, secretario: null, comite: null, ordenDia: null, actaAnterior: null, financieros: null, presupuesto: null, consejo: null, convivencia: null, revisorFiscal: null };
let votacionTemporizadores = {};


    // Estado de votación por cargo (presidente / secretario)
    let votacionEstado = {
        presidente: { candidatos: [], abierta: false, tipoVoto: 'nominal', modoEntrada: 'avanzado', votantes: [], tipoQuorum: 'deliberatorio', porcentajeQuorum: 50 },
        secretario: { candidatos: [], abierta: false, tipoVoto: 'nominal', modoEntrada: 'avanzado', votantes: [], tipoQuorum: 'deliberatorio', porcentajeQuorum: 50 },
        comite: { candidatos: [], abierta: false, tipoVoto: 'nominal', modoEntrada: 'avanzado', votantes: [], tipoQuorum: 'deliberatorio', porcentajeQuorum: 50, seleccionMultiple: true, ganadoresRequeridos: 3 },
        ordenDia: { candidatos: [], abierta: false, tipoVoto: 'nominal', modoEntrada: 'avanzado', votantes: [], tipoQuorum: 'deliberatorio', porcentajeQuorum: 50, opciones: [{nombre:'Sí', votosNominal:0, votosCoeficiente:0},{nombre:'No', votosNominal:0, votosCoeficiente:0}] },
        actaAnterior: { candidatos: [], abierta: false, tipoVoto: 'nominal', modoEntrada: 'avanzado', votantes: [], tipoQuorum: 'deliberatorio', porcentajeQuorum: 50, opciones: [{nombre:'Sí', votosNominal:0, votosCoeficiente:0},{nombre:'No', votosNominal:0, votosCoeficiente:0}] },
        financieros: { candidatos: [], abierta: false, tipoVoto: 'nominal', modoEntrada: 'avanzado', votantes: [], tipoQuorum: 'deliberatorio', porcentajeQuorum: 50, opciones: [{nombre:'Sí', votosNominal:0, votosCoeficiente:0},{nombre:'No', votosNominal:0, votosCoeficiente:0}] },
        presupuesto: { candidatos: [], abierta: false, tipoVoto: 'nominal', modoEntrada: 'avanzado', votantes: [], tipoQuorum: 'deliberatorio', porcentajeQuorum: 50, opciones: [] },
        consejo: { candidatos: [], abierta: false, tipoVoto: 'nominal', modoEntrada: 'avanzado', votantes: [], tipoQuorum: 'deliberatorio', porcentajeQuorum: 50 },
        convivencia: { candidatos: [], abierta: false, tipoVoto: 'nominal', modoEntrada: 'avanzado', votantes: [], tipoQuorum: 'deliberatorio', porcentajeQuorum: 50 },
        revisorFiscal: { candidatos: [], abierta: false, tipoVoto: 'manoAlzada', modoEntrada: 'manual', votantes: [] }
    };

    // Votaciones adicionales fuera del orden del día.
    let votacionesExtra = [];

    // ==================== UTILIDADES ====================
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function generarEjemploFormato(formato) {
        if (!formato) return '101, 102, 103...';
        return formato.replace(/{NIVEL}/g, '1').replace(/{UNIDAD}/g, '01')
            .replace(/{TORRE}/g, '1').replace(/{BLOQUE}/g, 'A')
            .replace(/{MANZANA}/g, 'A').replace(/{ETAPA}/g, '1');
    }

    function actualizarCoeficienteTotal(u) {
        u.coeficiente = parseFloat(u.coeficiente) || 0;
        u.coeficienteParqueadero = parseFloat(u.coeficienteParqueadero) || 0;
        u.coeficienteTotal = u.coeficiente + u.coeficienteParqueadero;
        return u.coeficienteTotal;
    }

    // ==================== BLOQUEO POST-CIERRE ====================
    function asambleaCerrada() {
        return !!(cierreAsamblea && cierreAsamblea.registrado);
    }

    function puedeModificarAsamblea() {
        return !asambleaCerrada() || asambleaEdicionAutorizada;
    }

    function solicitarDesbloqueoAsamblea(modulo) {
        if (!asambleaCerrada()) return true;
        const rol = currentUser?.role;
        if (rol !== 'admin' && rol !== 'superadmin') {
            alert('🔒 ASAMBLEA CERRADA\n\nLa asamblea está cerrada y sus datos se encuentran protegidos. Solo el Administrador o Super Administrador puede autorizar una modificación.');
            return false;
        }
        const clave = prompt('🔐 AUTORIZACIÓN EXTRA\n\nIngrese la clave especial para modificar una asamblea ya cerrada:');
        if (clave !== CLAVE_REAPERTURA_ASAMBLEA) {
            alert('❌ Clave incorrecta. No se autorizó ninguna modificación.');
            return false;
        }
        asambleaEdicionAutorizada = true;
        cierreAsamblea.reaperturaAutorizadaEn = new Date().toISOString();
        cierreAsamblea.reaperturaAutorizadaPor = currentUser.username || currentUser.name || rol;
        guardarDatos();
        alert('🔓 MODIFICACIÓN AUTORIZADA\n\nLa asamblea permanece cerrada, pero se habilitó temporalmente la edición bajo autorización administrativa.');
        if (modulo) loadModule(modulo);
        return true;
    }

    function renderBloqueoAsamblea(modulo) {
        const content = document.getElementById('mainContent');
        const puedeDesbloquear = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
        content.innerHTML = `<div class="card" style="text-align:center;padding:45px 25px;">
            <div style="font-size:54px;">🔒</div>
            <h2>Asamblea cerrada</h2>
            <p style="max-width:700px;margin:15px auto;line-height:1.6;">La fecha y hora de cierre ya fueron consignadas en el acta. Para proteger la trazabilidad, no se permiten modificaciones posteriores.</p>
            <div class="summary-bar ok" style="max-width:650px;margin:20px auto;text-align:left;"><strong>🏁 Cierre registrado</strong><br>Fecha: ${escapeHtml(cierreAsamblea.fecha||'-')} · Hora: ${escapeHtml(cierreAsamblea.hora||'-')}<br><small>Solo el Administrador o Super Administrador puede autorizar una modificación mediante la clave adicional.</small></div>
            <button id="nuevaAsambleaBtn" class="btn-primary" style="margin:10px;">
            🆕 Crear nueva Asamblea
            </button>
            ${puedeDesbloquear ? `<button id="desbloquearAsambleaBtn" class="btn-secondary" style="margin:10px;">🔐 Autorizar modificación administrativa</button>` : '<p style="color:#b71c1c;font-weight:bold;">Su perfil no tiene autorización para modificar una asamblea cerrada.</p>'}
        </div>`;
        document.getElementById('desbloquearAsambleaBtn')?.addEventListener('click',()=>solicitarDesbloqueoAsamblea(modulo));
        document.getElementById('nuevaAsambleaBtn')?.addEventListener('click',crearNuevaAsamblea);
    }

    // ==================== QUÓRUM ESPECÍFICO DE VOTACIÓN ====================
    // Se calcula siempre sobre los asistentes presentes, no sobre el universo total de la copropiedad.
    function normalizarQuorumVotacion(est) {
        if (!est) return;
        est.tipoQuorum = est.tipoQuorum === 'decisorio' ? 'decisorio' : 'deliberatorio';
        if (est.porcentajeQuorum === undefined || est.porcentajeQuorum === null || isNaN(parseFloat(est.porcentajeQuorum))) {
            est.porcentajeQuorum = est.tipoQuorum === 'decisorio' ? 70 : 50;
        }
    }

    function obtenerQuorumVotacion(est) {
        normalizarQuorumVotacion(est);
        const r = calcularQuorum();
        const asistentes = Math.max(0, parseInt(r.asistentes) || 0);
        const porcentaje = Math.max(1, Math.min(100, parseFloat(est.porcentajeQuorum) || (est.tipoQuorum === 'decisorio' ? 70 : 50)));
        const esCoef = est.tipoVoto === 'coeficiente';
        // En coeficiente, la base es únicamente el total de coeficientes de los asistentes presentes.
        // Nunca se utiliza el coeficiente global de la copropiedad para este umbral.
        const base = esCoef ? Math.max(0, parseFloat(r.coeficientesPresentes) || 0) : asistentes;
        const votosRequeridos = esCoef ? (base * porcentaje / 100) : Math.ceil(base * porcentaje / 100);
        return { tipo: est.tipoQuorum, porcentaje, asistentes, base, esCoef, votosRequeridos };
    }

    function obtenerVotosFavorables(est) {
        if (!est) return 0;
        const esMano = est.tipoVoto === 'manoAlzada';
        const esCoef = est.tipoVoto === 'coeficiente';
        const fuente = Array.isArray(est.opciones) && est.opciones.length ? est.opciones : (est.candidatos || []);
        const valores = fuente.map(x => esMano ? (x.votosManoAlzada || 0) : esCoef ? (x.votosCoeficiente || 0) : (x.votosNominal || 0));
        if (Array.isArray(est.opciones) && est.opciones.length) {
            const si = est.opciones.find(o => String(o.nombre || '').trim().toLowerCase() === 'sí' || String(o.nombre || '').trim().toLowerCase() === 'si');
            return si ? (esMano ? (si.votosManoAlzada||0) : esCoef ? (si.votosCoeficiente||0) : (si.votosNominal||0)) : Math.max(...valores, 0);
        }
        return Math.max(...valores, 0);
    }

    function resumenQuorumVotacion(est) {
        const q = obtenerQuorumVotacion(est);
        const favorables = obtenerVotosFavorables(est);
        const aprobado = favorables >= q.votosRequeridos && q.votosRequeridos > 0;
        return { ...q, favorables, aprobado };
    }

    function resumenQuorumEleccion(est, cargo) {
        const q = obtenerQuorumVotacion(est);
        const esMano = est.tipoVoto === 'manoAlzada';
        const esCoef = est.tipoVoto === 'coeficiente';
        const vals = (est.candidatos || []).map(c => esMano ? (c.votosManoAlzada||0) : esCoef ? (c.votosCoeficiente||0) : (c.votosNominal||0));
        const total = vals.reduce((a,b)=>a+b,0);
        const sumatoria = ['comite','consejo','convivencia'].includes(cargo);
        const favorables = sumatoria ? total : Math.max(...vals,0);
        return {...q, favorables, aprobado:favorables >= q.votosRequeridos && q.votosRequeridos > 0, sumatoria, totalVotos:total};
    }

    function htmlSelectorQuorumVotacion(key, est) {
        normalizarQuorumVotacion(est);
        const q = obtenerQuorumVotacion(est);
        const disabled = est.abierta ? 'disabled' : '';
        return `<div class="summary-bar" style="margin:12px 0;border-left:5px solid #2d6a4f;">
            <strong>⚖️ Tipo de quórum para esta votación</strong>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                <button type="button" id="qDel_${key}" class="btn-secondary" ${disabled}>⚖️ Quórum deliberatorio — 50%</button>
                <button type="button" id="qDec_${key}" class="btn-primary" ${disabled}>✅ Quórum decisorio — 70%</button>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center;">
                <label style="flex:1;min-width:230px;"><strong>Porcentaje requerido para aprobar:</strong>
                    <input id="qPct_${key}" type="number" min="1" max="100" step="1" value="${q.porcentaje}" ${disabled} style="width:110px;margin-left:8px;text-align:center;font-weight:bold;"> %
                </label>
                <div style="flex:1;min-width:230px;"><strong>Base de cálculo:</strong> ${q.esCoef ? Number(q.base).toFixed(4)+' de coeficientes presentes' : q.asistentes+' asistentes presentes'}</div>
            </div>
            <div id="qInfo_${key}" style="margin-top:8px;font-size:13px;">Se requiere al menos <strong>${q.esCoef ? Number(q.votosRequeridos).toFixed(4) : q.votosRequeridos}</strong> ${q.esCoef ? 'de coeficiente favorable' : 'votos favorables'} para alcanzar el ${q.porcentaje}% de los asistentes presentes.</div>
        </div>`;
    }

    function configurarSelectorQuorumVotacion(key, est, rerender) {
        normalizarQuorumVotacion(est);
        const del = document.getElementById(`qDel_${key}`), dec = document.getElementById(`qDec_${key}`), pct = document.getElementById(`qPct_${key}`);
        const aplicar = (tipo, porcentaje) => {
            if (est.abierta) return;
            est.tipoQuorum = tipo;
            est.porcentajeQuorum = porcentaje;
            guardarDatos();
            if (typeof rerender === 'function') rerender();
        };
        del?.addEventListener('click', () => aplicar('deliberatorio', 50));
        dec?.addEventListener('click', () => aplicar('decisorio', 70));
        pct?.addEventListener('change', () => {
            if (est.abierta) return;
            est.porcentajeQuorum = Math.max(1, Math.min(100, parseFloat(pct.value) || (est.tipoQuorum === 'decisorio' ? 70 : 50)));
            guardarDatos();
            if (typeof rerender === 'function') rerender();
        });
    }

    // ==================== GRÁFICOS DE RESULTADOS ====================
    function capturarGraficoVotacion(key) {
        const est = votacionEstado[key];
        if (!est) return;
        const esMano = est.tipoVoto === 'manoAlzada';
        const esCoef = est.tipoVoto === 'coeficiente';
        const items = Array.isArray(est.opciones) && est.opciones.length ? est.opciones.map(o => ({
            nombre: o.nombre || 'Sin nombre',
            votos: esMano ? (o.votosManoAlzada||0) : esCoef ? (o.votosCoeficiente||0) : (o.votosNominal||0)
        })) : (Array.isArray(est.candidatos) ? est.candidatos.map(c => ({
            nombre: c.nombre || 'Sin nombre',
            votos: esMano ? (c.votosManoAlzada||0) : esCoef ? (c.votosCoeficiente||0) : (c.votosNominal||0)
        })) : []);
        const total = items.reduce((a,x)=>a+(parseFloat(x.votos)||0),0);
        const q = (['comite','consejo','convivencia'].includes(key)) ? resumenQuorumEleccion(est,key) : resumenQuorumVotacion(est);
        est.graficoResultado = {
            generadoEn: new Date().toISOString(),
            modalidad: esMano ? 'Mano Alzada' : esCoef ? 'Por Coeficiente' : 'Nominal / QR',
            items: items,
            total: total,
            quorumTipo: q.tipo,
            quorumPorcentaje: q.porcentaje,
            quorumBase: q.base,
            quorumAsistentes: q.asistentes,
            quorumRequeridos: q.votosRequeridos,
            quorumFavorables: q.favorables,
            quorumAprobado: q.aprobado,
            sumatoria: !!q.sumatoria,
            quorumTotalVotos: q.totalVotos || 0
        };
        guardarDatos();
    }

    function generarGraficoVotacionHTML(grafico, titulo='Resultado de la votación') {
        if (!grafico || !Array.isArray(grafico.items)) return '';
        const items = grafico.items.map((x,i)=>({
            nombre: x.nombre || 'Sin nombre',
            votos: parseFloat(x.votos)||0,
            originalIndex:i
        })).filter(x=>x.votos>0).sort((a,b)=>b.votos-a.votos);
        const total = items.reduce((a,x)=>a+x.votos,0);
        const colores=['#2d6a4f','#9c27b0','#1976d2','#f57c00','#00838f','#6d4c41','#7b1fa2','#455a64','#546e7a','#8e24aa'];
        const fmt = v => grafico.modalidad==='Por Coeficiente' ? Number(v).toFixed(4) : Number(v).toLocaleString('es-CO');
        if (!items.length || total<=0) return `<div class="grafico-votacion"><div class="grafico-titulo">📊 ${escapeHtml(titulo)}</div><p style="margin:8px 0;color:#666;">No se registraron votos suficientes para representar el gráfico.</p></div>`;

        const cx=120, cy=120, r=88, inner=48;
        let angulo=-Math.PI/2;
        let segmentos='';
        const leyenda=[];
        items.forEach((x,i)=>{
            const proporcion=x.votos/total;
            const sweep=proporcion*Math.PI*2;
            const fin=angulo+sweep;
            const x1=cx+r*Math.cos(angulo), y1=cy+r*Math.sin(angulo);
            const x2=cx+r*Math.cos(fin), y2=cy+r*Math.sin(fin);
            const ix1=cx+inner*Math.cos(angulo), iy1=cy+inner*Math.sin(angulo);
            const ix2=cx+inner*Math.cos(fin), iy2=cy+inner*Math.sin(fin);
            const grande=sweep>Math.PI?1:0;
            const color=colores[i%colores.length];
            if(items.length===1){
                segmentos += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
            }else{
                segmentos += `<path d="M ${ix1.toFixed(2)} ${iy1.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${grande} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${ix2.toFixed(2)} ${iy2.toFixed(2)} A ${inner} ${inner} 0 ${grande} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)} Z" fill="${color}" stroke="#fff" stroke-width="2"/>`;
            }
            // El propio gráfico contiene el valor y porcentaje de cada segmento cuando hay espacio suficiente.
            if(proporcion>=0.07){
                const medio=angulo+sweep/2;
                const tx=cx+(inner+(r-inner)*0.58)*Math.cos(medio);
                const ty=cy+(inner+(r-inner)*0.58)*Math.sin(medio);
                segmentos += `<text x="${tx.toFixed(2)}" y="${(ty-3).toFixed(2)}" text-anchor="middle" fill="#fff" font-size="13" font-weight="800">${escapeHtml(fmt(x.votos))}</text><text x="${tx.toFixed(2)}" y="${(ty+12).toFixed(2)}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">${(proporcion*100).toFixed(1)}%</text>`;
            }
            const marca=i===0 ? ' 🏆 MAYOR VOTACIÓN' : '';
            leyenda.push(`<div class="grafico-leyenda-item"><span class="grafico-numero">${i+1}</span><span class="grafico-color" style="background:${color};"></span><div style="flex:1;min-width:0;"><strong>${escapeHtml(x.nombre)}</strong>${marca}<div style="font-size:11px;color:#666;">${(proporcion*100).toFixed(1)}% del total</div></div><strong class="grafico-votos">${escapeHtml(fmt(x.votos))}</strong></div>`);
            angulo=fin;
        });
        const top=items[0];
        const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" role="img" aria-label="${escapeHtml(titulo)}" style="display:block;width:220px;height:220px;max-width:220px;"><circle cx="120" cy="120" r="43" fill="#fff"/><text x="120" y="113" text-anchor="middle" fill="#333" font-size="10" font-weight="700">MAYOR</text><text x="120" y="130" text-anchor="middle" fill="#2d6a4f" font-size="15" font-weight="900">${escapeHtml(fmt(top.votos))}</text><text x="120" y="145" text-anchor="middle" fill="#666" font-size="9">votos</text>${segmentos}</svg>`;
        return `<div class="grafico-votacion" style="page-break-inside:avoid;break-inside:avoid;">
            <div class="grafico-titulo">📊 ${escapeHtml(titulo)}</div>
            <div class="grafico-subtitulo">Resultado visual · ${escapeHtml(grafico.modalidad||'')} · Total: <strong>${escapeHtml(fmt(total))}</strong></div>
            ${grafico.quorumPorcentaje ? `<div class="grafico-subtitulo">⚖️ Quórum ${escapeHtml(grafico.quorumTipo||'deliberatorio')} · ${Number(grafico.quorumPorcentaje)}% de ${grafico.modalidad==='Por Coeficiente' ? Number(grafico.quorumBase||0).toFixed(4)+' coeficientes presentes' : (grafico.quorumAsistentes||0)+' asistentes presentes'} · Requerido: <strong>${grafico.modalidad==='Por Coeficiente' ? Number(grafico.quorumRequeridos||0).toFixed(4) : (grafico.quorumRequeridos||0)}</strong> · ${grafico.sumatoria ? `Sumatoria total: <strong>${grafico.modalidad==='Por Coeficiente' ? Number(grafico.quorumTotalVotos||0).toFixed(4) : Number(grafico.quorumTotalVotos||0)}</strong> · ${grafico.quorumAprobado?'✅ Quórum alcanzado':'⚠️ Quórum pendiente'}` : (grafico.quorumAprobado?'✅ Umbral alcanzado':'❌ Umbral no alcanzado')}</div>` : ''}
            <div class="grafico-cuerpo">
                <div class="grafico-svg">${svg}</div>
                <div class="grafico-leyenda">${leyenda.join('')}</div>
            </div>
            <div class="grafico-mayor"><strong>🏆 Mayor votación:</strong> ${escapeHtml(top.nombre)} · <strong>${escapeHtml(fmt(top.votos))} votos</strong> (${(top.votos/total*100).toFixed(1)}%)</div>
        </div>`;
    }

    // ==================== PERSISTENCIA ====================
    function normalizarEstadosAsamblea() {
        const base = (tipo='nominal') => ({ candidatos: [], abierta:false, tipoVoto:tipo, modoEntrada:'avanzado', votantes:[] });
        const defaults = {
            presidente: base(), secretario: base(), comite: Object.assign(base(), {seleccionMultiple:true, ganadoresRequeridos:3}),
            consejo: base(), convivencia: base(), revisorFiscal: base('manoAlzada')
        };
        Object.keys(defaults).forEach(k => { if (!votacionEstado[k]) votacionEstado[k] = defaults[k]; else votacionEstado[k] = Object.assign(defaults[k], votacionEstado[k]); });
        Object.keys(votacionEstado).forEach(k => {
            votacionEstado[k].duracionMinutos = parseInt(votacionEstado[k].duracionMinutos) || 5;
            normalizarQuorumVotacion(votacionEstado[k]);
            if (votacionEstado[k].tiempoFin && !votacionEstado[k].abierta) votacionEstado[k].tiempoFin = null;
        });
        ['ordenDia','actaAnterior','financieros'].forEach(k => {
            if (!votacionEstado[k]) votacionEstado[k] = Object.assign(base(), {opciones:[{nombre:'Sí',votosNominal:0,votosCoeficiente:0},{nombre:'No',votosNominal:0,votosCoeficiente:0}]});
            if (!Array.isArray(votacionEstado[k].opciones) || votacionEstado[k].opciones.length < 2) votacionEstado[k].opciones=[{nombre:'Sí',votosNominal:0,votosCoeficiente:0},{nombre:'No',votosNominal:0,votosCoeficiente:0}];
        });
        if (!votacionEstado.presupuesto) votacionEstado.presupuesto = Object.assign(base(), {opciones:[]});
        Object.keys(votacionEstado).forEach(k=>normalizarQuorumVotacion(votacionEstado[k]));
        if (!Array.isArray(archivosAsamblea)) archivosAsamblea=[];
        if (!Array.isArray(votacionesExtra)) votacionesExtra=[];
        // Auto-reparación: votaciones adicionales que existen pero se perdieron de la lista.
        Object.keys(votacionEstado).forEach(k=>{
            if (votacionesExtra.some(v=>v && v.key===k)) return;
            let m;
            if ((m = /^extra_(\d+)$/.exec(k))) votacionesExtra.push({ id:Number(m[1]), key:k, titulo:'Votación adicional (recuperada)' });
            else if ((m = /^punto_(\d+)$/.exec(k))) { const pt=(puntosOrdenDia||[]).find(x=>x.id===Number(m[1])); votacionesExtra.push({ id:Number(m[1]), key:k, titulo:pt?pt.texto:'Votación de punto agregado', puntoId:Number(m[1]) }); }
        });
        votacionesExtra.forEach(v=>{ if(v && v.key && !votacionEstado[v.key]) votacionEstado[v.key]=Object.assign(base('manoAlzada'), {opciones:Array.isArray(v.opciones)&&v.opciones.length?v.opciones:[{nombre:'Opción 1',votosNominal:0,votosCoeficiente:0,votosManoAlzada:0},{nombre:'Opción 2',votosNominal:0,votosCoeficiente:0,votosManoAlzada:0}], tipoVoto:'manoAlzada'}); else if(v && v.key){ if(!votacionEstado[v.key].tipoVoto) votacionEstado[v.key].tipoVoto='manoAlzada'; if(!Array.isArray(votacionEstado[v.key].opciones)||!votacionEstado[v.key].opciones.length) votacionEstado[v.key].opciones=[{nombre:'Opción 1',votosNominal:0,votosCoeficiente:0,votosManoAlzada:0},{nombre:'Opción 2',votosNominal:0,votosCoeficiente:0,votosManoAlzada:0}]; }});
        guardarDatos();
    }

    function guardarDatos() {
        localStorage.setItem('configConjunto', JSON.stringify(configConjunto));
        localStorage.setItem('unidades', JSON.stringify(unidades));
        localStorage.setItem('asistencia', JSON.stringify(asistencia));
        localStorage.setItem('votaciones', JSON.stringify(votaciones));
        localStorage.setItem('puntosOrdenDia', JSON.stringify(puntosOrdenDia));
        localStorage.setItem('contadorPuntos', contadorPuntos);
        localStorage.setItem('votacionEstado', JSON.stringify(votacionEstado));
        localStorage.setItem('archivosAsamblea', JSON.stringify(archivosAsamblea));
        localStorage.setItem('cierreAsamblea', JSON.stringify(cierreAsamblea));
        localStorage.setItem('votosQR', JSON.stringify(votosQR));
        localStorage.setItem('votacionApertura', JSON.stringify(votacionApertura));
        localStorage.setItem('votacionesExtra', JSON.stringify(votacionesExtra));
        try { if (window.AdminPHBridge) window.AdminPHBridge.kick(); } catch (e) { /* el puente es opcional */ }
    }

    function cargarDatos() {
        const sc = localStorage.getItem('configConjunto');
        if (sc) { try { configConjunto = JSON.parse(sc); } catch(e){} }
        const su = localStorage.getItem('unidades');
        if (su) { try { unidades = JSON.parse(su); } catch(e){} }
        const sa = localStorage.getItem('asistencia');
        if (sa) { try { asistencia = JSON.parse(sa); } catch(e){} }
        const sv = localStorage.getItem('votaciones');
        if (sv) { try { votaciones = JSON.parse(sv); } catch(e){} }
        const sp = localStorage.getItem('puntosOrdenDia');
        if (sp) { try { puntosOrdenDia = JSON.parse(sp); } catch(e){} }
        const scp = localStorage.getItem('contadorPuntos');
        if (scp) contadorPuntos = parseInt(scp) || 17;

        // Compatibilidad: si existe un orden del día anterior, insertar la aprobación
        // del orden del día después del secretario sin alterar los demás puntos.
        if (Array.isArray(puntosOrdenDia) && puntosOrdenDia.length > 0 &&
            !puntosOrdenDia.some(p => String(p.texto || '').toLowerCase().includes('aprobación del orden del día'))) {
            const idxSecretario = puntosOrdenDia.findIndex(p => p.modulo === 'secretario');
            if (idxSecretario !== -1) {
                const nuevo = { id: Date.now(), texto: 'Aprobación del orden del día', activo: true, completado: false, modulo: 'personalizado' };
                puntosOrdenDia.splice(idxSecretario + 1, 0, nuevo);
                contadorPuntos = Math.max(contadorPuntos, ...puntosOrdenDia.map(p => Number(p.id) || 0)) + 1;
                localStorage.setItem('puntosOrdenDia', JSON.stringify(puntosOrdenDia));
                localStorage.setItem('contadorPuntos', contadorPuntos);
            }
        }
        // Compatibilidad: agregar la votación adicional antes del cierre en asambleas ya existentes.
        if (Array.isArray(puntosOrdenDia) && !puntosOrdenDia.some(p=>p.modulo==='votacionesExtra')) {
            const idxCierre=puntosOrdenDia.findIndex(p=>p.modulo==='cierre');
            const nuevoExtra={id:Date.now()+1,texto:'Votaciones adicionales (fuera del orden del día)',activo:true,completado:false,modulo:'votacionesExtra',fueraOrdenDia:true};
            if(idxCierre>=0) puntosOrdenDia.splice(idxCierre,0,nuevoExtra); else puntosOrdenDia.push(nuevoExtra);
            contadorPuntos=Math.max(contadorPuntos,...puntosOrdenDia.map(p=>Number(p.id)||0))+1;
            localStorage.setItem('puntosOrdenDia',JSON.stringify(puntosOrdenDia));
            localStorage.setItem('contadorPuntos',contadorPuntos);
        }
        const sve = localStorage.getItem('votacionEstado');
        if (sve) { try { votacionEstado = JSON.parse(sve); } catch(e){} }
        // V3.2: la lista de votaciones adicionales debe leerse ANTES de normalizar (que guarda),
        // si no, cada recarga de la página borraba la lista y las votaciones quedaban "huérfanas".
        { const sveX0 = localStorage.getItem('votacionesExtra'); if (sveX0) { try { votacionesExtra = JSON.parse(sveX0) || []; } catch(e) { votacionesExtra = []; } } }
        const sae = localStorage.getItem('archivosAsamblea');
        if (sae) { try { archivosAsamblea = JSON.parse(sae) || []; } catch(e) { archivosAsamblea = []; } }
        const scierre = localStorage.getItem('cierreAsamblea');
        if (scierre) { try { cierreAsamblea = Object.assign({ registrado:false, fecha:'', hora:'', cerradoPor:'', reaperturaAutorizadaEn:'', reaperturaAutorizadaPor:'' }, JSON.parse(scierre)||{}); } catch(e){} }
        normalizarEstadosAsamblea();
        const svq = localStorage.getItem('votosQR');
        if (svq) { try { votosQR = JSON.parse(svq); } catch(e){ votosQR = { presidente: [], secretario: [] }; } }
        const sveX = localStorage.getItem('votacionesExtra');
        if (sveX) { try { votacionesExtra = JSON.parse(sveX) || []; } catch(e) { votacionesExtra = []; } }
        votacionesExtra.forEach(v=>{ if(v && v.key && !votacionEstado[v.key]) votacionEstado[v.key]={candidatos:[],abierta:false,tipoVoto:'manoAlzada',modoEntrada:'manual',votantes:[],tipoQuorum:'deliberatorio',porcentajeQuorum:50,opciones:[{nombre:'Opción 1',votosNominal:0,votosCoeficiente:0,votosManoAlzada:0},{nombre:'Opción 2',votosNominal:0,votosCoeficiente:0,votosManoAlzada:0}]}; else if(v && v.key){ if(!votacionEstado[v.key].tipoVoto) votacionEstado[v.key].tipoVoto='manoAlzada'; }});
        const sva = localStorage.getItem('votacionApertura');
        if (sva) { try { votacionApertura = JSON.parse(sva); } catch(e){ votacionApertura = { presidente: null, secretario: null }; } }
        let graficosFaltantes=false;
        Object.keys(votacionEstado).forEach(k=>{ const e=votacionEstado[k]; if(!e.abierta && !e.graficoResultado && (Array.isArray(e.opciones)||Array.isArray(e.candidatos))){ const esMano=e.tipoVoto==='manoAlzada', esCoef=e.tipoVoto==='coeficiente'; const items=(Array.isArray(e.opciones)&&e.opciones.length?e.opciones:e.candidatos||[]).map(x=>({nombre:x.nombre||'Sin nombre',votos:esMano?(x.votosManoAlzada||0):esCoef?(x.votosCoeficiente||0):(x.votosNominal||0)})); const q=resumenQuorumVotacion(e); e.graficoResultado={generadoEn:new Date().toISOString(),modalidad:esMano?'Mano Alzada':esCoef?'Por Coeficiente':'Nominal / QR',items,total:items.reduce((a,x)=>a+(parseFloat(x.votos)||0),0),quorumTipo:q.tipo,quorumPorcentaje:q.porcentaje,quorumBase:q.base,quorumAsistentes:q.asistentes,quorumRequeridos:q.votosRequeridos,quorumFavorables:q.favorables,quorumAprobado:q.aprobado}; graficosFaltantes=true; } });
        if(graficosFaltantes) guardarDatos();
    }

    // ==================== GENERACIÓN DE UNIDADES ====================
    function generarNombreUnidad(tipo, nivelNumero, unidadNumero, contadorSimple, prefijoPersonalizado, jerarquiaCompleta = {}) {
        const tipoInfo = TIPOS_UNIDAD.find(t => t.value === tipo) || TIPOS_UNIDAD[0];
        if (tipoInfo.formatoEspecial) {
            const prefijo = prefijoPersonalizado || tipoInfo.prefijo;
            return `${prefijo} ${contadorSimple}`;
        }
        let nombre = configConjunto.formatoUnidad || "{NIVEL}{UNIDAD}";
        const uf = String(unidadNumero).padStart(2, '0');
        nombre = nombre.replace(/{NIVEL}/g, nivelNumero);
        nombre = nombre.replace(/{UNIDAD}/g, uf);
        nombre = nombre.replace(/{TORRE}/g, jerarquiaCompleta.Torre || '');
        nombre = nombre.replace(/{BLOQUE}/g, jerarquiaCompleta.Bloque || '');
        nombre = nombre.replace(/{MANZANA}/g, jerarquiaCompleta.Manzana || '');
        nombre = nombre.replace(/{ETAPA}/g, jerarquiaCompleta.Etapa || '');
        return nombre;
    }

    function generarUnidades(tipoUnidad = "residencial", prefijoPersonalizado = null) {
        const nuevas = [];
        const nivelesActivos = configConjunto.niveles.filter(n => n.activo && n.cantidad > 0);
        const nivelUnidad = configConjunto.niveles.find(n => n.nombre === "Unidad");
        const upn = nivelUnidad?.activo ? nivelUnidad.cantidad : 1;
        const tipoInfo = TIPOS_UNIDAD.find(t => t.value === tipoUnidad) || TIPOS_UNIDAD[0];

        function crearUnidad(jerarquia, concatenado, tipo, idx) {
            const u = {
                id: (crypto.randomUUID ? crypto.randomUUID() : 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2)),
                numeroFila: unidades.length + nuevas.length + 1,
                jerarquia: jerarquia,
                concatenado: concatenado,
                tipo: tipo,
                propietario: "", numeroDocumento: "", telefono: "", correo: "",
                coeficiente: 1, coeficienteParqueadero: 0, coeficienteTotal: 1,
                sextoNivelValor: `${tipo}_${idx}`,
                haVotado: false, votos: {}
            };
            actualizarCoeficienteTotal(u);
            return u;
        }

        if (tipoInfo.formatoEspecial) {
            for (let i = 1; i <= upn; i++) {
                const nombre = generarNombreUnidad(tipoUnidad, 1, i, i, prefijoPersonalizado, {});
                nuevas.push(crearUnidad({ Unidad: i }, nombre, tipoUnidad, i));
            }
        } else if (nivelesActivos.length === 0 || (nivelesActivos.length === 1 && nivelesActivos[0].nombre === "Unidad")) {
            for (let u = 1; u <= upn; u++) {
                const nombre = generarNombreUnidad(tipoUnidad, 1, u, u, prefijoPersonalizado, {});
                nuevas.push(crearUnidad({ Unidad: u }, nombre, tipoUnidad, u));
            }
        } else {
            const nivelesSinUnidad = nivelesActivos.filter(n => n.nombre !== "Unidad");
            function combinar(indice, valores, jerarquiaActual) {
                if (indice >= nivelesSinUnidad.length) {
                    for (let u = 1; u <= upn; u++) {
                        const jerarquia = { ...jerarquiaActual, Unidad: u };
                        const partes = [];
                        for (let i = 0; i < nivelesSinUnidad.length; i++) {
                            const n = nivelesSinUnidad[i];
                            jerarquia[n.nombre] = valores[i];
                            partes.push(`${n.nombre} ${valores[i]}`);
                        }
                        const nombre = generarNombreUnidad(tipoUnidad, 1, u, null, prefijoPersonalizado, jerarquia);
                        partes.push(nombre);
                        nuevas.push(crearUnidad(jerarquia, partes.join(" - "), tipoUnidad, u));
                    }
                    return;
                }
                const nivel = nivelesSinUnidad[indice];
                for (let i = 1; i <= nivel.cantidad; i++) {
                    combinar(indice + 1, [...valores, i], { ...jerarquiaActual, [nivel.nombre]: i });
                }
            }
            combinar(0, [], {});
        }
        unidades.push(...nuevas);
        guardarDatos();
        return nuevas;
    }

    // ==================== QUÓRUM ====================
// ==================== CÁLCULO DE QUÓRUM POR COEFICIENTES ====================
// Ley 675/2001: El quórum se mide por coeficientes de copropiedad, no por unidades.
// El mínimo es 50% + 1 del total de coeficientes.
function quorumRequeridoActual() {
    const convocatoria = Number(configConjunto.convocatoriaActual || 1);
    const valor = convocatoria === 2 ? configConjunto.quorumSegundaPorcentaje : configConjunto.quorumPrimeraPorcentaje;
    return Number.isFinite(parseFloat(valor)) ? parseFloat(valor) : parseFloat(configConjunto.quorumPorcentaje || 50);
}

function etiquetaConvocatoriaActual() { return Number(configConjunto.convocatoriaActual||1) === 2 ? 'Segunda Asamblea' : 'Primera Asamblea'; }

function calcularQuorum() {
    const total = unidades.length;
    const totalCoeficientes = unidades.reduce((s, u) => s + (parseFloat(u.coeficienteTotal) || parseFloat(u.coeficiente) || 0), 0);

    // Sumar coeficientes SOLO de los presentes
    let coeficientesPresentes = 0;
    let unidadesPresentes = 0;
    for (const a of asistencia) {
        if (!a.presente) continue;
        const u = unidades.find(x => x.id === a.unidadId);
        if (!u) continue;
        coeficientesPresentes += (parseFloat(u.coeficienteTotal) || parseFloat(u.coeficiente) || 0);
        unidadesPresentes++;
    }

    const pctCoeficientes = totalCoeficientes > 0 ? (coeficientesPresentes / totalCoeficientes) * 100 : 0;
    const pctUnidades = total > 0 ? (unidadesPresentes / total) * 100 : 0;

    // Quórum mínimo requerido = 50% + 1
    // El "requerido" es el % configurado; el "+1" se aplica al comparar
    const requerido = quorumRequeridoActual();
    // Quórum alcanzado si el porcentaje de coeficientes supera el requerido (estrictamente mayor)
    const quorumOk = pctCoeficientes > requerido;

    return {
        total,                                  // total de unidades
        asistentes: unidadesPresentes,          // unidades presentes
        coeficientesPresentes,                  // suma de coeficientes presentes
        totalCoeficientes,                      // suma total de coeficientes (debe ser 100)
        pctAsistencia: pctCoeficientes,         // % por coeficientes (para quórum)
        pctUnidades: pctUnidades,               // % por unidades (informativo)
        quorumOk,
        requerido,                              // % requerido (ej. 50)
        // Faltante en coeficientes para alcanzar el quórum
        faltante: Math.max(0, ((requerido / 100) * totalCoeficientes) - coeficientesPresentes + 0.0001)
    };
}

    // ==================== VALIDACIÓN DE COEFICIENTES ====================
    function validarSumaCoeficientes() {
        const sumaTotal = unidades.reduce((sum, u) => sum + (parseFloat(u.coeficienteTotal) || 0), 0);
        const sumaRedondeada = Math.round(sumaTotal * 10000) / 10000;
        return {
            suma: sumaRedondeada,
            esValida: Math.abs(sumaRedondeada - 100) < 0.01,
            mensaje: Math.abs(sumaRedondeada - 100) < 0.01
                ? "✅ La suma de coeficientes es 100%"
                : `⚠️ La suma de coeficientes es ${sumaRedondeada.toFixed(4)}% (debe ser 100%)`
        };
    }

    // ==================== ASISTENTES ELEGIBLES (APODERADO TIENE PRIORIDAD) ====================
    function obtenerAsistentesElegibles() {
        // V3.8: un apoderado aparece UNA sola vez (con la suma de coeficientes y sus unidades),
        // sea que esté agrupado en Fase 2 → Apoderados o que solo coincida el documento/nombre.
        const elegibles = [];
        const grupos = {};
        for (const a of asistencia) {
            if (!a.presente) continue;
            const u = unidades.find(x => x.id === a.unidadId);
            if (!u) continue;
            const esApoderado = a.condicion === 'apoderado';
            const coef = parseFloat(u.coeficienteTotal) || parseFloat(u.coeficiente) || 1;
            const nombreAs = esApoderado ? (a.nombreAsistente || 'Apoderado') : (u.propietario || 'Sin nombre');
            const docAs = esApoderado ? (a.numeroDocumentoAsistente || '') : (u.numeroDocumento || '');
            let clave = null;
            const rep = infoRepresentacion(u.id);
            if (rep) clave = 'g:' + rep.grupo.id;
            else if (esApoderado) clave = 'a:' + (String(docAs).trim() || String(nombreAs).trim().toLowerCase());
            if (clave && grupos[clave]) {
                const g = grupos[clave];
                g.unidadIds.push(u.id); g.unidadesNombres.push(u.concatenado); g.coeficiente += coef;
                if (rep && String(rep.grupo.principalId) === String(u.id)) { g.unidadId = u.id; g.numeroFila = u.numeroFila; }
                continue;
            }
            const item = {
                unidadId: u.id,
                numeroFila: u.numeroFila,
                unidadNombre: u.concatenado,
                unidadIds: [u.id],
                unidadesNombres: [u.concatenado],
                coeficiente: coef,
                propietario: u.propietario || '',
                nombreAsistente: nombreAs,
                documentoAsistente: docAs,
                condicion: a.condicion
            };
            if (clave) grupos[clave] = item;
            elegibles.push(item);
        }
        elegibles.forEach(e => { if (e.unidadIds.length > 1) e.unidadNombre = e.unidadesNombres.join(', '); });
        return elegibles;
    }

    // ==================== URLs DE VOTACIÓN (QR) ====================
    function generarUrlVotacion(unidadId, unidadNumero) {
        const real = window.AdminPHBridge && window.AdminPHBridge.qrUrlFor(unidadId);
        if (real) return real;
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?votacion=${unidadId}&unidad=${unidadNumero}`;
    }

    window.mostrarQRIndividual = function(unidadId, unidadNombre, unidadNumero) {
        const url = generarUrlVotacion(unidadId, unidadNumero);
        const modal = document.getElementById('qrModal');
        const modalQr = document.getElementById('modalQrCode');
        modalQr.innerHTML = '';
        new QRCode(modalQr, { text: url, width: 250, height: 250 });
        document.getElementById('modalQrInfo').innerHTML = `
            <div style="background:#2d6a4f; color:white; padding:15px; border-radius:12px; margin-top:15px;">
                <h3 style="font-size:24px; margin-bottom:10px;">${escapeHtml(unidadNombre)}</h3>
                <p style="font-size:18px;">Unidad #${unidadNumero}</p>
            </div>
            ${esSoloConsulta() ? '<div class="summary-bar" style="margin-top:12px;font-size:12px;">👁️ Modo consulta: este código QR solo puede visualizarse porque el usuario no tiene permisos de exportación.</div>' : `<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px;">
                <button id="descargarQRIndividualBtn" class="btn-secondary">⬇️ Guardar imagen</button>
                <button id="descargarPDFIndividualBtn" class="btn-secondary">📄 Guardar PDF</button>
                <button id="compartirQRIndividualBtn" class="btn-primary">📤 Compartir</button>
            </div>`}`;
        modal.style.display = 'flex';
        if (esSoloConsulta()) return;
        document.getElementById('descargarQRIndividualBtn').onclick = () => {
            const canvas = modalQr.querySelector('canvas');
            const img = modalQr.querySelector('img');
            const data = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
            if (!data) { alert('No fue posible generar la imagen QR.'); return; }
            const a=document.createElement('a'); a.href=data; a.download=`QR_${unidadNombre.replace(/[^a-z0-9_-]+/gi,'_')}.png`; a.click();
        };
        document.getElementById('descargarPDFIndividualBtn').onclick = async () => {
            try {
                const blob = await generarPDFQRUnidad({id:unidadId, numero:unidadNumero, nombre:unidadNombre, propietario:buscarPropietarioUnidad(unidadId)});
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = nombreArchivoQR(unidadNumero, buscarPropietarioUnidad(unidadId));
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            } catch(e) {
                console.error(e);
                alert('❌ No fue posible generar el PDF de este código QR.');
            }
        };
        document.getElementById('compartirQRIndividualBtn').onclick = async () => {
            const canvas = modalQr.querySelector('canvas');
            const img = modalQr.querySelector('img');
            const data = canvas ? canvas.toDataURL('image/png') : (img ? img.src : null);
            if (!data) return;
            try {
                if (navigator.share) {
                    const blob = await (await fetch(data)).blob();
                    const file = new File([blob], `QR_${unidadNumero}.png`, {type:'image/png'});
                    if (!navigator.canShare || navigator.canShare({files:[file]})) {
                        await navigator.share({title:`QR ${unidadNombre}`,text:`Código QR de votación — ${unidadNombre} — Unidad #${unidadNumero}`,files:[file]});
                        return;
                    }
                    await navigator.share({title:`QR ${unidadNombre}`,text:`Código QR de votación — ${unidadNombre} — Unidad #${unidadNumero}\n${url}`});
                    return;
                }
            } catch(e) { if (e?.name === 'AbortError') return; }
            const wa=`https://wa.me/?text=${encodeURIComponent(`Código QR de votación — ${unidadNombre} — Unidad #${unidadNumero}\n${url}`)}`;
            window.open(wa,'_blank','noopener');
            alert('WhatsApp se abrió con el mensaje preparado. Adjunte la imagen QR guardada si el dispositivo no permite compartirla directamente.');
        };
    };

    // ==================== FASES ====================
    function cambiarFase(fase) {
        faseActual = fase;
        const ind = document.getElementById('faseIndicador');
        document.querySelectorAll('.fase-btn').forEach(btn => {
            btn.classList.remove('activo');
            if (parseInt(btn.dataset.fase) === fase) btn.classList.add('activo');
        });
        if (fase === 1) { ind.innerHTML = '📋 FASE 1: Preparación'; ind.style.background = 'rgba(255,152,0,0.9)'; renderFase1Menu(); }
        else if (fase === 2) { ind.innerHTML = '📱 FASE 2: Inicio Asamblea'; ind.style.background = 'rgba(33,150,243,0.9)'; renderFase2Menu(); }
        else if (fase === 3) { ind.innerHTML = '🎬 FASE 3: Desarrollo'; ind.style.background = 'rgba(76,175,80,0.9)'; renderFase3Menu(); }
        else if (fase === 4) { ind.innerHTML = '📋 Acta y Trazabilidad'; ind.style.background = 'rgba(156,39,176,0.9)'; renderFase4Menu(); }
        ubicarSubmenu();
    }

    function renderFase1Menu() {
    const menu = document.getElementById('navMenu');
    const puedePreparar = puedePrepararAsamblea();
    menu.innerHTML = `
        <button data-module="servidor" class="active">🔗 Servidor y Asamblea</button>
        <button data-module="config">🏗️ Configuración${!puedePreparar ? ' 🔒' : ''}</button>
        <button data-module="excel">📎 Carga Masiva Excel${!puedePreparar ? ' 🔒' : ''}</button>
        <button data-module="listado">📋 Listado de Unidades${!puedePreparar ? ' 🔒' : ''}</button>
        <button data-module="coeficientes">💰 Coeficientes${!puedePreparar ? ' 🔒' : ''}</button>
    `;
    menu.querySelectorAll('button[data-module]').forEach(btn => {
        btn.addEventListener('click', () => loadModule(btn.dataset.module));
    });
    loadModule('servidor');
}

    function renderFase2Menu() {
        const menu = document.getElementById('navMenu');
        const adminQR = puedeVerQRCompleto();
        menu.innerHTML = `
            ${adminQR ? '<button data-module="qr" class="active">📱 Códigos QR</button>' : ''}
            <button data-module="qrAsistentes" class="${adminQR ? '' : 'active'}">🟢 QR de asistentes</button>
            ${puedeExportarQRAasistentes() ? '<button data-module="enviarQR">📨 Enviar QR</button>' : ''}
            <button data-module="asistencia">✅ Toma de Asistencia</button>
            <button data-module="apoderados">🤝 Apoderados</button>
            <button data-module="votoManual">📥 Votación manual (Excel)</button>
            <button data-module="quorum">📊 Panel de Quórum</button>
            <button data-module="participacion">📐 Coef. de participación</button>
        `;
        menu.querySelectorAll('button[data-module]').forEach(btn => {
            btn.addEventListener('click', () => loadModule(btn.dataset.module));
        });
        loadModule(adminQR ? 'qr' : 'qrAsistentes');
    }

    function renderFase3Menu() {
        const menu = document.getElementById('navMenu');
        menu.innerHTML = `<button data-module="asamblea" class="active">🎬 Modo Asamblea</button><button data-module="votoManual">📥 Votación manual (Excel)</button>`;
        menu.querySelectorAll('button[data-module]').forEach(btn => {
            btn.addEventListener('click', () => loadModule(btn.dataset.module));
        });
        loadModule('asamblea');
    }

    function renderFase4Menu() {
    const menu = document.getElementById('navMenu');
    menu.innerHTML = `<button data-module="acta" class="active">📋 Acta y Trazabilidad</button>`;
    menu.querySelectorAll('button[data-module]').forEach(btn => {
        btn.addEventListener('click', () => loadModule(btn.dataset.module));
    });
    loadModule('acta');
}

    // ==================== MÓDULOS ====================
    function loadModule(module) {
        if (intervaloQRAasistentes && module !== 'qrAsistentes') { clearInterval(intervaloQRAasistentes); intervaloQRAasistentes = null; }
        // La Fase 1 es visible para consulta, pero solo Administrador/Super Administrador pueden modificarla.
        if (module === 'admin' && !puedeGestionarUsuarios()) {
            alert('🔒 Solo el Super Administrador puede administrar usuarios.');
            return;
        }
        if (module === 'qr' && !puedeVerQRCompleto()) {
            loadModule('qrAsistentes');
            return;
        }
        if (asambleaCerrada() && !asambleaEdicionAutorizada && !['acta','manual','quorum','servidor','inicio','reuniones','documentos','reportes','agenda','admin'].includes(module)) {
            document.querySelectorAll('.nav-menu button').forEach(b => b.classList.remove('active'));
            renderBloqueoAsamblea(module);
            return;
        }
        document.querySelectorAll('.nav-menu button').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.nav-menu button[data-module="${module}"]`);
        if (btn) btn.classList.add('active');
        marcarSidebar(module);
        if (module === 'inicio') renderInicioModule();
        else if (module === 'agenda' || module === 'reuniones') {
            const opc = { editar: !['usuario', 'invitado'].includes(rolActual()), usuario: (currentUser && (currentUser.name || currentUser.username)) || '' };
            if (window.AdminPHAgenda) { if (module === 'agenda') window.AdminPHAgenda.renderAgenda(document.getElementById('mainContent'), opc); else window.AdminPHAgenda.renderReuniones(document.getElementById('mainContent'), opc); }
            else renderAreaProximamente(module);
        }
        else if (['documentos', 'reportes'].includes(module)) renderAreaProximamente(module);
        else if (module === 'config') renderConfigModule();
        else if (module === 'servidor') renderServidorModule();
        else if (module === 'listado') renderListadoModule();
        else if (module === 'coeficientes') renderCoeficientesModule();
        else if (module === 'excel') renderExcelModule();
        else if (module === 'qr') renderQrModule();
        else if (module === 'qrAsistentes') renderQRAasistentesModule();
        else if (module === 'enviarQR') renderEnviarQRModule();
        else if (module === 'asistencia') renderAsistenciaModule();
        else if (module === 'apoderados') renderApoderadosModule();
        else if (module === 'votoManual') renderVotoManualModule();
        else if (module === 'quorum') renderQuorumModule();
        else if (module === 'participacion') renderParticipacionModule();
        else if (module === 'asamblea') renderModoAsamblea();
        else if (module === 'admin') renderAdminUsersModule();
        else if (module === 'manual') renderManualModule();
        else if (module === 'asamblea') renderModoAsamblea();
        else if (module === 'acta') renderActaModule();
    }

    // ==================== CONFIGURACIÓN ====================
    function renderConfigModule() {
        const content = document.getElementById('mainContent');
        const puedeEditar = ROLES[currentUser?.role]?.permissions?.canConfigStructure || false;
        if (!configConjunto.unidadesPorNivel) configConjunto.unidadesPorNivel = 4;

        content.innerHTML = `
            <div class="card"><h2>🏗️ Configuración de Unidades</h2><p>Defina la estructura jerárquica del conjunto</p></div>

            <div class="card"><h3>📋 Configuración de la Asamblea</h3>
                <div class="form-row">
                    <div class="form-group"><label>Nombre del Conjunto</label><input type="text" id="nombreConjunto" value="${escapeHtml(configConjunto.nombreConjunto)}" ${!puedeEditar ? 'disabled' : ''}></div>
                    <div class="form-group"><label>NIT de la Copropiedad</label><input type="text" id="nitConjunto" value="${escapeHtml(configConjunto.nit||'')}" placeholder="Ej: 900.123.456-7" ${!puedeEditar ? 'disabled' : ''}></div>
                    <div class="form-group"><label>Ciudad</label><input type="text" id="ciudadConjunto" value="${escapeHtml(configConjunto.ciudad||'')}" placeholder="Ej: Bogotá D.C." ${!puedeEditar ? 'disabled' : ''}></div>
                    <div class="form-group"><label>Dirección</label><input type="text" id="direccionConjunto" value="${escapeHtml(configConjunto.direccion||'')}" placeholder="Ej: Cra 10 #20-30" ${!puedeEditar ? 'disabled' : ''}></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Organización / marca del sistema</label><input type="text" id="organizacionNombre" value="${escapeHtml(configConjunto.organizacionNombre||'AdminPH')}" placeholder="Nombre de su organización" ${!puedeEditar ? 'disabled' : ''}></div>
                    <div class="form-group"><label>Teléfono de contacto</label><input type="text" id="organizacionTelefono" value="${escapeHtml(configConjunto.organizacionTelefono||'')}" placeholder="Teléfono" ${!puedeEditar ? 'disabled' : ''}></div>
                    <div class="form-group"><label>Correo de contacto</label><input type="email" id="organizacionCorreo" value="${escapeHtml(configConjunto.organizacionCorreo||'')}" placeholder="correo@organizacion.com" ${!puedeEditar ? 'disabled' : ''}></div>
                    <div class="form-group"><label>Sitio web</label><input type="text" id="organizacionWeb" value="${escapeHtml(configConjunto.organizacionWeb||'')}" placeholder="www.organizacion.com" ${!puedeEditar ? 'disabled' : ''}></div>
                </div>
                <div class="form-row"><div class="form-group"><label>Datos de contacto adicionales</label><input type="text" id="organizacionContacto" value="${escapeHtml(configConjunto.organizacionContacto||'')}" placeholder="Dirección, redes, etc." ${!puedeEditar ? 'disabled' : ''}></div></div>
                <div class="form-row">
                    <div class="form-group"><label>Nombre Administrador(a)</label><input type="text" id="administradorNombre" value="${escapeHtml(configConjunto.administradorNombre||'')}" placeholder="Nombre completo" ${!puedeEditar ? 'disabled' : ''}></div>
                    <div class="form-group"><label>Documento Administrador(a)</label><input type="text" id="administradorDocumento" value="${escapeHtml(configConjunto.administradorDocumento||'')}" placeholder="C.C. / NIT" ${!puedeEditar ? 'disabled' : ''}></div>
                    <div class="form-group"><label>Fecha de Reunión</label><input type="date" id="fechaReunion" value="${configConjunto.fechaReunion||''}" ${!puedeEditar ? 'disabled' : ''}></div>
                    <div class="form-group"><label>Hora de Inicio</label><input type="time" id="horaReunion" value="${configConjunto.horaReunion||''}" ${!puedeEditar ? 'disabled' : ''}></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Tipo de Reunión</label>
                        <select id="tipoReunion" ${!puedeEditar ? 'disabled' : ''}>
                            <option value="ordinaria" ${configConjunto.tipoReunion === 'ordinaria' ? 'selected' : ''}>Ordinaria</option>
                            <option value="extraordinaria" ${configConjunto.tipoReunion === 'extraordinaria' ? 'selected' : ''}>Extraordinaria</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Asamblea / convocatoria activa</label><select id="convocatoriaActual" ${!puedeEditar ? 'disabled' : ''}><option value="1" ${Number(configConjunto.convocatoriaActual||1)===1?'selected':''}>Primera Asamblea</option><option value="2" ${Number(configConjunto.convocatoriaActual||1)===2?'selected':''}>Segunda Asamblea</option></select></div>
                    <div class="form-group"><label>% Quórum Primera Asamblea</label><input type="number" id="quorumPrimeraPorcentaje" min="0" max="100" step="0.01" value="${configConjunto.quorumPrimeraPorcentaje ?? configConjunto.quorumPorcentaje ?? 50}" ${!puedeEditar ? 'disabled' : ''}></div>
                    <div class="form-group"><label>% Quórum Segunda Asamblea</label><input type="number" id="quorumSegundaPorcentaje" min="0" max="100" step="0.01" value="${configConjunto.quorumSegundaPorcentaje ?? 30}" ${!puedeEditar ? 'disabled' : ''}></div>
                </div>
                ${puedeEditar ? `<button id="guardarConfigBtn">💾 Guardar Configuración</button>` : ''}
            </div>

            <div class="card">
                <h3>🏢 Estructura jerárquica</h3>
                <p style="font-size:12px;color:#666;margin-bottom:15px;">Active los niveles que componen sus unidades residenciales y defina cuántos elementos existen en cada nivel.</p>
                <div id="nivelesContainer" class="form-row"></div>
            </div>

            <div class="card">
                <h3>🔢 Formato de las unidades</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label>Formato de unidad</label>
                        <select id="formatoUnidadSelect" ${!puedeEditar ? 'disabled' : ''}>
                            <option value="{NIVEL}{UNIDAD}" ${configConjunto.formatoUnidad === '{NIVEL}{UNIDAD}' ? 'selected' : ''}>{NIVEL}{UNIDAD} → 101, 102...</option>
                            <option value="{NIVEL}-{UNIDAD}" ${configConjunto.formatoUnidad === '{NIVEL}-{UNIDAD}' ? 'selected' : ''}>{NIVEL}-{UNIDAD} → 1-01, 1-02...</option>
                            <option value="Apto {NIVEL}{UNIDAD}" ${configConjunto.formatoUnidad === 'Apto {NIVEL}{UNIDAD}' ? 'selected' : ''}>Apto {NIVEL}{UNIDAD}</option>
                            <option value="CUSTOM" ${!['{NIVEL}{UNIDAD}','{NIVEL}-{UNIDAD}','Apto {NIVEL}{UNIDAD}'].includes(configConjunto.formatoUnidad) ? 'selected' : ''}>Personalizado</option>
                        </select>
                    </div>
                    <div class="form-group" id="formatoCustomGroup" style="display:${!['{NIVEL}{UNIDAD}','{NIVEL}-{UNIDAD}','Apto {NIVEL}{UNIDAD}'].includes(configConjunto.formatoUnidad) ? 'block' : 'none'};">
                        <label>Formato personalizado</label>
                        <input id="formatoUnidadCustom" type="text" value="${escapeHtml(configConjunto.formatoUnidad||'{NIVEL}{UNIDAD}')}" placeholder="{NIVEL}{UNIDAD}" ${!puedeEditar ? 'disabled' : ''}>
                    </div>
                </div>
                <div id="ejemploFormato" style="margin:12px 0;padding:10px;background:#f1f5f9;border-radius:8px;"></div>
            </div>

            <div class="card">
                <h3>⚙️ Generar unidades residenciales</h3>
                <p style="font-size:12px;color:#666;margin-bottom:15px;">Use la estructura anterior para crear automáticamente las unidades. Los datos se conservan en el navegador.</p>
                <div class="form-row">
                    <div class="form-group">
                        <label>Tipo de unidad</label>
                        <select id="tipoUnidadGenerar" ${!puedeEditar ? 'disabled' : ''}>
                            ${TIPOS_UNIDAD.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Prefijo personalizado (opcional)</label>
                        <input id="prefijoPersonalizado" type="text" placeholder="Ej.: Casa, Local, P" ${!puedeEditar ? 'disabled' : ''}>
                    </div>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
                    ${puedeEditar ? `<button id="generarUnidadesBtn" type="button">➕ Generar unidades</button>` : ''}
                    ${puedeEditar ? `<button id="resetUnidadesBtn" type="button" class="btn-danger">♻️ Eliminar todas las unidades</button>` : ''}
                </div>
                <div style="margin-top:15px;padding:10px;background:#eef5ee;border-radius:8px;font-size:12px;">Unidades actuales: <strong>${unidades.length}</strong></div>
            </div>
        `;

        { const cr = document.createElement('div'); cr.innerHTML = htmlCargaRapida(); content.prepend(cr); activarCargaRapida(cr); }
        // Niveles
        const nc = document.getElementById('nivelesContainer');
        configConjunto.niveles.forEach((nivel, idx) => {
            const div = document.createElement('div');
            div.className = 'form-group';
            div.style.cssText = 'border:1px solid #e0e8e0;padding:12px;border-radius:12px;min-width:120px;';
            div.innerHTML = `
                <label><input type="checkbox" id="nivelActivo_${idx}" ${nivel.activo ? 'checked' : ''} ${!puedeEditar ? 'disabled' : ''}> <strong>${nivel.nombre}</strong></label>
                <input type="number" id="nivelCantidad_${idx}" value="${nivel.cantidad}" min="0" ${!nivel.activo ? 'disabled' : ''} placeholder="Cantidad" ${!puedeEditar ? 'disabled' : ''}>
                <input type="text" id="nivelNombre_${idx}" value="${nivel.nombre}" style="margin-top:8px;" ${!puedeEditar ? 'disabled' : ''}>
            `;
            nc.appendChild(div);
        });
        if (puedeEditar) {
            for (let i = 0; i < configConjunto.niveles.length; i++) {
                const chk = document.getElementById(`nivelActivo_${i}`);
                const cant = document.getElementById(`nivelCantidad_${i}`);
                const nom = document.getElementById(`nivelNombre_${i}`);
                chk.onchange = () => { cant.disabled = !chk.checked; if(!chk.checked) cant.value=0; configConjunto.niveles[i].activo = chk.checked; guardarDatos(); };
                cant.onchange = () => { configConjunto.niveles[i].cantidad = parseInt(cant.value)||0; guardarDatos(); };
                nom.onchange = () => { configConjunto.niveles[i].nombre = nom.value; guardarDatos(); };
            }
        }

        // Formato
        const fs = document.getElementById('formatoUnidadSelect');
        const fc = document.getElementById('formatoUnidadCustom');
        const fcg = document.getElementById('formatoCustomGroup');
        const ej = document.getElementById('ejemploFormato');
        function actualizarPrev() {
            const fmt = fs.value === 'CUSTOM' ? (fc.value || '{NIVEL}{UNIDAD}') : fs.value;
            ej.textContent = generarEjemploFormato(fmt);
        }
        fs.onchange = () => {
            if (fs.value === 'CUSTOM') { fcg.style.display = 'block'; if(!fc.value) fc.value = configConjunto.formatoUnidad; }
            else { fcg.style.display = 'none'; fc.value = fs.value; configConjunto.formatoUnidad = fs.value; guardarDatos(); }
            actualizarPrev();
        };
        fc.oninput = () => { if (fs.value === 'CUSTOM') { configConjunto.formatoUnidad = fc.value; guardarDatos(); actualizarPrev(); } };

        document.getElementById('guardarConfigBtn')?.addEventListener('click', () => {
    configConjunto.nombreConjunto = document.getElementById('nombreConjunto').value;
    configConjunto.nit = document.getElementById('nitConjunto').value;
    configConjunto.organizacionNombre = document.getElementById('organizacionNombre')?.value || configConjunto.organizacionNombre || 'AdminPH';
    configConjunto.organizacionTelefono = document.getElementById('organizacionTelefono')?.value || '';
    configConjunto.organizacionCorreo = document.getElementById('organizacionCorreo')?.value || '';
    configConjunto.organizacionWeb = document.getElementById('organizacionWeb')?.value || '';
    configConjunto.organizacionContacto = document.getElementById('organizacionContacto')?.value || '';
    configConjunto.ciudad = document.getElementById('ciudadConjunto').value;
    configConjunto.direccion = document.getElementById('direccionConjunto').value;
    configConjunto.administradorNombre = document.getElementById('administradorNombre').value;
    configConjunto.administradorDocumento = document.getElementById('administradorDocumento').value;
    configConjunto.fechaReunion = document.getElementById('fechaReunion').value;
    configConjunto.horaReunion = document.getElementById('horaReunion').value;
    configConjunto.tipoReunion = document.getElementById('tipoReunion').value;
    configConjunto.convocatoriaActual = parseInt(document.getElementById('convocatoriaActual')?.value || '1',10);
    configConjunto.quorumPrimeraPorcentaje = parseFloat(document.getElementById('quorumPrimeraPorcentaje')?.value || '50');
    configConjunto.quorumSegundaPorcentaje = parseFloat(document.getElementById('quorumSegundaPorcentaje')?.value || '30');
    configConjunto.quorumPorcentaje = quorumRequeridoActual(); // compatibilidad con datos anteriores
    if (fs.value !== 'CUSTOM') configConjunto.formatoUnidad = fs.value;
    else configConjunto.formatoUnidad = fc.value;
    guardarDatos();
    alert("✅ Configuración guardada");
});

        document.getElementById('generarUnidadesBtn')?.addEventListener('click', () => {
            for(let i=0; i<configConjunto.niveles.length; i++) {
                const chk = document.getElementById(`nivelActivo_${i}`);
                const cant = document.getElementById(`nivelCantidad_${i}`);
                const nom = document.getElementById(`nivelNombre_${i}`);
                if(chk) configConjunto.niveles[i].activo = chk.checked;
                if(cant) configConjunto.niveles[i].cantidad = parseInt(cant.value)||0;
                if(nom) configConjunto.niveles[i].nombre = nom.value;
            }
            if (fs.value !== 'CUSTOM') configConjunto.formatoUnidad = fs.value;
            else configConjunto.formatoUnidad = fc.value;
            const tipo = document.getElementById('tipoUnidadGenerar').value;
            const prefijo = document.getElementById('prefijoPersonalizado').value || null;
            const nuevas = generarUnidades(tipo, prefijo);
            alert(`✅ Se agregaron ${nuevas.length} unidades. Total: ${unidades.length}`);
            renderConfigModule();
        });

        document.getElementById('resetUnidadesBtn')?.addEventListener('click', () => {
            if(confirm("¿Eliminar TODAS las unidades? Se borrará también la asistencia.")) {
                unidades = []; asistencia = [];
                guardarDatos(); renderConfigModule();
            }
        });
    }

    // ==================== LISTADO ====================
    function renderListadoModule() {
        const content = document.getElementById('mainContent');
        const permisos = ROLES[currentUser?.role]?.permissions || {};
        const puedeEditar = puedePrepararAsamblea();
        const nivelesActivos = configConjunto.niveles.filter(n => n.activo && n.cantidad > 0);
        const sextoValores = [...new Set(unidades.map(u => u.sextoNivelValor))];
        const colorMap = {};
        sextoValores.forEach((v,i) => colorMap[v] = (i % 8) + 1);

        content.innerHTML = `<div class="card"><h2>📋 Listado de Unidades</h2><div class="summary-bar"><span>🏢 ${escapeHtml(configConjunto.nombreConjunto)}</span><span>📊 Total: ${unidades.length}</span></div><div id="listadoTable" class="table-wrapper"></div></div>`;

        const container = document.getElementById('listadoTable');
        if(unidades.length === 0) { container.innerHTML = '<p style="padding:40px; text-align:center;">⚠️ No hay unidades. Vaya a Configuración.</p>'; return; }

        let columnas = ['#'];
        for (const nivel of nivelesActivos) columnas.push(nivel.nombre);
        columnas.push('Unidad', 'Tipo', 'N° Doc', 'Propietario', 'Correo', 'Teléfono', 'Coef.', 'Coef.Parq.', 'Coef.Total');
        if (puedeEditar) columnas.push('Acciones');

        let html = `<table class="data-table"><thead><tr>`;
        for (const col of columnas) html += `<th>${col}</th>`;
        html += `</tr></thead><tbody>`;

        unidades.forEach(u => {
            const color = `color-${colorMap[u.sextoNivelValor] || 1}`;
            const tipoInfo = TIPOS_UNIDAD.find(t => t.value === u.tipo) || TIPOS_UNIDAD[0];
            html += `<tr class="${color}">`;
            html += `<td style="text-align:center;font-weight:bold;">${u.numeroFila}</td>`;
            for (const nivel of nivelesActivos) html += `<td>${u.jerarquia[nivel.nombre] || ''}</td>`;
            html += `<td style="min-width:200px;word-break:break-word;"><strong>${escapeHtml(u.concatenado)}</strong></td>`;
            html += `<td style="text-align:center;"><span class="badge ${tipoInfo.class}">${tipoInfo.label}</span></td>`;
            if (puedeEditar) {
                html += `<td><input type="text" data-id="${u.id}" data-field="numeroDocumento" value="${escapeHtml(u.numeroDocumento||'')}" style="width:100px;"></td>`;
                html += `<td><input type="text" data-id="${u.id}" data-field="propietario" value="${escapeHtml(u.propietario||'')}" style="width:160px;"></td>`;
                html += `<td><input type="email" data-id="${u.id}" data-field="correo" value="${escapeHtml(u.correo||'')}" style="width:140px;"></td>`;
                html += `<td><input type="text" data-id="${u.id}" data-field="telefono" value="${escapeHtml(u.telefono||'')}" style="width:100px;"></td>`;
                html += `<td><input type="number" step="0.0001" data-id="${u.id}" data-field="coeficiente" value="${u.coeficiente||0}" style="width:60px;"></td>`;
                html += `<td><input type="number" step="0.0001" data-id="${u.id}" data-field="coeficienteParqueadero" value="${u.coeficienteParqueadero||0}" style="width:60px;"></td>`;
            } else {
                html += `<td>${u.numeroDocumento||'-'}</td><td>${u.propietario||'-'}</td><td>${u.correo||'-'}</td><td>${u.telefono||'-'}</td><td>${u.coeficiente||0}</td><td>${u.coeficienteParqueadero||0}</td>`;
            }
            html += `<td><strong>${(u.coeficienteTotal||0).toFixed(4)}</strong></td>`;
            if (puedeEditar) html += `<td style="text-align:center;"><button onclick="eliminarUnidad('${u.id}')" class="btn-danger" style="padding:4px 8px;">🗑️</button></td>`;
            html += `</tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;

        window.eliminarUnidad = function(id) {
            if (puedePrepararAsamblea()) {
                if (confirm("¿Eliminar esta unidad?")) {
                    unidades = unidades.filter(u => u.id !== id);
                    unidades.forEach((u, idx) => u.numeroFila = idx + 1);
                    guardarDatos(); renderListadoModule();
                }
            }
        };

        if (puedeEditar) {
            document.querySelectorAll('input[data-id]').forEach(inp => {
                inp.onchange = () => {
                    const u = unidades.find(x => x.id === inp.dataset.id);
                    if(u) {
                        const field = inp.dataset.field;
                        let val = inp.value;
                        if (field === 'coeficiente' || field === 'coeficienteParqueadero') val = parseFloat(val) || 0;
                        u[field] = val;
                        if (field === 'coeficiente' || field === 'coeficienteParqueadero') actualizarCoeficienteTotal(u);
                        guardarDatos();
                    }
                };
            });
        }
    }

    // ==================== MÓDULO COEFICIENTES ====================
    function renderCoeficientesModule() {
        const content = document.getElementById('mainContent');
        const puedeEditar = puedePrepararAsamblea();
        const validacion = validarSumaCoeficientes();

        const totalCoef = unidades.reduce((s,u) => s + (u.coeficiente||0), 0);
        const totalParq = unidades.reduce((s,u) => s + (u.coeficienteParqueadero||0), 0);
        const hayParqueaderos = totalParq > 0;

        content.innerHTML = `
            <div class="card">
                <h2>💰 Gestión de Coeficientes de Copropiedad</h2>
                <p>La suma de coeficientes debe ser exactamente <strong>100%</strong>. El coeficiente total = coeficiente de unidad + coeficiente de parqueadero (si aplica).</p>
            </div>

            <div class="card">
                <h3>📊 Estado de los Coeficientes</h3>
                <div class="summary-bar ${validacion.esValida ? 'ok' : 'alerta'}">
                    <strong>${validacion.mensaje}</strong>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Suma Coeficientes Unidad</label><input type="text" value="${totalCoef.toFixed(4)}%" readonly style="background:#f0f5f0;text-align:center;font-weight:bold;"></div>
                    <div class="form-group"><label>Suma Coef. Parqueaderos</label><input type="text" value="${totalParq.toFixed(4)}%" readonly style="background:#f0f5f0;text-align:center;font-weight:bold;"></div>
                    <div class="form-group"><label>SUMA TOTAL</label><input type="text" value="${validacion.suma.toFixed(4)}%" readonly style="background:${validacion.esValida ? '#c8e6c9' : '#ffcdd2'};text-align:center;font-weight:bold;font-size:18px;"></div>
                </div>
                <p style="font-size:12px;color:#666;margin-top:10px;">💡 Si hay parqueaderos con coeficiente, su suma se incluye en el cálculo del 100%.</p>
            </div>

            <div class="card">
                <h3>🅿️ Gestión de Coeficientes de Parqueaderos</h3>
                <p>${hayParqueaderos ? '✅ Se detectaron coeficientes de parqueadero en el sistema.' : '⚠️ No hay coeficientes de parqueadero asignados actualmente.'}</p>
                <div class="form-row">
                    <button id="btnAsignarParq" class="btn-warning" ${!puedeEditar ? 'disabled' : ''}>🅿️ Asignar coeficiente de parqueadero a todas las unidades</button>
                    <button id="btnLimpiarParq" class="btn-danger" ${!puedeEditar || !hayParqueaderos ? 'disabled' : ''}>🗑️ Limpiar coeficientes de parqueadero</button>
                </div>
                <p style="font-size:12px;color:#666;margin-top:10px;">💡 Útil para conjuntos donde los parqueaderos tienen coeficiente propio. Se puede editar individualmente en el Listado.</p>
            </div>

            <div class="card">
                <h3>📋 Detalle por Unidad</h3>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>#</th><th>Unidad</th><th>Coef. Unidad</th><th>Coef. Parqueadero</th><th>Coef. Total</th>${puedeEditar ? '<th>Editar Coef.Parq.</th>' : ''}</tr></thead>
                        <tbody>
                            ${unidades.map(u => `
                                <tr>
                                    <td>${u.numeroFila}</td>
                                    <td>${escapeHtml(u.concatenado)}</td>
                                    <td>${(u.coeficiente||0).toFixed(4)}</td>
                                    <td>${(u.coeficienteParqueadero||0).toFixed(4)}</td>
                                    <td><strong>${(u.coeficienteTotal||0).toFixed(4)}</strong></td>
                                    ${puedeEditar ? `<td><input type="number" step="0.0001" value="${u.coeficienteParqueadero||0}" data-id="${u.id}" class="input-parq" style="width:80px;"></td>` : ''}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.getElementById('btnAsignarParq')?.addEventListener('click', () => {
            const valor = parseFloat(prompt("Ingrese el coeficiente de parqueadero a asignar a TODAS las unidades (ej: 0.5):", "0.5"));
            if (!isNaN(valor)) {
                unidades.forEach(u => { u.coeficienteParqueadero = valor; actualizarCoeficienteTotal(u); });
                guardarDatos();
                alert(`✅ Coeficiente de parqueadero ${valor} asignado a ${unidades.length} unidades.`);
                renderCoeficientesModule();
            }
        });

        document.getElementById('btnLimpiarParq')?.addEventListener('click', () => {
            if (confirm("¿Limpiar coeficientes de parqueadero de todas las unidades?")) {
                unidades.forEach(u => { u.coeficienteParqueadero = 0; actualizarCoeficienteTotal(u); });
                guardarDatos();
                renderCoeficientesModule();
            }
        });

        document.querySelectorAll('.input-parq').forEach(inp => {
            inp.onchange = () => {
                const u = unidades.find(x => x.id === inp.dataset.id);
                if (u) {
                    u.coeficienteParqueadero = parseFloat(inp.value) || 0;
                    actualizarCoeficienteTotal(u);
                    guardarDatos();
                    renderCoeficientesModule();
                }
            };
        });
    }

    // ==================== EXCEL ====================
    function renderExcelModule() {
        const content = document.getElementById('mainContent');
        const puedeEditar = puedePrepararAsamblea();

        content.innerHTML = `
            <div class="card"><h2>📎 Carga Masiva por Excel</h2><p>Actualice datos usando el número de fila como referencia</p></div>
            <div class="card"><h3>📤 Subir Archivo</h3>
                <div class="form-row">
                    <input type="file" id="excelUpload" accept=".xlsx,.xls,.csv" ${!puedeEditar ? 'disabled' : ''}>
                    ${puedeEditar ? `<button id="importarExcelBtn">📊 Importar</button>` : ''}
                    <button id="descargarPlantillaBtn" class="btn-secondary">📥 Descargar Plantilla</button>
                </div>
                <div id="importResult" style="margin-top:15px;"></div>
            </div>
            <div class="card"><h3>📋 Formato</h3>
                <div class="table-wrapper"><table class="data-table">
                    <thead><tr><th>FILA</th><th>NUMERO_DOCUMENTO</th><th>PROPIETARIO</th><th>CORREO</th><th>TELEFONO</th><th>COEFICIENTE</th><th>COEF_PARQUEADERO</th></tr></thead>
                    <tbody>
                        <tr><td>1</td><td>12345678</td><td>Juan Pérez</td><td>juan@mail.com</td><td>3001234567</td><td>1.5</td><td>0.2</td></tr>
                    </tbody>
                </table></div>
            </div>
        `;

        { const cr = document.createElement('div'); cr.innerHTML = htmlCargaRapida(); content.prepend(cr); activarCargaRapida(cr); }
        document.getElementById('importarExcelBtn')?.addEventListener('click', () => {
            const file = document.getElementById('excelUpload').files[0];
            if(!file) { alert("Seleccione un archivo"); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet);
                let imp = 0, noEnc = 0;
                for (const row of rows) {
                    const numFila = parseInt(row.FILA || row.fila || row.NUMERO || row.numero);
                    if (!numFila || isNaN(numFila)) continue;
                    const u = unidades.find(x => x.numeroFila === numFila);
                    if (u) {
                        if (row.NUMERO_DOCUMENTO || row.numero_documento || row.CEDULA || row.cedula) u.numeroDocumento = String(row.NUMERO_DOCUMENTO || row.numero_documento || row.CEDULA || row.cedula);
                        if (row.PROPIETARIO || row.propietario) u.propietario = String(row.PROPIETARIO || row.propietario);
                        if (row.CORREO || row.correo) u.correo = String(row.CORREO || row.correo);
                        if (row.TELEFONO || row.telefono) u.telefono = String(row.TELEFONO || row.telefono);
                        if (row.COEFICIENTE || row.coeficiente) u.coeficiente = parseFloat(row.COEFICIENTE || row.coeficiente) || 0;
                        if (row.COEF_PARQUEADERO || row.coef_parqueadero) u.coeficienteParqueadero = parseFloat(row.COEF_PARQUEADERO || row.coef_parqueadero) || 0;
                        actualizarCoeficienteTotal(u);
                        imp++;
                    } else noEnc++;
                }
                guardarDatos();
                document.getElementById('importResult').innerHTML = `<div class="summary-bar ok">✅ Importados: ${imp} | ⚠️ No encontrados: ${noEnc}</div>`;
            };
            reader.readAsArrayBuffer(file);
        });

        document.getElementById('descargarPlantillaBtn')?.addEventListener('click', () => {
            const data = [["FILA","NUMERO_DOCUMENTO","PROPIETARIO","CORREO","TELEFONO","COEFICIENTE","COEF_PARQUEADERO"]];
            if (unidades.length > 0) {
                unidades.forEach(u => data.push([u.numeroFila, u.numeroDocumento||"", u.propietario||"", u.correo||"", u.telefono||"", u.coeficiente||1, u.coeficienteParqueadero||0]));
            } else {
                for (let i=1; i<=10; i++) data.push([i, "", "", "", "", "1.0", "0"]);
            }
            const ws = XLSX.utils.aoa_to_sheet(data);
            ws['!cols'] = [{wch:8},{wch:15},{wch:30},{wch:25},{wch:15},{wch:12},{wch:15}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "CARGA_UNIDADES");
            XLSX.writeFile(wb, "carga_unidades.xlsx");
        });
    }

    // ==================== QR ====================
    function renderQrModule() {
        if (!puedeVerQRCompleto()) { renderQRAasistentesModule(); return; }
        const content = document.getElementById('mainContent');
        const esPropietario = currentUser?.role === 'usuario';

        if (esPropietario) {
            const ud = unidades.find(u => u.numeroFila === currentUser?.unidadAsignada);
            if (!ud) {
                content.innerHTML = `<div class="card"><h2>📱 Su Código QR</h2><p>⚠️ No tiene una unidad asignada.</p></div>`;
                return;
            }
            content.innerHTML = `
                <div class="card" style="text-align:center;">
                    <h2>📱 Su Código QR de Votación</h2>
                    <div id="qrPropietarioUnico" style="display:flex;justify-content:center;margin:20px 0;"></div>
                    <div style="background:#2d6a4f;color:white;padding:15px;border-radius:12px;">
                        <p style="font-size:20px;"><strong>${escapeHtml(ud.concatenado)}</strong></p>
                        <p>${escapeHtml(ud.propietario||'No registrado')}</p>
                    </div>
                    <button onclick="window.print()" class="btn-secondary" style="margin-top:15px;">🖨️ Imprimir</button>
                </div>`;
            new QRCode(document.getElementById('qrPropietarioUnico'), { text: generarUrlVotacion(ud.id, ud.numeroFila), width: 200, height: 200 });
            return;
        }

        const nivelesActivos = configConjunto.niveles.filter(n => n.activo && n.cantidad > 0);
        const nivelAgrupacion = nivelesActivos.length > 0 ? nivelesActivos[0].nombre : 'Unidad';
        const grupos = {};
        unidades.forEach(u => {
            const clave = nivelAgrupacion === 'Unidad' && unidades.length > 40 ? 'Todas las unidades' : (u.jerarquia[nivelAgrupacion] || 'Sin grupo');
            if (!grupos[clave]) grupos[clave] = [];
            grupos[clave].push(u);
        });

        let gruposHtml = '';
        for (const [grupo] of Object.entries(grupos)) {
            gruposHtml += `<div class="card"><h3>${/^(todas|sin grupo)/i.test(String(grupo)) || String(grupo).toLowerCase().startsWith(String(nivelAgrupacion).toLowerCase()) ? escapeHtml(String(grupo)) : escapeHtml(nivelAgrupacion + ' ' + grupo)}</h3><div class="qr-grid" id="qrGrid_${grupo.replace(/\s/g,'')}"></div></div>`;
        }

        content.innerHTML = `
            <div class="card">
                <h2>📱 Códigos QR por Unidad</h2>
                <p>Genere e imprima los códigos antes de la reunión para entregarlos a cada unidad.</p>
                <div class="form-row" style="align-items:end;">
                    <div class="form-group" style="max-width:220px;">
                        <label>QR por hoja</label>
                        <select id="qrPorHojaSelect">
                            <option value="4">4 códigos por hoja</option>
                            <option value="6" selected>6 códigos por hoja</option>
                            <option value="8">8 códigos por hoja</option>
                        </select>
                    </div>
                    <button id="imprimirTodosQRBtn" class="btn-primary">📄 Generar PDF de QR</button>
                    <button id="imprimirNavegadorQRBtn" class="btn-secondary">🖨️ Vista de impresión</button>
                    <button id="exportarTodosQRPdfBtn" class="btn-primary">📂 Exportar QR individuales a carpeta</button>
                    <button id="compartirQRListaBtn" class="btn-secondary">📤 Opciones de envío remoto</button>
                </div>
                <div class="summary-bar" style="font-size:12px;margin-top:10px;">
                    💡 <strong>Impresión:</strong> puede elegir 4, 6 u 8 QR por hoja. Para reuniones remotas, el envío masivo de imágenes por WhatsApp o correo requiere una plataforma de mensajería/correo; desde el navegador se puede compartir un QR individual.
                </div>
            </div>${gruposHtml}`;

        document.getElementById('imprimirTodosQRBtn')?.addEventListener('click', () => generarPDFTodosQR(unidades, parseInt(document.getElementById('qrPorHojaSelect').value)||6));
        document.getElementById('imprimirNavegadorQRBtn')?.addEventListener('click', () => imprimirQRS(unidades, parseInt(document.getElementById('qrPorHojaSelect').value)||6));
        document.getElementById('exportarTodosQRPdfBtn')?.addEventListener('click', exportarTodosQRPdfACarpeta);
        document.getElementById('compartirQRListaBtn')?.addEventListener('click', () => {
            alert('📤 ENVÍO REMOTO DE QR\n\nEn esta versión puede compartir cada QR individual como imagen desde el dispositivo. Para envío masivo real por WhatsApp o correo, la siguiente fase debe conectar AdminPH con un servicio de mensajería/correo y usar los teléfonos/correos registrados de cada unidad.');
        });
        setTimeout(() => {
            for (const [grupo, arr] of Object.entries(grupos)) {
                const gc = document.getElementById(`qrGrid_${grupo.replace(/\s/g,'')}`);
                if (!gc) continue;
                gc.innerHTML = '';
                arr.forEach(u => {
                    const card = document.createElement('div');
                    card.className = 'qr-card';
                    card.onclick = () => mostrarQRIndividual(u.id, u.concatenado, u.numeroFila);
                    card.innerHTML = `<div id="qr_preview_${u.id}" style="display:flex;justify-content:center;"></div>
                        <p style="font-size:14px;font-weight:bold;">${escapeHtml(u.concatenado)}</p>
                        <p style="font-size:11px;">Unidad #${u.numeroFila}</p>`;
                    gc.appendChild(card);
                    new QRCode(document.getElementById(`qr_preview_${u.id}`), { text: generarUrlVotacion(u.id, u.numeroFila), width: 100, height: 100 });
                });
            }
        }, 100);
    }

    // ==================== QR DE ASISTENTES ====================
    function obtenerUnidadesPresentesConQR() {
        const presentes = asistencia.filter(a => a && a.presente === true);
        return presentes.map(a => {
            const u = unidades.find(x => String(x.id) === String(a.unidadId));
            if (!u) return null;
            const rep = infoRepresentacion(u.id);
            if (rep && rep.tipo === 'representada') return null;   // vota con el QR de su apoderado
            let nombreMostrar = (u.concatenado || `Unidad ${u.numeroFila}`).trim();
            let propietario = String(u.propietario || a.nombreAsistente || '').trim();
            if (rep && rep.tipo === 'principal') { nombreMostrar += ` + ${rep.grupo.unidadIds.length - 1} unidades`; propietario = `${rep.grupo.nombre} (apoderado)`; }
            return { ...u, nombre: nombreMostrar, propietario, url: generarUrlVotacion(u.id, u.numeroFila), qrReal: !!(window.AdminPHBridge && window.AdminPHBridge.qrUrlFor(u.id)) };
        }).filter(Boolean);
    }

    function firmaListaQRAasistentes(lista) {
        return lista.map(u => `${u.id}|${u.numeroFila}|${u.propietario || ''}|${u.url || ''}`).join('||') + '##' + (window.AdminPHBridge ? window.AdminPHBridge.status().text : '');
    }

    function renderQRAasistentesModule() {
        const content = document.getElementById('mainContent');
        if (!puedeVerQRAasistentes()) {
            content.innerHTML = '<div class="card"><div class="summary-bar alerta"><strong>🔒 Acceso restringido</strong></div></div>';
            return;
        }
        const esConsulta = ['usuario','invitado'].includes(rolActual());
        const presentes = obtenerUnidadesPresentesConQR();
        const porDefecto = 6;
        const firma = firmaListaQRAasistentes(presentes);
        firmaQRAasistentes = firma;
        content.innerHTML = `
            <div class="card">
                <h2>🟢 Códigos QR de asistentes</h2>
                <p>Este módulo muestra exclusivamente las unidades registradas como <strong>presentes</strong> en la toma de asistencia.</p>
                <div class="summary-bar ok"><strong>Asistentes con QR disponible: ${presentes.length}</strong> · Los QR de unidades ausentes no se muestran en este módulo.</div>
                ${puenteAvisoQR(presentes)}
                ${esConsulta ? '<div class="summary-bar" style="font-size:12px;">👁️ Modo consulta: puede visualizar únicamente los QR de las unidades presentes.</div>' : `
                <div class="form-row" style="align-items:end;">
                    <div class="form-group" style="max-width:220px;">
                        <label>QR por hoja</label>
                        <select id="qrAsistPorHoja"><option value="4">4 códigos por hoja</option><option value="6" selected>6 códigos por hoja</option><option value="8">8 códigos por hoja</option></select>
                    </div>
                    <button id="imprimirQRAssistBtn" class="btn-primary">📄 Generar PDF de asistentes</button>
                    <button id="imprimirQRAssistNavegadorBtn" class="btn-secondary">🖨️ Vista de impresión</button>
                    <button id="exportarQRAssistBtn" class="btn-primary">📂 Exportar PDF individuales</button>
                </div>`}
            </div>
            <div class="card"><h3>👥 QR habilitados para votar</h3><div id="qrAsistentesGrid" class="qr-grid"></div></div>
        `;
        const grid = document.getElementById('qrAsistentesGrid');
        if (!presentes.length) {
            grid.innerHTML = '<div class="summary-bar alerta">⏳ Aún no hay asistentes registrados. Al marcar una unidad como presente, su QR aparecerá automáticamente aquí.</div>';
        } else {
            presentes.forEach(u => {
                const card=document.createElement('div'); card.className='qr-card';
                card.innerHTML=`<div id="qr_assist_${u.id}" style="display:flex;justify-content:center;"></div><p style="font-size:14px;font-weight:bold;">${escapeHtml(u.nombre)}</p><p style="font-size:12px;">${escapeHtml(u.propietario || 'Sin propietario')}</p><p style="font-size:11px;">Unidad #${escapeHtml(u.numeroFila)}</p>`;
                card.onclick=()=>mostrarQRIndividual(u.id,u.nombre,u.numeroFila);
                grid.appendChild(card);
                new QRCode(card.firstElementChild, {text:u.url,width:110,height:110});
            });
        }
        if (!esConsulta) {
            document.getElementById('imprimirQRAssistBtn')?.addEventListener('click',()=>generarPDFTodosQR(obtenerUnidadesPresentesConQR(),parseInt(document.getElementById('qrAsistPorHoja').value)||porDefecto));
            document.getElementById('imprimirQRAssistNavegadorBtn')?.addEventListener('click',()=>imprimirQRS(obtenerUnidadesPresentesConQR(),parseInt(document.getElementById('qrAsistPorHoja').value)||porDefecto));
            document.getElementById('exportarQRAssistBtn')?.addEventListener('click',()=>exportarTodosQRPdfACarpeta(obtenerUnidadesPresentesConQR(),'exportarQRAssistBtn','QR_Asistentes'));
        }
        if (intervaloQRAasistentes) clearInterval(intervaloQRAasistentes);
        intervaloQRAasistentes=setInterval(()=>{
            if (faseActual!==2) return;
            const actual=obtenerUnidadesPresentesConQR(); const nueva=firmaListaQRAasistentes(actual);
            if(nueva!==firmaQRAasistentes && document.getElementById('qrAsistentesGrid')) renderQRAasistentesModule();
        },1500);
    }


    // ============ V3.4 · ENVIAR QR POR CORREO Y WHATSAPP ============
    function leerQrEnvios() { try { return JSON.parse(localStorage.getItem('qrEnvios') || '{}') || {}; } catch (_) { return {}; } }
    function marcarQrEnvio(unidadId, canal) {
        const e = leerQrEnvios(); e[unidadId] = e[unidadId] || {}; e[unidadId][canal] = new Date().toISOString();
        try { localStorage.setItem('qrEnvios', JSON.stringify(e)); } catch (_) { /* nada */ }
    }
    function telefonoWhatsApp(tel, pref) {
        let d = String(tel || '').replace(/\D/g, '');
        if (!d) return '';
        d = d.replace(/^00/, '');
        pref = String(pref || '57').replace(/\D/g, '');
        if (pref.length < 1 || pref.length > 3) pref = '57';   // el indicativo de país tiene 1 a 3 dígitos
        if (d.length === 10) d = pref + d;                       // celular colombiano sin indicativo
        else if (d.length < 10 || d.length > 15) return '';
        return d;
    }
    function qrPngDataUrl(texto) {
        return new Promise((resolve, reject) => {
            try {
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed;left:-9999px;top:0;';
                document.body.appendChild(host);
                new QRCode(host, { text: texto, width: 300, height: 300, correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : undefined });
                setTimeout(() => {
                    const cv = host.querySelector('canvas');
                    let url = cv ? cv.toDataURL('image/png') : '';
                    if (!url) { const im = host.querySelector('img'); url = im && im.src && im.src.startsWith('data:image/png') ? im.src : ''; }
                    host.remove();
                    url ? resolve(url) : reject(new Error('No se pudo generar la imagen del QR'));
                }, 60);
            } catch (e) { reject(e); }
        });
    }
    function mensajeWhatsAppQR(u) {
        const B = window.AdminPHBridge;
        const asm = (B && B.state().assemblyName) || '';
        return `Hola${u.propietario ? ' ' + u.propietario : ''}. Este es su enlace personal para votar${asm ? ' en la asamblea "' + asm + '"' : ' en la asamblea'} de ${configConjunto.nombreConjunto || 'su conjunto'} (${u.nombre}):\n${u.url}\n\nEs personal e intransferible, no lo reenvíe. Ábralo desde su celular.`;
    }

    async function renderEnviarQRModule() {
        const content = document.getElementById('mainContent');
        if (!puedeExportarQRAasistentes()) { content.innerHTML = '<div class="card"><div class="summary-bar alerta"><strong>🔒 Acceso restringido</strong></div></div>'; return; }
        const B = window.AdminPHBridge;
        const admin = esAdministrador();
        const conServidor = !!(B && B.isConnected() && B.state().assemblyId);
        const baseInfo = B && B.qrBaseInfo ? B.qrBaseInfo() : { unusable: true };
        let estadoCorreo = null;
        if (conServidor) { try { estadoCorreo = await apiRequest('/notifications/status'); } catch (_) { estadoCorreo = null; } }
        let alcance = 'asistentes';
        let tokensTodos = null; // unit_id(servidor) -> token, solo para el alcance "todos" (admin)
        async function prepararTodos() {
            try {
                const aid = encodeURIComponent(B.state().assemblyId);
                await apiRequest(`/assemblies/${aid}/qr-tokens/provision`, { method: 'POST', body: JSON.stringify({}) });
                const lista = await apiRequest(`/assemblies/${aid}/qr-tokens`);
                tokensTodos = {};
                (lista || []).forEach(q => { if (q.unit_id && q.token && !tokensTodos[q.unit_id]) tokensTodos[q.unit_id] = q.token; });
            } catch (e) { tokensTodos = null; alert('No se pudieron preparar los QR de todas las unidades: ' + (e.message || e)); alcance = 'asistentes'; }
        }
        function urlQr(u) {
            const real = (B && B.qrUrlFor) ? B.qrUrlFor(u.id) : null;
            if (real) return real;
            if (alcance === 'todos' && tokensTodos && B) {
                const t = tokensTodos[B.state().unitMap[String(u.id)]];
                if (t) { const pub = B.getPublicBase(); const x = pub ? new URL(pub) : new URL(location.pathname, location.origin); x.searchParams.set('voteToken', t); return x.toString(); }
            }
            return null;
        }
        let prefijo = localStorage.getItem('adminph_wa_prefijo') || '57'; if (!/^\d{1,3}$/.test(prefijo)) prefijo = '57';

        function filas() {
            const presentesIds = new Set(asistencia.filter(a => a && a.presente === true).map(a => String(a.unidadId)));
            const lista = (alcance === 'asistentes' || !admin) ? unidades.filter(u => presentesIds.has(String(u.id))) : unidades.slice();
            // V3.6: una fila por persona (propietario principal + copropietarios); todos reciben el mismo QR de la unidad.
            return lista.flatMap(u => {
                const rep = infoRepresentacion(u.id);
                if (rep && rep.tipo === 'representada') return [];   // un solo QR para el apoderado
                const url = urlQr(u);
                if (rep && rep.tipo === 'principal') {
                    const g = rep.grupo;
                    return [{ ...u, unitLocalId: u.id, esCopropietario: false, nombre: `${(u.concatenado || '').trim()} + ${g.unidadIds.length - 1} unidades`, propietario: `${g.nombre} (apoderado)`, correo: String(g.correo || '').trim(), telefono: String(g.telefono || '').trim(), url, presente: presentesIds.has(String(u.id)) }];
                }
                const personas = [{ nombre: u.propietario, correo: u.correo, telefono: u.telefono }].concat(Array.isArray(u.copropietarios) ? u.copropietarios : []);
                return personas.map((p, k) => ({ ...u, id: k === 0 ? u.id : `${u.id}#${k}`, unitLocalId: u.id, esCopropietario: k > 0, nombre: (u.concatenado || `Unidad ${u.numeroFila}`).trim(), propietario: String(p.nombre || '').trim(), correo: String(p.correo || '').trim(), telefono: String(p.telefono || '').trim(), url, presente: presentesIds.has(String(u.id)) }));
            });
        }

        function pintar() {
            const rows = filas();
            const env = leerQrEnvios();
            const avisos = [];
            if (!conServidor) avisos.push('⚠️ Falta conectar el servidor y elegir la asamblea en <strong>Fase 1 → 🔗 Servidor y Asamblea</strong>. Sin eso los QR no son válidos.');
            else if (baseInfo.unusable) avisos.push('⚠️ Falta la <strong>dirección pública</strong> (la de trycloudflare o su dominio) en el panel de QR. Sin ella los enlaces enviados no abrirían en los celulares.');
            if (conServidor && estadoCorreo && !estadoCorreo.configured) avisos.push('✉️ El <strong>correo aún no está configurado</strong> en el servidor (archivo .env, claves MAIL_). WhatsApp sí funciona.');
            if (conServidor && !estadoCorreo) avisos.push('✉️ No se pudo consultar el estado del correo del servidor.');
            const puedeCorreo = conServidor && !baseInfo.unusable && estadoCorreo && estadoCorreo.configured;
            content.innerHTML = `
            <div class="card">
                <h2>📨 Enviar QR por correo y WhatsApp</h2>
                <p>Cada propietario recibe <strong>su propio QR</strong> usando el correo y teléfono registrados en la tabla de unidades.</p>
                ${avisos.map(a => `<div class="summary-bar alerta">${a}</div>`).join('')}
                ${admin ? `<div class="form-row" style="align-items:end;">
                    <div class="form-group" style="max-width:320px;"><label>¿A quiénes?</label>
                        <select id="envAlcance"><option value="asistentes" ${alcance==='asistentes'?'selected':''}>Solo asistentes (presentes)</option><option value="todos" ${alcance==='todos'?'selected':''}>Todas las unidades</option></select></div>
                    <div class="form-group" style="max-width:140px;"><label>Indicativo WhatsApp</label><input id="envPref" value="${escapeHtml(prefijo)}"></div>
                </div>` : `<div class="summary-bar ok">Como operador solo puede enviar los QR de las unidades <strong>presentes</strong>.</div>
                <div class="form-group" style="max-width:160px;"><label>Indicativo WhatsApp</label><input id="envPref" value="${escapeHtml(prefijo)}"></div>`}
                ${alcance==='todos' ? '<div class="summary-bar" style="font-size:12px;">ℹ️ Los QR de unidades que aún no están presentes quedan habilitados para votar solo cuando se registre su asistencia.</div>' : ''}
                <div class="form-row" style="align-items:center;gap:8px;flex-wrap:wrap;">
                    <button id="envSelTodos" class="btn-secondary">☑️ Marcar todos con correo</button>
                    <button id="envSelNinguno" class="btn-secondary">⬜ Quitar marcas</button>
                    <button id="envEnviarCorreo" class="btn-primary" ${puedeCorreo?'':'disabled'}>✉️ Enviar correo a los marcados</button>
                    <button id="envSigWA" class="btn-primary" style="background:#16a34a;">💬 WhatsApp: siguiente pendiente</button>
                </div>
                <div id="envProgreso" class="summary-bar" style="display:none;margin-top:8px;"></div>
            </div>
            <div class="card"><h3>👥 Destinatarios (${rows.length})</h3>
                <div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:13px;">
                <thead><tr><th></th><th>Unidad</th><th>Propietario</th><th>Correo</th><th>Teléfono</th><th>Asistencia</th><th>Enviado</th><th>Enviar</th></tr></thead>
                <tbody>${rows.map(u => {
                    const e = env[u.id] || {};
                    const wa = telefonoWhatsApp(u.telefono, prefijo);
                    const tieneCorreo = !!(u.correo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.correo));
                    return `<tr>
                        <td><input type="checkbox" class="envChk" data-id="${escapeHtml(String(u.id))}" ${(tieneCorreo && u.url) ? '' : 'disabled'}></td>
                        <td>${escapeHtml(u.nombre)}</td><td>${escapeHtml(u.propietario || '-')}${u.esCopropietario ? ' <small style="color:#6b7280;">(copropietario)</small>' : ''}</td>
                        <td>${tieneCorreo ? escapeHtml(u.correo) : '<span style="color:#b91c1c;">sin correo</span>'}</td>
                        <td>${wa ? escapeHtml(u.telefono) : '<span style="color:#b91c1c;">sin teléfono válido</span>'}</td>
                        <td>${u.presente ? '🟢 Presente' : '⚪ Ausente'}</td>
                        <td style="font-size:11px;">${e.correo ? '✉️ ' + new Date(e.correo).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}) : ''} ${e.whatsapp ? '💬 ' + new Date(e.whatsapp).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}) : ''}</td>
                        <td style="white-space:nowrap;">
                            <button class="btn-secondary envUnoCorreo" data-id="${escapeHtml(String(u.id))}" ${(puedeCorreo && tieneCorreo && u.url)?'':'disabled'}>✉️</button>
                            <button class="btn-secondary envUnoWA" data-id="${escapeHtml(String(u.id))}" ${(wa && u.url && !baseInfo.unusable)?'':'disabled'} style="color:#16a34a;">💬</button>
                        </td></tr>`;
                }).join('') || '<tr><td colspan="8">No hay unidades para mostrar. Registre asistencia en “Toma de Asistencia”.</td></tr>'}</tbody></table></div>
                <p style="font-size:12px;color:#6b7280;">💬 WhatsApp abre la conversación con el mensaje listo; usted solo toca “Enviar”. WhatsApp no permite enviar automáticamente sin la plataforma de pago (WhatsApp Business API).</p>
            </div>`;

            const porId = id => rows.find(r => String(r.id) === String(id));
            document.getElementById('envAlcance')?.addEventListener('change', async e => { alcance = e.target.value; if (alcance === 'todos' && conServidor) await prepararTodos(); pintar(); });
            document.getElementById('envPref')?.addEventListener('change', e => { prefijo = e.target.value.replace(/\D/g, ''); if (prefijo.length < 1 || prefijo.length > 3) { prefijo = '57'; alert('El indicativo del país va solo con 1 a 3 dígitos (Colombia: 57). Se restableció a 57.'); } try { localStorage.setItem('adminph_wa_prefijo', prefijo); } catch (_) {} pintar(); });
            document.getElementById('envSelTodos').onclick = () => content.querySelectorAll('.envChk:not(:disabled)').forEach(c => c.checked = true);
            document.getElementById('envSelNinguno').onclick = () => content.querySelectorAll('.envChk').forEach(c => c.checked = false);
            const abrirWA = (u) => {
                const n = telefonoWhatsApp(u.telefono, prefijo);
                if (!n || !u.url) return false;
                window.open(`https://wa.me/${n}?text=${encodeURIComponent(mensajeWhatsAppQR(u))}`, '_blank', 'noopener');
                marcarQrEnvio(u.id, 'whatsapp');
                return true;
            };
            content.querySelectorAll('.envUnoWA').forEach(b => b.onclick = () => { const u = porId(b.dataset.id); if (u && abrirWA(u)) pintar(); });
            document.getElementById('envSigWA').onclick = () => {
                const e = leerQrEnvios();
                const u = rows.find(r => !(e[r.id] && e[r.id].whatsapp) && telefonoWhatsApp(r.telefono, prefijo) && r.url);
                if (!u) { alert('✅ No quedan unidades pendientes de WhatsApp en esta lista.'); return; }
                abrirWA(u); pintar();
            };
            const enviarCorreos = async (ids) => {
                const prog = document.getElementById('envProgreso');
                prog.style.display = 'block';
                const lista = ids.map(porId).filter(Boolean);
                if (!lista.length) { prog.textContent = 'Marque al menos una unidad con correo.'; return; }
                if (!confirm(`¿Enviar el QR por correo a ${lista.length} unidad(es)?`)) { prog.style.display = 'none'; return; }
                let ok = 0; const fallos = [];
                const lote = 5;
                for (let i = 0; i < lista.length; i += lote) {
                    prog.textContent = `Enviando… ${Math.min(i, lista.length)} de ${lista.length}`;
                    const tanda = lista.slice(i, i + lote);
                    try {
                        const recipients = [];
                        for (const u of tanda) {
                            recipients.push({ unitId: B.state().unitMap[String(u.unitLocalId || u.id)], email: u.correo.trim(), unitLabel: u.nombre, ownerName: u.propietario, png: await qrPngDataUrl(u.url), _local: u.id });
                        }
                        const r = await apiRequest(`/assemblies/${encodeURIComponent(B.state().assemblyId)}/qr-notify/email`, {
                            method: 'POST',
                            body: JSON.stringify({
                                scope: alcance, baseUrl: B.getPublicBase() || (location.origin + location.pathname),
                                conjuntoNombre: configConjunto.nombreConjunto || '', asambleaNombre: B.state().assemblyName || '',
                                recipients: recipients.map(({ _local, ...x }) => x)
                            })
                        });
                        (r.results || []).forEach((x, k) => {
                            const loc = recipients.find(q => String(q.unitId) === String(x.unitId) && String(q.email).toLowerCase() === String(x.email || '').toLowerCase()) || recipients.find(q => String(q.unitId) === String(x.unitId)) || recipients[k];
                            if (x.ok) { ok++; if (loc) marcarQrEnvio(loc._local, 'correo'); }
                            else fallos.push(`${(loc && loc.unitLabel) || x.unitLabel || ''} (${x.email}): ${x.error}`);
                        });
                    } catch (err) { tanda.forEach(u => fallos.push(`${u.nombre}: ${err.message || err}`)); }
                }
                pintar();
                const p2 = document.getElementById('envProgreso'); p2.style.display = 'block';
                p2.className = 'summary-bar ' + (fallos.length ? 'alerta' : 'ok');
                p2.innerHTML = `✉️ Enviados: <strong>${ok}</strong> · Con problema: <strong>${fallos.length}</strong>${fallos.length ? '<br><small>' + fallos.map(escapeHtml).join('<br>') + '</small>' : ''}`;
            };
            document.getElementById('envEnviarCorreo').onclick = () => enviarCorreos([...content.querySelectorAll('.envChk:checked')].map(c => c.dataset.id));
            content.querySelectorAll('.envUnoCorreo').forEach(b => b.onclick = () => enviarCorreos([b.dataset.id]));
        }
        pintar();
    }
    // ============ fin V3.4 ============

    function imprimirQRS(listaUnidades, porHoja) {
        const arr = Array.isArray(listaUnidades) ? listaUnidades : [];
        if (!arr.length) { alert('No hay unidades para imprimir.'); return; }
        porHoja = [4,6,8].includes(porHoja) ? porHoja : 6;
        const cols = 2;
        const filasGrid = Math.ceil(porHoja / cols);
        const qrSize = porHoja === 4 ? 155 : porHoja === 6 ? 130 : 105;
        const win = window.open('', '_blank');
        if (!win) { alert('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para AdminPH.'); return; }
        const filas = arr.map(u => ({id:u.id, nombre:u.concatenado||`Unidad ${u.numeroFila}`, numero:u.numeroFila, propietario:u.propietario||'', url:generarUrlVotacion(u.id,u.numeroFila)}));
        const paginas=[];
        for(let i=0;i<filas.length;i+=porHoja) paginas.push(filas.slice(i,i+porHoja));
        const filasCss = `repeat(${filasGrid}, 1fr)`;
        win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>QR AdminPH</title><style>
            @page{size:letter portrait;margin:0}
            *{box-sizing:border-box}
            html,body{margin:0;padding:0;background:#fff;color:#222;font-family:Arial,sans-serif}
            .pagina{position:relative;width:215.9mm;height:279.4mm;padding:13mm 11mm 11mm;display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:${filasCss};gap:6mm 7mm;page-break-after:always;overflow:hidden}
            .pagina:last-child{page-break-after:auto}
            .cabecera{position:absolute;top:5mm;left:11mm;right:11mm;text-align:center;font-size:9px;color:#666;line-height:1.2}
            .qr-item{border:1px solid #bbb;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:4mm;min-height:0;overflow:hidden}
            .qr-box{width:${qrSize}px;height:${qrSize}px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
            .qr-box canvas,.qr-box img{width:${qrSize}px;height:${qrSize}px;display:block}
            .unidad{font-size:${porHoja===8?'15px':'17px'};font-weight:700;margin-top:4px;line-height:1.15}
            .propietario{font-size:10px;color:#333;margin-top:3px;line-height:1.15;max-width:90%;overflow:hidden}
            .numero{font-size:9px;color:#666;margin-top:2px}
            @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
        </style></head><body>`);
        paginas.forEach((grupo,pi)=>{ win.document.write(`<section class="pagina"><div class="cabecera">AdminPH · Códigos QR de votación · Hoja ${pi+1} de ${paginas.length}</div>`); grupo.forEach((u,j)=>{win.document.write(`<div class="qr-item"><div class="qr-box" id="qr_${pi}_${j}"></div><div class="unidad">${escapeHtml(u.nombre)}</div>${u.propietario?`<div class="propietario">${escapeHtml(u.propietario)}</div>`:''}<div class="numero">Unidad #${escapeHtml(u.numero)}</div></div>`);}); win.document.write('</section>'); });
        win.document.write('</body></html>'); win.document.close();
        setTimeout(()=>{
            paginas.forEach((grupo,pi)=>grupo.forEach((u,j)=>new QRCode(win.document.getElementById(`qr_${pi}_${j}`),{text:u.url,width:qrSize,height:qrSize})));
            setTimeout(()=>win.print(),500);
        },200);
    }

    function buscarPropietarioUnidad(unidadId) {
        const u = unidades.find(x => String(x.id) === String(unidadId));
        return u ? String(u.propietario || '').trim() : '';
    }

    function nombreArchivoQR(numero, propietario) {
        const limpio = String(propietario || 'Sin propietario').trim()
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
            .replace(/\s+/g, ' ')
            .replace(/[. ]+$/g, '');
        return `${String(numero)} - ${limpio || 'Sin propietario'}.pdf`;
    }

    function obtenerCanvasQR(texto, tamano=520) {
        return new Promise((resolve, reject) => {
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;overflow:hidden;';
            document.body.appendChild(host);
            try {
                new QRCode(host, { text: texto, width: tamano, height: tamano });
                setTimeout(() => {
                    const canvas = host.querySelector('canvas');
                    const img = host.querySelector('img');
                    if (canvas) { resolve(canvas); host.remove(); return; }
                    if (img && img.complete) {
                        const c = document.createElement('canvas'); c.width=tamano; c.height=tamano;
                        const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,tamano,tamano); resolve(c); host.remove(); return;
                    }
                    reject(new Error('No se pudo obtener la imagen del QR.')); host.remove();
                }, 40);
            } catch(e) { host.remove(); reject(e); }
        });
    }

    function dibujarTextoAjustado(ctx, texto, x, y, maxWidth, lineHeight, maxLines=2) {
        const palabras = String(texto || '').split(/\s+/).filter(Boolean);
        if (!palabras.length) return y;
        let linea=''; let lineas=[];
        for (const palabra of palabras) {
            const prueba = linea ? `${linea} ${palabra}` : palabra;
            if (ctx.measureText(prueba).width <= maxWidth) linea=prueba;
            else { if (linea) lineas.push(linea); linea=palabra; }
        }
        if (linea) lineas.push(linea);
        if (lineas.length > maxLines) {
            lineas=lineas.slice(0,maxLines);
            let ultima=lineas[maxLines-1];
            while (ctx.measureText(ultima+'…').width > maxWidth && ultima.length>1) ultima=ultima.slice(0,-1);
            lineas[maxLines-1]=ultima+'…';
        }
        lineas.forEach((l,i)=>ctx.fillText(l,x,y+i*lineHeight));
        return y + lineas.length*lineHeight;
    }

    function crearPDFDesdeJPEG(jpegDataUrl, anchoPx, altoPx) {
        const base64 = jpegDataUrl.split(',')[1] || '';
        const bin = atob(base64);
        const imgBytes = new Uint8Array(bin.length);
        for(let i=0;i<bin.length;i++) imgBytes[i]=bin.charCodeAt(i);
        const enc = new TextEncoder();
        const objetos = [];
        objetos[1] = enc.encode('<< /Type /Catalog /Pages 2 0 R >>');
        objetos[2] = enc.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
        objetos[3] = enc.encode('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>');
        const imgHead = enc.encode(`<< /Type /XObject /Subtype /Image /Width ${anchoPx} /Height ${altoPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`);
        const imgTail = enc.encode('\nendstream');
        const imgObj = new Uint8Array(imgHead.length + imgBytes.length + imgTail.length); imgObj.set(imgHead,0); imgObj.set(imgBytes,imgHead.length); imgObj.set(imgTail,imgHead.length+imgBytes.length); objetos[4]=imgObj;
        const contenidoPDF = 'q\n612 0 0 792 0 0 cm\n/Im1 Do\nQ\n';
        objetos[5] = enc.encode(`<< /Length ${enc.encode(contenidoPDF).length} >>\nstream\n${contenidoPDF}endstream`);
        const chunks=[]; const header=enc.encode('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n'); chunks.push(header); let offset=header.length; const offsets=[0];
        for(let i=1;i<=5;i++){ offsets[i]=offset; const oh=enc.encode(`${i} 0 obj\n`); const ot=enc.encode('\nendobj\n'); chunks.push(oh,objetos[i],ot); offset+=oh.length+objetos[i].length+ot.length; }
        const xrefOffset=offset; let xref=`xref\n0 6\n0000000000 65535 f \n`; for(let i=1;i<=5;i++) xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
        const trailer=`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
        chunks.push(enc.encode(xref+trailer));
        return new Blob(chunks,{type:'application/pdf'});
    }

    async function generarPDFQRUnidad(u) {
        const qrCanvas = await obtenerCanvasQR(generarUrlVotacion(u.id,u.numero), 520);
        const W=1275, H=1650;
        const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
        ctx.fillStyle='#2d6a4f'; ctx.textAlign='center'; ctx.font='bold 42px Arial'; ctx.fillText('AdminPH',W/2,95);
        ctx.fillStyle='#555'; ctx.font='24px Arial'; ctx.fillText('Código QR de votación',W/2,140);
        ctx.strokeStyle='#2d6a4f'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(110,175); ctx.lineTo(W-110,175); ctx.stroke();
        const qr=500; const qx=(W-qr)/2; const qy=230; ctx.drawImage(qrCanvas,qx,qy,qr,qr);
        ctx.fillStyle='#222'; ctx.font='bold 46px Arial'; ctx.fillText(String(u.nombre||`Unidad ${u.numero}`),W/2,810);
        ctx.fillStyle='#444'; ctx.font='28px Arial'; ctx.fillText(`Unidad #${u.numero}`,W/2,855);
        if(u.propietario){ ctx.fillStyle='#222'; ctx.font='bold 30px Arial'; dibujarTextoAjustado(ctx,u.propietario,W/2,925,W-220,38,2); }
        ctx.fillStyle='#777'; ctx.font='20px Arial'; ctx.fillText('Código individual de acceso a votaciones',W/2,1040);
        ctx.fillStyle='#777'; ctx.font='18px Arial'; ctx.fillText('AdminPH · Documento de identificación de unidad',W/2,H-75);
        return crearPDFDesdeJPEG(canvas.toDataURL('image/jpeg',0.92),W,H);
    }

    function crearPDFMultiImagenes(paginasImagen) {
        const enc = new TextEncoder();
        const objetos = [];
        const pageCount = paginasImagen.length;
        const pagesObj = 2;
        objetos[1] = enc.encode(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
        const pageObjStart = 3;
        const imageObjStart = pageObjStart + pageCount;
        const contentObjStart = imageObjStart + pageCount;
        const kids = Array.from({length:pageCount},(_,i)=>`${pageObjStart+i} 0 R`).join(' ');
        objetos[2] = enc.encode(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
        const offsets=[];
        for(let i=0;i<pageCount;i++){
            const pageObj=pageObjStart+i, imageObj=imageObjStart+i, contentObj=contentObjStart+i;
            objetos[pageObj]=enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>`);
            const jpg=paginasImagen[i].jpegDataUrl.split(',')[1]||''; const bin=atob(jpg); const bytes=new Uint8Array(bin.length); for(let j=0;j<bin.length;j++)bytes[j]=bin.charCodeAt(j);
            const w=paginasImagen[i].width,h=paginasImagen[i].height;
            const head=enc.encode(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
            const tail=enc.encode('\nendstream'); const obj=new Uint8Array(head.length+bytes.length+tail.length); obj.set(head,0); obj.set(bytes,head.length); obj.set(tail,head.length+bytes.length); objetos[imageObj]=obj;
            const content=`q\n612 0 0 792 0 0 cm\n/Im1 Do\nQ\n`; objetos[contentObj]=enc.encode(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream`);
        }
        const chunks=[]; const header=enc.encode('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n'); chunks.push(header); let offset=header.length; const maxObj=contentObjStart+pageCount-1; for(let i=1;i<=maxObj;i++){offsets[i]=offset; const a=enc.encode(`${i} 0 obj\n`),b=enc.encode('\nendobj\n'); chunks.push(a,objetos[i],b); offset+=a.length+objetos[i].length+b.length;}
        let xref=`xref\n0 ${maxObj+1}\n0000000000 65535 f \n`; for(let i=1;i<=maxObj;i++) xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n'; chunks.push(enc.encode(`${xref}trailer\n<< /Size ${maxObj+1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`));
        return new Blob(chunks,{type:'application/pdf'});
    }

    async function crearPaginaQRImpresion(grupo, paginaNumero, totalPaginas, porHoja) {
        const W=1275,H=1650;
        const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H; const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H); ctx.fillStyle='#2d6a4f';ctx.textAlign='center';ctx.font='bold 24px Arial';ctx.fillText('AdminPH · Códigos QR de votación',W/2,42); ctx.fillStyle='#666';ctx.font='16px Arial';ctx.fillText(`Hoja ${paginaNumero} de ${totalPaginas}`,W/2,68);
        const cols=2, rows=Math.ceil(porHoja/2), top=95, bottom=45, gapX=38, gapY=32; const cellW=(W-2*55-gapX)/2; const cellH=(H-top-bottom-(rows-1)*gapY)/rows; const qrSize=porHoja===4?350:porHoja===6?290:225;
        for(let i=0;i<grupo.length;i++){
            const u=grupo[i], col=i%2,row=Math.floor(i/2), x=55+col*(cellW+gapX), y=top+row*(cellH+gapY); ctx.strokeStyle='#bbb';ctx.lineWidth=2;ctx.strokeRect(x,y,cellW,cellH);
            const qr=await obtenerCanvasQR(generarUrlVotacion(u.id,u.numeroFila),qrSize); const qx=x+(cellW-qrSize)/2,qy=y+Math.max(20,(cellH-qrSize-105)/2);ctx.drawImage(qr,qx,qy,qrSize,qrSize);
            ctx.fillStyle='#222';ctx.font='bold 30px Arial';ctx.fillText(String(u.concatenado||`Unidad ${u.numeroFila}`),x+cellW/2,qy+qrSize+42);ctx.fillStyle='#333';ctx.font='20px Arial';
            const owner=(u.propietario||'').trim(); if(owner){ctx.fillText(owner.length>45?owner.slice(0,42)+'…':owner,x+cellW/2,qy+qrSize+70);} ctx.fillStyle='#777';ctx.font='17px Arial';ctx.fillText(`Unidad #${u.numeroFila}`,x+cellW/2,qy+qrSize+95);
        }
        return {jpegDataUrl:canvas.toDataURL('image/jpeg',0.93),width:W,height:H};
    }

    async function generarPDFTodosQR(listaUnidades, porHoja) {
        const arr=Array.isArray(listaUnidades)?listaUnidades:[]; if(!arr.length){alert('No hay unidades registradas para exportar.');return;}
        porHoja=[4,6,8].includes(porHoja)?porHoja:6; const paginas=[]; for(let i=0;i<arr.length;i+=porHoja) paginas.push(arr.slice(i,i+porHoja));
        const btn=document.getElementById('imprimirTodosQRBtn'), original=btn?.textContent; if(btn){btn.disabled=true;btn.textContent='⏳ Generando PDF...';}
        try{
            const imagenes=[]; for(let i=0;i<paginas.length;i++){imagenes.push(await crearPaginaQRImpresion(paginas[i],i+1,paginas.length,porHoja)); if(btn)btn.textContent=`⏳ Generando ${i+1}/${paginas.length}...`;}
            const blob=crearPDFMultiImagenes(imagenes); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`AdminPH_Codigos_QR_${porHoja}_por_hoja.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
        }catch(e){console.error(e);alert('❌ No fue posible generar el PDF de códigos QR.');}finally{if(btn){btn.disabled=false;btn.textContent=original||'📄 Generar PDF de QR';}}
    }

    async function exportarTodosQRPdfACarpeta(listaPersonalizada=null, idBoton='exportarTodosQRPdfBtn', prefijo='QR') {
        const lista = Array.isArray(listaPersonalizada) ? listaPersonalizada : unidades;
        if (!lista.length) { alert('No hay unidades registradas para exportar.'); return; }
        if (!window.showDirectoryPicker) {
            alert('⚠️ Su navegador no permite seleccionar una carpeta directamente desde AdminPH. Use Google Chrome o Microsoft Edge actualizado, o utilice la descarga individual de PDF.');
            return;
        }
        let dir;
        try { dir = await window.showDirectoryPicker({mode:'readwrite'}); }
        catch(e) { if(e?.name !== 'AbortError') alert('No se seleccionó ninguna carpeta.'); return; }
        if (!dir) return;
        if (dir.queryPermission) {
            let permiso = await dir.queryPermission({mode:'readwrite'});
            if (permiso !== 'granted' && dir.requestPermission) permiso = await dir.requestPermission({mode:'readwrite'});
            if (permiso !== 'granted') { alert('🔒 No se obtuvo permiso de escritura en la carpeta seleccionada.'); return; }
        }
        const total=lista.length;
        let completados=0;
        const nombresUsados={};
        const btn=document.getElementById(idBoton);
        const textoOriginal=btn?.textContent;
        if(btn){btn.disabled=true;btn.textContent='⏳ Exportando QR...';}
        try {
            for (const u of lista) {
                const base=nombreArchivoQR(u.numeroFila,u.propietario);
                const clave=base.toLowerCase();
                nombresUsados[clave]=(nombresUsados[clave]||0)+1;
                const archivo=nombresUsados[clave]===1 ? base : base.replace(/\.pdf$/i,` (${nombresUsados[clave]}).pdf`);
                const blob=await generarPDFQRUnidad({id:u.id,numero:u.numeroFila,nombre:u.concatenado||`Unidad ${u.numeroFila}`,propietario:u.propietario||''});
                const fh=await dir.getFileHandle(archivo,{create:true});
                const writable=await fh.createWritable(); await writable.write(blob); await writable.close();
                completados++;
                if(btn) btn.textContent=`⏳ Exportando ${completados}/${total}...`;
            }
            alert(`✅ Exportación terminada.\n\nSe generaron ${completados} archivos PDF individuales en la carpeta seleccionada.`);
        } catch(e) {
            console.error(e);
            alert(`⚠️ La exportación se detuvo en ${completados} de ${total} QR.\n\nDetalle: ${e?.message || e}`);
        } finally { if(btn){btn.disabled=false;btn.textContent=textoOriginal||'📂 Exportar QR individuales a carpeta';} }
    }

    // ==================== ASISTENCIA ====================
    function renderAsistenciaModule() {
        const content = document.getElementById('mainContent');
        const puedeEditar = ROLES[currentUser?.role]?.permissions?.canEditAttendance || false;

        for (const u of unidades) {
            if (!asistencia.find(a => a.unidadId === u.id)) {
                asistencia.push({ unidadId: u.id, presente: false, nombreAsistente: "", numeroDocumentoAsistente: "", condicion: "propietario" });
            }
        }
        guardarDatos();

        const validacion = validarSumaCoeficientes();

        content.innerHTML = `
            <div class="card"><h2>✅ Toma de Asistencia</h2>
                <div class="summary-bar"><span>📅 ${configConjunto.fechaReunion || 'Sin fecha'}</span><span>📌 ${configConjunto.tipoReunion}</span></div>
                <div class="summary-bar ${validacion.esValida ? 'ok' : 'alerta'}"><strong>${validacion.mensaje}</strong></div>
                ${!validacion.esValida ? '<p style="color:#c62828;font-size:13px;">⚠️ Ajuste los coeficientes antes de continuar con la asamblea. Vaya al módulo "Coeficientes".</p>' : ''}
            </div>
            <div class="card"><h3>✏️ Registrar Asistencia</h3><div id="asistenciaTable" class="table-wrapper"></div>
            ${puedeEditar ? `<button id="guardarAsistenciaBtn" class="btn-primary" style="margin-top:15px;">💾 Guardar Asistencia</button>` : ''}</div>
        `;

        const container = document.getElementById('asistenciaTable');
        if (unidades.length === 0) { container.innerHTML = '<p>No hay unidades</p>'; return; }

        let html = `<table class="data-table"><thead><tr><th>#</th><th>Unidad</th><th>Tipo</th><th>Propietario</th><th>N° Doc</th><th>¿Asiste?</th><th>Condición</th><th>Nombre Asistente</th><th>N° Doc Asistente</th></tr></thead><tbody>`;

        unidades.forEach(u => {
            let asist = asistencia.find(a => a.unidadId === u.id);
            if (!asist) { asist = { unidadId: u.id, presente: false, nombreAsistente: "", numeroDocumentoAsistente: "", condicion: "propietario" }; asistencia.push(asist); }

            html += `<tr>
                <td>${u.numeroFila}</td>
                <td>${escapeHtml(u.concatenado)}</td>
                <td><span class="badge ${TIPOS_UNIDAD.find(t=>t.value===u.tipo)?.class || 'badge-residencial'}">${TIPOS_UNIDAD.find(t=>t.value===u.tipo)?.label || 'Residencial'}</span></td>
                <td>${escapeHtml(u.propietario||'-')}</td>
                <td>${u.numeroDocumento||'-'}</td>
                <td><select data-id="${u.id}" data-field="presente" class="asistencia-select" ${!puedeEditar ? 'disabled' : ''}>
                    <option value="false" ${!asist.presente ? 'selected' : ''}>❌ No presente</option>
                    <option value="true" ${asist.presente ? 'selected' : ''}>✅ Presente</option>
                </select></td>
                <td><select data-id="${u.id}" data-field="condicion" class="condicion-select" ${!puedeEditar ? 'disabled' : ''} ${!asist.presente ? 'disabled' : ''}>
                    <option value="propietario" ${asist.condicion === 'propietario' ? 'selected' : ''}>🏠 Propietario</option>
                    <option value="apoderado" ${asist.condicion === 'apoderado' ? 'selected' : ''}>📄 Apoderado</option>
                </select></td>
                <td><input type="text" data-id="${u.id}" data-field="nombreAsistente" value="${escapeHtml(asist.nombreAsistente||'')}" ${!puedeEditar ? 'disabled' : ''} ${!asist.presente ? 'disabled' : ''} style="min-width:120px;"></td>
                <td><input type="text" data-id="${u.id}" data-field="numeroDocumentoAsistente" value="${escapeHtml(asist.numeroDocumentoAsistente||'')}" ${!puedeEditar ? 'disabled' : ''} ${!asist.presente ? 'disabled' : ''} style="min-width:100px;"></td>
            </tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;

        if (puedeEditar) {
            document.querySelectorAll('.asistencia-select').forEach(sel => {
                sel.onchange = () => {
                    const id = sel.dataset.id;
                    const presente = sel.value === 'true';
                    const row = sel.closest('tr');
                    const condSel = row.querySelector('.condicion-select');
                    const nomInp = row.querySelector('input[data-field="nombreAsistente"]');
                    const docInp = row.querySelector('input[data-field="numeroDocumentoAsistente"]');
                    const u = unidades.find(x => x.id === id);

                    condSel.disabled = !presente;
                    nomInp.disabled = !presente;
                    docInp.disabled = !presente;

                    const asist = asistencia.find(a => a.unidadId === id);
                    if (asist) {
                        asist.presente = presente;
                        if (!presente) { asist.nombreAsistente = ""; asist.numeroDocumentoAsistente = ""; nomInp.value = ""; docInp.value = ""; }
                        else if (asist.condicion === 'propietario' && u) { asist.nombreAsistente = u.propietario || ''; asist.numeroDocumentoAsistente = u.numeroDocumento || ''; nomInp.value = asist.nombreAsistente; docInp.value = asist.numeroDocumentoAsistente; }
                        guardarDatos();
                    }
                };
            });

            document.querySelectorAll('.condicion-select').forEach(sel => {
                sel.onchange = () => {
                    const id = sel.dataset.id;
                    const cond = sel.value;
                    const u = unidades.find(x => x.id === id);
                    const asist = asistencia.find(a => a.unidadId === id);
                    const row = sel.closest('tr');
                    const nomInp = row.querySelector('input[data-field="nombreAsistente"]');
                    const docInp = row.querySelector('input[data-field="numeroDocumentoAsistente"]');
                    if (asist) {
                        asist.condicion = cond;
                        if (cond === 'propietario' && u) { asist.nombreAsistente = u.propietario||''; asist.numeroDocumentoAsistente = u.numeroDocumento||''; nomInp.value = asist.nombreAsistente; docInp.value = asist.numeroDocumentoAsistente; }
                        else { asist.nombreAsistente = ''; asist.numeroDocumentoAsistente = ''; nomInp.value = ''; docInp.value = ''; }
                        guardarDatos();
                    }
                };
            });

            document.querySelectorAll('input[data-field="nombreAsistente"], input[data-field="numeroDocumentoAsistente"]').forEach(inp => {
                inp.onchange = () => {
                    const asist = asistencia.find(a => a.unidadId === inp.dataset.id);
                    if (asist) { asist[inp.dataset.field] = inp.value; guardarDatos(); }
                };
            });
        }

        document.getElementById('guardarAsistenciaBtn')?.addEventListener('click', () => {
            alert("✅ Asistencia guardada");
            renderAsistenciaModule();
        });
    }

    // ==================== QUÓRUM ====================

    // ==================== V3.5 COEFICIENTE DE PARTICIPACIÓN ====================
    // Los asistentes (presentes) pasan a ser el 100% de la base de votación de ESTA asamblea.
    function calcularParticipacion() {
        const filas = [];
        let suma = 0;
        for (const a of asistencia) {
            if (!a.presente) continue;
            const u = unidades.find(x => x.id === a.unidadId);
            if (!u) continue;
            const c = parseFloat(u.coeficienteTotal) || parseFloat(u.coeficiente) || 0;
            suma += c;
            filas.push({ fila: u.numeroFila, propietario: u.propietario || '', condicion: a.condicion || 'propietario', coef: c });
        }
        filas.forEach(f => { f.coefNuevo = suma > 0 ? (f.coef / suma) * 100 : 0; });
        filas.sort((x, y) => (parseFloat(x.fila) || 0) - (parseFloat(y.fila) || 0));
        const totalConjunto = unidades.reduce((s, u) => s + (parseFloat(u.coeficienteTotal) || parseFloat(u.coeficiente) || 0), 0);
        return { filas, suma, totalConjunto, factor: suma > 0 ? 100 / suma : 0 };
    }

    function htmlParticipacion() {
        const p = calcularParticipacion();
        const q = calcularQuorum();
        const sumaNueva = p.filas.reduce((s, f) => s + f.coefNuevo, 0);
        const filasHtml = p.filas.map(f => `<tr><td style="text-align:center;">${escapeHtml(f.fila)}</td><td>${escapeHtml(f.propietario)}${f.condicion === 'apoderado' ? ' <small>(apoderado)</small>' : ''}</td><td style="text-align:right;">${f.coef.toFixed(4)}%</td><td style="text-align:right;font-weight:bold;color:#1b5e20;">${f.coefNuevo.toFixed(4)}%</td></tr>`).join('');
        return `
            <div class="summary-bar ${q.quorumOk ? 'ok' : 'alerta'}">
                <strong>${q.quorumOk ? '✅ Quórum alcanzado' : '❌ Quórum NO alcanzado'}</strong> · Presentes: <strong>${p.filas.length}</strong> unidades que suman <strong>${p.suma.toFixed(4)}%</strong> del total del conjunto (${p.totalConjunto.toFixed(4)}%)
            </div>
            <p style="margin:10px 0;">Para las votaciones de esta asamblea, los asistentes se toman como el <strong>100%</strong>. Cada coeficiente se multiplica por <strong>${p.factor.toFixed(6)}</strong> (= 100 ÷ ${p.suma.toFixed(4)}).</p>
            <div class="part-wrap"><table class="data-table part-tabla" style="width:100%;">
                <thead><tr><th>Unidad</th><th>Asistente / Propietario</th><th>Coef. original</th><th>Coef. de participación</th></tr></thead>
                <tbody>${filasHtml || '<tr><td colspan="4" style="text-align:center;">Aún no hay asistentes registrados.</td></tr>'}</tbody>
                <tfoot><tr style="font-weight:bold;"><td></td><td>TOTAL</td><td style="text-align:right;">${p.suma.toFixed(4)}%</td><td style="text-align:right;">${sumaNueva.toFixed(4)}%</td></tr></tfoot>
            </table></div>
            <p style="font-size:12px;color:#666;margin-top:8px;">Informativo: la Ley 675 de 2001 mide el quórum y las mayorías sobre los coeficientes (art. 45 y 46); confirme con su asesor jurídico cuál base aplica a cada decisión. Esta vista no modifica los coeficientes originales.</p>`;
    }

    function exportarParticipacionCSV() {
        const p = calcularParticipacion();
        const lines = ['Unidad;Propietario;Condicion;Coef_original;Coef_participacion'];
        p.filas.forEach(f => lines.push([f.fila, '"' + String(f.propietario).replace(/"/g, '""') + '"', f.condicion, f.coef.toFixed(4).replace('.', ','), f.coefNuevo.toFixed(4).replace('.', ',')].join(';')));
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'coeficiente_participacion.csv';
        document.body.appendChild(a); a.click(); a.remove();
    }

    function renderParticipacionModule() {
        const content = document.getElementById('mainContent');
        content.innerHTML = `<div class="card"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;"><h2>📐 Coeficiente de participación</h2><div><button id="partRefrescar" class="btn-secondary">🔄 Actualizar</button> <button id="partCsv" class="btn-primary">⬇️ Excel/CSV</button> <button id="partPrint" class="btn-secondary">🖨️ Imprimir</button></div></div><div id="partBody">${htmlParticipacion()}</div></div>`;
        document.getElementById('partRefrescar').onclick = () => { document.getElementById('partBody').innerHTML = htmlParticipacion(); };
        document.getElementById('partCsv').onclick = exportarParticipacionCSV;
        document.getElementById('partPrint').onclick = () => window.print();
    }

    function abrirParticipacionModal() {
        let m = document.getElementById('partModal');
        if (m) m.remove();
        m = document.createElement('div');
        m.id = 'partModal';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:15px;';
        m.innerHTML = `<div style="background:#fff;border-radius:12px;max-width:1100px;width:100%;max-height:94vh;overflow-y:auto;overflow-x:hidden;padding:20px;"><div style="display:flex;justify-content:space-between;align-items:center;"><h2>📐 Coeficiente de participación</h2><div><button id="partModalCsv" class="btn-primary">⬇️ Excel/CSV</button> <button id="partModalClose" class="btn-secondary">✖ Cerrar</button></div></div>${htmlParticipacion()}</div>`;
        document.body.appendChild(m);
        m.querySelector('#partModalClose').onclick = () => m.remove();
        m.querySelector('#partModalCsv').onclick = exportarParticipacionCSV;
        m.addEventListener('click', e => { if (e.target === m) m.remove(); });
    }

    // ==================== V3.6 VOTACIÓN MANUAL (Excel de respaldo si falla el QR) ====================
    // V3.8: TODOS los puntos con votación del orden del día (fijos, adicionales y creados con «Agregar punto»).
    // Los que aún no tienen candidatos/opciones aparecen como «pendientes» (se habilitan al agregar candidatos).
    const MAPA_PUNTO_VOTACION = { presidente: 'presidente', secretario: 'secretario', comite: 'comite', consejo: 'consejo', convivencia: 'convivencia', revisorFiscal: 'revisorFiscal', personalizado: 'ordenDia', acta: 'actaAnterior', financieros: 'financieros', presupuesto: 'presupuesto' };
    const ETIQUETA_VOTACION = { presidente: 'Presidente de Asamblea', secretario: 'Secretario(a) de Asamblea', comite: 'Comisión Verificadora del Acta', consejo: 'Consejo de Administración', convivencia: 'Comité de Convivencia', revisorFiscal: 'Revisor Fiscal', ordenDia: 'Aprobación del orden del día', actaAnterior: 'Aprobación del acta anterior', financieros: 'Aprobación de estados financieros', presupuesto: 'Aprobación de presupuesto y cuota' };
    const ES_CARGO_VOTACION = ['presidente', 'secretario', 'comite', 'consejo', 'convivencia', 'revisorFiscal'];
    function nombresOpcionesVotacion(key, est) {
        if (!est) return [];
        const esCargo = ES_CARGO_VOTACION.includes(key) || (!(Array.isArray(est.opciones) && est.opciones.length) && Array.isArray(est.candidatos) && est.candidatos.length);
        const lista = (Array.isArray(est.opciones) && est.opciones.length) ? est.opciones : (esCargo ? est.candidatos : []);
        return (lista || []).map((c, i) => {
            const n = String(c.nombre || '').trim() || `Opción ${i + 1}`;
            return (c.unidadNombre && c.condicion !== 'externo' && c.condicion !== 'manual') ? `${n} (${String(c.unidadNombre).slice(0, 40)})` : n;
        });
    }
    function listarVotacionesManual() {
        const out = [];
        const add = (key, label, punto) => {
            const est = votacionEstado[key];
            if (!est) return;
            const opciones = nombresOpcionesVotacion(key, est);
            out.push({ key, label, opciones, est, pendiente: opciones.length === 0, puntoId: punto ? punto.id : null });
        };
        const vistos = new Set();
        // 1) Siguiendo el orden del día configurado
        (puntosOrdenDia || []).filter(p => p.activo).forEach(p => {
            let key = MAPA_PUNTO_VOTACION[p.modulo] || null, label = p.texto;
            if (!key && p.tipoPunto === 'votacion') key = 'punto_' + p.id;
            if (!key && p.modulo === 'votacionesExtra') return; // se agregan abajo
            if (!key || vistos.has(key)) return;
            vistos.add(key); add(key, label, p);
        });
        // 2) Votaciones adicionales (fuera del orden del día) y cualquier otra extra
        (votacionesExtra || []).forEach(v => { if (!v || !v.key || vistos.has(v.key)) return; vistos.add(v.key); add(v.key, v.titulo || v.key, null); });
        // 3) Fijas que no estén en el orden del día activo pero tengan datos
        Object.keys(ETIQUETA_VOTACION).forEach(k => { if (vistos.has(k)) return; const e = votacionEstado[k]; if (e && nombresOpcionesVotacion(k, e).length) { vistos.add(k); add(k, ETIQUETA_VOTACION[k], null); } });
        return out;
    }
    // Clave de votación asociada a un punto del orden del día (o null si el punto no vota).
    function votacionDePunto(p) {
        if (!p) return null;
        if (MAPA_PUNTO_VOTACION[p.modulo]) return MAPA_PUNTO_VOTACION[p.modulo];
        if (p.tipoPunto === 'votacion') return 'punto_' + p.id;
        return null;
    }

    // Filas de la hoja: una por unidad presente; si un apoderado (mismo documento) representa varias, UNA sola fila con la suma.
    function filasVotacionManual() {
        const grupos = new Map();
        for (const a of asistencia) {
            if (!a.presente) continue;
            const u = unidades.find(x => x.id === a.unidadId); if (!u) continue;
            const coef = parseFloat(u.coeficienteTotal) || parseFloat(u.coeficiente) || 0;
            const esAp = a.condicion === 'apoderado';
            const doc = String(a.numeroDocumentoAsistente || '').trim();
            const rep = infoRepresentacion(u.id);
            const clave = rep ? 'g:' + rep.grupo.id : (esAp && doc ? 'ap:' + doc : 'u:' + u.id);
            if (!grupos.has(clave)) grupos.set(clave, { apoderado: (rep || (esAp && doc)) ? (a.nombreAsistente || 'Apoderado') : '', unidades: [] });
            grupos.get(clave).unidades.push({ nombre: u.concatenado || String(u.numeroFila), propietario: u.propietario || '', coef, apoderadoUnidad: esAp ? (a.nombreAsistente || '') : '' });
        }
        const cmp = (x, y) => String(x).localeCompare(String(y), 'es', { numeric: true, sensitivity: 'base' });
        const filas = [];
        grupos.forEach(g => {
            g.unidades.sort((p, q) => cmp(p.nombre, q.nombre));
            const coef = g.unidades.reduce((s, x) => s + x.coef, 0);
            let quien;
            if (g.apoderado) quien = `${g.apoderado} (APODERADO) — representa a: ` + g.unidades.map(x => `${x.propietario || 'sin nombre'} (${x.nombre})`).join('; ');
            else { const x = g.unidades[0]; quien = x.apoderadoUnidad ? `${x.apoderadoUnidad} (apoderado de ${x.propietario || 'sin nombre'})` : (x.propietario || ''); }
            filas.push({ unidades: g.unidades.map(x => x.nombre).join(', '), quien, coef, n: g.unidades.length });
        });
        filas.sort((p, q) => cmp(p.unidades, q.unidades));
        return filas;
    }

    function hojaVotacionManual(v) {
        // V3.9: fila 1 = encabezados con filtro (siempre visible); columnas X seguidas; todo bloqueado salvo las casillas X;
        // totales, resumen, convenciones y código de votación quedan ABAJO de la lista.
        const filas = filasVotacionManual();
        const k = v.opciones.length;
        const colMarca = j => 5 + j, colRes = j => 5 + k + j, ultima = 4 + 2 * k;
        const L = XLSXMini.colName;
        const q = obtenerQuorumVotacion(v.est);
        const bridge = window.AdminPHBridge && window.AdminPHBridge.state ? window.AdminPHBridge.state() : {};
        const rows = [], heights = {};
        const head = [{ v: 'N°', s: 'enc' }, { v: 'UNIDAD(ES)', s: 'enc' }, { v: 'PROPIETARIO / REPRESENTANTE', s: 'enc' }, { v: 'COEF. ORIGINAL (%)', s: 'enc' }, { v: 'COEF. PARTICIPACIÓN (asistentes = 100%)', s: 'enc' }];
        v.opciones.forEach(o => head.push({ v: `MARCAR X\n${o}`, s: 'enc' }));
        v.opciones.forEach(o => head.push({ v: `COEF. ${o}`, s: 'enc' }));
        rows[0] = head; heights[0] = 54;
        const r0 = 1, rN = r0 + filas.length - 1, rT = rN + 2;   // una fila en blanco entre la lista y los totales
        const T = rT + 1;                                        // fila de totales (base 1)
        filas.forEach((f, i) => {
            const r = r0 + i, R = r + 1;
            const row = [{ v: i + 1, s: 'centro' }, { v: f.unidades, s: 'texto' }, { v: f.quien, s: 'texto' }, { v: Math.round(f.coef * 1e6) / 1e6, s: 'num' }, { f: `IF($D$${T}=0,0,D${R}*100/$D$${T})`, s: 'num' }];
            v.opciones.forEach((o, j) => { row[colMarca(j)] = { v: '', s: 'marcaLibre' }; });
            v.opciones.forEach((o, j) => { row[colRes(j)] = { f: `IF(UPPER(TRIM(${L(colMarca(j))}${R}))="X",$D${R},0)`, s: 'res' }; });
            rows[r] = row;
            if (f.quien.length > 70 || f.n > 3) heights[r] = Math.min(90, 18 * Math.ceil(f.quien.length / 55));
        });
        const rng = (c) => `${c}${r0 + 1}:${c}${rN + 1}`;
        const blanco = (n) => Array.from({ length: n }, () => ({ v: '', s: 'totalTxt' }));
        const tot = [{ v: '', s: 'totalTxt' }, { v: 'TOTAL', s: 'totalTxt' }, { v: `${filas.length} filas`, s: 'totalTxt' }, { f: `SUM(${rng('D')})`, s: 'total' }, { f: `SUM(${rng('E')})`, s: 'total' }];
        v.opciones.forEach((o, j) => { tot[colMarca(j)] = { v: '', s: 'totalTxt' }; });
        v.opciones.forEach((o, j) => { tot[colRes(j)] = { f: `SUM(${rng(L(colRes(j)))})`, s: 'total' }; });
        rows[rT] = tot;
        // Resumen
        const lab = (t) => [{ v: '', s: 'normal' }, { v: '', s: 'normal' }, { v: t, s: 'totalTxt' }, { v: '', s: 'totalTxt' }, { v: '', s: 'totalTxt' }];
        const rEsp = rT + 2;
        rows[rEsp] = [{ v: 'RESUMEN DEL RESULTADO', s: 'subtitulo' }];
        const mk = (idx, texto, fn, estilo) => { const row = lab(texto); v.opciones.forEach((o, j) => { row[colMarca(j)] = { v: '', s: 'totalTxt' }; row[colRes(j)] = { f: fn(L(colRes(j)), j), s: estilo }; }); rows[idx] = row; };
        mk(rEsp + 1, '% sobre los ASISTENTES (base = 100%)', c => `IF($D$${T}=0,0,${c}${T}*100/$D$${T})`, 'pct');
        mk(rEsp + 2, '% sobre el TOTAL del conjunto', c => `${c}${T}`, 'pct');
        mk(rEsp + 3, `Mínimo para aprobar (${q.porcentaje}% de los presentes)`, () => `$D$${T}*${q.porcentaje}/100`, 'total');
        mk(rEsp + 4, '¿Alcanza el mínimo?', c => `IF(${c}${T}>=$D$${T}*${q.porcentaje}/100,"SÍ","NO")`, 'ok');
        const rowV = lab('Total votado (coeficiente)'); rowV[colRes(0)] = { f: v.opciones.map((o, j) => `${L(colRes(j))}${T}`).join('+'), s: 'total' }; rows[rEsp + 5] = rowV;
        const rowS = lab('Sin votar (coeficiente de asistentes que no marcó)'); rowS[colRes(0)] = { f: `$D$${T}-${L(colRes(0))}${rEsp + 6}`, s: 'total' }; rows[rEsp + 6] = rowS;
        // Convenciones (abajo, para que la fila 1 con filtros quede siempre a la vista)
        let rc = rEsp + 8;
        const nota = (t, h) => { rows[rc] = [{ v: t, s: 'nota' }]; if (h) heights[rc] = h; rc++; };
        rows[rc++] = [{ v: 'CONVENCIONES Y DATOS DE ESTA HOJA', s: 'subtitulo' }];
        const merges = [];
        const primeraNota = rc;
        nota(`${configConjunto.nombreConjunto || 'Conjunto'} — ${v.label}`);
        nota(`Asamblea: ${bridge.assemblyName || configConjunto.nombreAsamblea || '—'}   ·   Fecha: ${configConjunto.fechaReunion || '—'}   ·   Quórum para aprobar: ${q.porcentaje}% de los coeficientes presentes   ·   Generado: ${new Date().toLocaleString('es-CO')}`, 30);
        nota('Cómo usar: marque una X SOLO en las casillas amarillas (única parte editable de la hoja) de la opción elegida por cada fila. Los coeficientes verdes, los totales y el resumen se calculan solos. Cada fila es una unidad o un apoderado con todas las unidades que representa.', 44);
        nota('Filtros: use las flechas de la fila 1 para buscar una unidad o propietario; la fila de títulos y las 3 primeras columnas permanecen inmovilizadas al desplazarse.', 30);
        nota(`Código de votación: ${v.key}`);
        nota('Firmas: ______________________  Presidente        ______________________  Secretario(a)        ______________________  Comisión verificadora');
        for (let m = primeraNota; m < rc; m++) merges.push(`A${m + 1}:${L(Math.max(ultima, 7))}${m + 1}`);
        for (let m = 1; m <= 6; m++) merges.push(`A${rEsp + 1 + m}:B${rEsp + 1 + m}`);
        const cols = [6, 14, 44, 14, 20]; v.opciones.forEach(() => cols.push(15)); v.opciones.forEach(() => cols.push(13));
        const nombreHoja = String(ETIQUETA_VOTACION[v.key] || v.label).replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 28);
        return {
            name: nombreHoja, rows, merges, cols, heights, freeze: { row: 1, col: 3 }, landscape: true,
            protect: true, autofilter: `A1:${L(ultima)}${rN + 1}`, printTitleRow: 1,
            validations: [{ sqref: `${L(colMarca(0))}${r0 + 1}:${L(colMarca(k - 1))}${rN + 1}`, formula: '"X"', title: 'Solo la letra X', msg: 'En estas casillas solo se puede escribir la letra X (o dejarla vacía para borrar).', prompt: 'Escriba X para votar por esta opción' }],
            header: `${configConjunto.nombreConjunto || 'Conjunto'} — ${v.label}`
        };
    }

    async function descargarVotacionManual(seleccion) {
        if (!seleccion.length) { alert('Seleccione al menos una votación.'); return; }
        if (!filasVotacionManual().length) { alert('Todavía no hay asistentes registrados. Marque la asistencia primero.'); return; }
        const hojas = seleccion.map(hojaVotacionManual), usados = new Set();
        hojas.forEach((h, i) => { let n = h.name || 'Votación', k = 2; while (usados.has(n.toLowerCase())) n = h.name.slice(0, 25) + ' ' + (k++); h.name = n; usados.add(n.toLowerCase()); });
        const blob = await XLSXMini.write(hojas);
        const fecha = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
        const slug = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 50);
        const conj = slug(configConjunto.nombreConjunto || 'conjunto');
        const nombre = seleccion.length === 1 ? `VOTACION_${slug(seleccion[0].label)}_${conj}_${fecha}.xlsx` : `VOTACION_MANUAL_GENERAL_${conj}_${fecha}.xlsx`;
        XLSXMini.download(blob, nombre);
        logExcelManual({ tipo: 'descarga', archivo: nombre, puntos: seleccion.map(x => x.label) });
    }
    // V4.2: bitácora de los Excel de votación manual (para el anexo del acta).
    function logExcelManual(e) {
        try { const l = JSON.parse(localStorage.getItem('excelManualLog') || '[]'); l.push(Object.assign({ t: new Date().toISOString() }, e)); localStorage.setItem('excelManualLog', JSON.stringify(l.slice(-300))); } catch (_) { /* nada */ }
    }

    // Lee el Excel diligenciado y calcula el resultado por X marcadas.
    async function leerVotacionManual(file) {
        const hojas = await XLSXMini.read(await file.arrayBuffer());
        const res = [];
        for (const h of hojas) {
            let key = null, filaEnc = -1;
            for (let r = 0; r < h.rows.length; r++) {
                (h.rows[r] || []).forEach(c => { const m = typeof c === 'string' && /Código de votación:\s*(\S+)/.exec(c); if (m) key = m[1]; });
                if (filaEnc < 0 && (h.rows[r] || [])[3] && /COEF\. ORIGINAL/i.test(String(h.rows[r][3]))) filaEnc = r;
            }
            if (!key || filaEnc < 0) continue;
            const v = listarVotacionesManual().find(x => x.key === key);
            const enc = h.rows[filaEnc];
            // Las columnas «MARCAR X» pueden estar seguidas (V3.9) o intercaladas (versiones anteriores): se detectan por el título.
            const colsX = []; const nombresHoja = [];
            enc.forEach((c, i) => { if (typeof c === 'string' && /^MARCAR X/i.test(c.trim())) { colsX.push(i); nombresHoja.push(String(c).replace(/^MARCAR X\s*/i, '').trim()); } });
            const nOp = colsX.length; if (!nOp) continue;
            const tot = nombresHoja.map(() => ({ coef: 0, unidades: 0 })); let sinVotar = 0, base = 0, filas = 0; const avisos = [];
            for (let r = filaEnc + 1; r < h.rows.length; r++) {
                const row = h.rows[r] || []; if (typeof row[0] !== 'number') { if (row[1] === 'TOTAL' || row[0] === undefined) break; continue; }
                const coef = Number(row[3]) || 0; base += coef; filas++;
                const marcas = []; colsX.forEach((c, j) => { if (String(row[c] || '').trim().toUpperCase() === 'X') marcas.push(j); });
                const multiple = v && v.est && v.est.seleccionMultiple;
                if (marcas.length === 0) { sinVotar += coef; continue; }
                if (marcas.length > 1 && !multiple) { avisos.push(`Fila ${row[0]} (${row[1] || ''}): más de una X, no se cuenta`); sinVotar += coef; continue; }
                marcas.forEach(j => { tot[j].coef += coef; tot[j].unidades += (String(row[1] || '').split(',').length); });
            }
            res.push({ key, label: v ? v.label : key, existe: !!v, opciones: nombresHoja, tot, sinVotar, base, filas, avisos, coincide: v ? (v.opciones.length === nOp) : false });
        }
        return res;
    }

    function registrarVotacionManual(r) {
        const est = votacionEstado[r.key];
        if (!est) throw new Error('La votación ya no existe.');
        const lista = (Array.isArray(est.opciones) && est.opciones.length) ? est.opciones : est.candidatos;
        if (!lista || lista.length !== r.tot.length) throw new Error(`«${r.label}»: el número de opciones cambió desde que se descargó el Excel.`);
        // V3.9: si estaba abierta se cierra aquí mismo (con la confirmación previa del modal) y se deja como una votación cerrada normal.
        if (est.abierta) { est.abierta = false; try { detenerTemporizadorVotacion(r.key); } catch (_) { /* nada */ } }
        lista.forEach((o, j) => {
            o.votosCoeficiente = Math.round(r.tot[j].coef * 1e6) / 1e6;
            o.votosNominal = r.tot[j].unidades;
            o.votosManoAlzada = r.tot[j].unidades;
        });
        est.tipoVoto = 'coeficiente';
        est.tiempoFin = null;
        est.votacionCerradaEn = new Date().toISOString();
        est.registroManual = { fecha: new Date().toISOString(), fuente: 'Excel de votación manual', sinVotar: r.sinVotar };
        votacionApertura[r.key] = null;
        capturarGraficoVotacion(r.key);   // estadística y gráfico, igual que al cerrar una votación normal
        guardarDatos();
    }
    // Lleva a la pantalla del punto para ver el resultado ya registrado.
    function verPuntoVotacion(key) {
        if (!document.getElementById('actividadContainer')) { cambiarFase(3); loadModule('asamblea'); }
        setTimeout(() => irAVotacion(key), 60);
    }

    function renderVotoManualModule() {
        const content = document.getElementById('mainContent');
        content.innerHTML = `<div class="card"><h2>📥 Votación manual de respaldo (Excel)</h2>
            <p>Si falla el QR o prefiere votar en papel: descargue un Excel por votación con la lista de asistentes en orden alfabético, casillas para marcar <strong>X</strong>, coeficientes y totales automáticos (% sobre los asistentes = 100). Luego cargue el Excel diligenciado para registrar el resultado en AdminPH.</p>
            <button id="vmAbrir" class="btn-primary">📥 Abrir descarga y carga de Excel</button></div>`;
        document.getElementById('vmAbrir').onclick = abrirVotacionManualModal;
        abrirVotacionManualModal();
    }

    function abrirVotacionManualModal(preKeys, irACargar) {
        const lista = listarVotacionesManual();
        const pre = Array.isArray(preKeys) && preKeys.length ? new Set(preKeys) : null;
        let m = document.getElementById('vmModal'); if (m) m.remove();
        m = document.createElement('div'); m.id = 'vmModal';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:15px;';
        const filas = filasVotacionManual();
        m.innerHTML = `<div style="background:#fff;border-radius:12px;max-width:820px;width:100%;max-height:92vh;overflow:auto;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;"><h2>📥 Votación manual de respaldo (Excel)</h2><button id="vmCerrar" class="btn-secondary">✖ Cerrar</button></div>
            <p>Si falla el QR, descargue el Excel de cada votación, imprímalo o llénelo en un computador, y después cárguelo aquí para que el resultado quede en AdminPH y en el acta.</p>
            <div class="summary-bar ${filas.length ? 'ok' : 'alerta'}">${filas.length ? `Se incluirán <strong>${filas.length}</strong> filas (unidades presentes; un apoderado con varias unidades ocupa una sola fila con la suma de sus coeficientes), en orden alfabético.` : 'Aún no hay asistentes registrados.'}</div>
            <h4 style="margin-top:14px;">1. Descargar</h4>
            ${lista.length ? lista.map((v, i) => v.pendiente ? `<div style="margin:6px 0;color:#8a6d3b;"><input type="checkbox" disabled style="width:auto;margin-right:8px;"><strong>${escapeHtml(v.label)}</strong> <small>⏳ aún sin ${ES_CARGO_VOTACION.includes(v.key) ? 'candidatos' : 'opciones'} — agréguelos en Fase 3 y vuelva aquí para descargar el Excel</small></div>` : `<label style="display:block;margin:6px 0;"><input type="checkbox" class="vmChk" data-i="${i}" ${(!pre || pre.has(v.key)) ? 'checked' : ''} style="width:auto;margin-right:8px;"><strong>${escapeHtml(v.label)}</strong> <small>(${v.opciones.map(escapeHtml).join(' · ')})</small></label>`).join('') : '<p>Aún no hay votaciones con opciones configuradas. Cree las opciones o candidatos en el Modo Asamblea y vuelva aquí.</p>'}
            <div style="margin:10px 0;"><button id="vmDescargar" class="btn-primary" ${lista.some(v => !v.pendiente) ? '' : 'disabled'}>⬇️ Descargar Excel de las seleccionadas</button></div>
            <p style="font-size:12px;color:#666;">El Excel trae una hoja por votación con fórmulas: al marcar la X aparece el coeficiente, y abajo los totales, el % sobre los asistentes (=100) y si alcanza el mínimo. Si llegan más asistentes, vuelva a descargarlo.</p>
            <h4 style="margin-top:14px;">2. Cargar el Excel diligenciado</h4>
            <input type="file" id="vmArchivo" accept=".xlsx"><div id="vmResultado" style="margin-top:10px;"></div>
            <div style="text-align:right;margin-top:14px;"><button id="vmCerrar2" class="btn-secondary">✖ Cerrar</button></div></div>`;
        document.body.appendChild(m);
        if (irACargar) setTimeout(() => { const f = m.querySelector('#vmArchivo'); if (f) f.scrollIntoView({ block: 'center' }); }, 50);
        m.querySelector('#vmCerrar').onclick = () => m.remove();
        m.querySelector('#vmCerrar2').onclick = () => m.remove();
        m.querySelector('#vmDescargar').onclick = async () => {
            const sel = [...m.querySelectorAll('.vmChk')].filter(c => c.checked).map(c => lista[Number(c.dataset.i)]);
            try { await descargarVotacionManual(sel); } catch (e) { alert('No se pudo generar el Excel: ' + (e.message || e)); }
        };
        m.querySelector('#vmArchivo').onchange = async (ev) => {
            const f = ev.target.files && ev.target.files[0]; if (!f) return;
            const box = m.querySelector('#vmResultado');
            try {
                const res = await leerVotacionManual(f);
                logExcelManual({ tipo: 'carga', archivo: f.name, puntos: res.map(r => r.label) });
                if (!res.length) { box.innerHTML = '<div class="summary-bar alerta">El archivo no tiene hojas de votación de AdminPH (no se encontró el «Código de votación»).</div>'; return; }
                const fx = (n) => Number(n).toFixed(4);
                box.innerHTML = res.map((r, i) => `<div class="summary-bar ${r.existe && r.coincide ? '' : 'alerta'}" style="margin:8px 0;"><strong>${escapeHtml(r.label)}</strong> — ${r.filas} filas, base ${fx(r.base)}%<br>` +
                    r.opciones.map((o, j) => `${escapeHtml(o)}: <strong>${fx(r.tot[j].coef)}</strong> (${r.base ? (r.tot[j].coef * 100 / r.base).toFixed(2) : '0.00'}% de los asistentes)`).join(' · ') +
                    `<br>Sin votar: ${fx(r.sinVotar)}` + (r.avisos.length ? `<br><small style="color:#b71c1c;">${r.avisos.slice(0, 5).map(escapeHtml).join('<br>')}${r.avisos.length > 5 ? '<br>… y ' + (r.avisos.length - 5) + ' más' : ''}</small>` : '') +
                    (!r.existe ? '<br><strong>⚠️ Esta votación ya no existe en AdminPH.</strong>' : !r.coincide ? '<br><strong>⚠️ Cambió el número de opciones: no se puede registrar.</strong>' : `<br><button class="btn-primary vmReg" data-i="${i}" style="margin-top:6px;">✅ Registrar este resultado en AdminPH</button>`) + '</div>').join('');
                box.querySelectorAll('.vmReg').forEach(b => b.onclick = () => {
                    const r = res[Number(b.dataset.i)];
                    const abierta = !!(votacionEstado[r.key] && votacionEstado[r.key].abierta);
                    if (!confirm(`Se registrará el resultado manual de «${r.label}» (reemplaza los votos que tenga hoy esa votación y la deja por coeficiente).${abierta ? '\n\n⚠️ La votación está ABIERTA: se cerrará ahora.' : ''}\n\n¿Continuar?`)) return;
                    try {
                        registrarVotacionManual(r);
                        logExcelManual({ tipo: 'registro', archivo: f.name, puntos: [r.label] });
                        b.outerHTML = `<strong style="color:#1b5e20;">✔ Registrado y cerrado</strong> <button class="btn-secondary vmVer" data-k="${escapeHtml(r.key)}" style="margin-left:8px;">📊 Ver resultado en el punto</button>`;
                        box.querySelectorAll('.vmVer').forEach(x => x.onclick = () => { m.remove(); verPuntoVotacion(x.dataset.k); });
                        if (document.getElementById('ordenDelDiaLista')) renderOrdenDelDia();
                    } catch (e) { alert(e.message || e); }
                });
            } catch (e) { box.innerHTML = `<div class="summary-bar alerta">No se pudo leer el archivo: ${escapeHtml(e.message || String(e))}</div>`; }
        };
    }

    // ==================== V3.6 CARGA RÁPIDA DE UNIDADES DESDE EXCEL ====================
    // Una sola plantilla: UNIDAD | DOCUMENTO | PROPIETARIO | CORREO | TELEFONO | COEFICIENTE | COEF_PARQUEADERO  (+ ETAPA opcional).
    // Si una unidad tiene varios copropietarios se repite el nombre de la unidad en filas seguidas (una fila por persona).
    const CARGA_ENCABEZADOS = ['UNIDAD', 'DOCUMENTO', 'PROPIETARIO', 'CORREO', 'TELEFONO', 'COEFICIENTE', 'COEF_PARQUEADERO', 'ETAPA', 'APODERADO_DOCUMENTO', 'APODERADO_NOMBRE', 'APODERADO_CORREO', 'APODERADO_TELEFONO'];

    function normEnc(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''); }
    function normNombreUnidad(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
    function numCoef(v) {
        if (typeof v === 'number') return isFinite(v) ? v : 0;
        let t = String(v == null ? '' : v).replace('%', '').trim(); if (!t) return 0;
        if (/,/.test(t) && !/\./.test(t)) t = t.replace(',', '.'); else t = t.replace(/,/g, '');
        const n = parseFloat(t); return isFinite(n) ? n : 0;
    }
    const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

    // Una persona puede traer varios correos o teléfonos separados por ; , / o salto de línea (se toma el primero para el principal).
    function tomarPrimero(v) { return String(v == null ? '' : v).split(/[;\n]/)[0].trim(); }

    const SINONIMOS_ENC = {
        UNIDAD: ['UNIDAD', 'NOMBRE_UNIDAD', 'INMUEBLE', 'LOTE', 'CASA', 'APARTAMENTO', 'APTO', 'PREDIO', 'UNIDAD_PRIVADA'],
        DOCUMENTO: ['DOCUMENTO', 'NUMERO_DOCUMENTO', 'NRO_DOCUMENTO', 'CEDULA', 'CC', 'NIT', 'IDENTIFICACION'],
        PROPIETARIO: ['PROPIETARIO', 'COPROPIETARIO', 'NOMBRE', 'NOMBRE_PROPIETARIO', 'NOMBRES', 'TITULAR'],
        CORREO: ['CORREO', 'EMAIL', 'E_MAIL', 'CORREO_ELECTRONICO'],
        TELEFONO: ['TELEFONO', 'CELULAR', 'MOVIL', 'WHATSAPP', 'TEL'],
        COEFICIENTE: ['COEFICIENTE', 'COEF', 'COEFICIENTE_COPROPIEDAD', 'COEF_COPROPIEDAD'],
        COEF_PARQUEADERO: ['COEF_PARQUEADERO', 'COEFICIENTE_PARQUEADERO', 'PARQUEADERO', 'COEF_PARQ'],
        ETAPA: ['ETAPA', 'GRUPO', 'MANZANA', 'TORRE', 'BLOQUE', 'SECTOR'],
        AP_DOC: ['APODERADO_DOCUMENTO', 'DOCUMENTO_APODERADO', 'APODERADO_CC'],
        AP_NOMBRE: ['APODERADO_NOMBRE', 'NOMBRE_APODERADO', 'APODERADO'],
        AP_CORREO: ['APODERADO_CORREO', 'CORREO_APODERADO'],
        AP_TEL: ['APODERADO_TELEFONO', 'TELEFONO_APODERADO', 'APODERADO_CELULAR']
    };

    function analizarCargaUnidades(rows) {
        // 1) encabezado
        let enc = -1, idx = {};
        for (let r = 0; r < Math.min(rows.length, 15); r++) {
            const m = {}; (rows[r] || []).forEach((c, i) => { const n = normEnc(c); for (const k in SINONIMOS_ENC) if (SINONIMOS_ENC[k].includes(n) && m[k] === undefined) m[k] = i; });
            if (m.UNIDAD !== undefined && (m.COEFICIENTE !== undefined || m.PROPIETARIO !== undefined)) { enc = r; idx = m; break; }
        }
        if (enc < 0) return { error: 'No se encontró la fila de títulos. La primera columna debe llamarse UNIDAD y debe haber al menos PROPIETARIO o COEFICIENTE. Descargue la plantilla para ver el formato.' };
        // 2) filas agrupadas por unidad
        const orden = [], mapa = new Map(), avisos = [];
        for (let r = enc + 1; r < rows.length; r++) {
            const row = rows[r] || [];
            const nombre = String(row[idx.UNIDAD] == null ? '' : row[idx.UNIDAD]).replace(/\s+/g, ' ').trim();
            if (!nombre) continue;
            const persona = {
                nombre: String(idx.PROPIETARIO !== undefined && row[idx.PROPIETARIO] != null ? row[idx.PROPIETARIO] : '').trim(),
                documento: String(idx.DOCUMENTO !== undefined && row[idx.DOCUMENTO] != null ? row[idx.DOCUMENTO] : '').trim(),
                correo: tomarPrimero(idx.CORREO !== undefined ? row[idx.CORREO] : ''),
                telefono: tomarPrimero(idx.TELEFONO !== undefined ? row[idx.TELEFONO] : '')
            };
            const coef = idx.COEFICIENTE !== undefined ? numCoef(row[idx.COEFICIENTE]) : 0;
            const coefP = idx.COEF_PARQUEADERO !== undefined ? numCoef(row[idx.COEF_PARQUEADERO]) : 0;
            const etapa = idx.ETAPA !== undefined && row[idx.ETAPA] != null ? String(row[idx.ETAPA]).trim() : '';
            const k = normNombreUnidad(nombre);
            let u = mapa.get(k);
            if (!u) { u = { nombre, etapa, coef: 0, coefP: 0, personas: [], fila: r + 1 }; mapa.set(k, u); orden.push(u); }
            if (coef && !u.coef) u.coef = coef; else if (coef && Math.abs(coef - u.coef) > 1e-9) avisos.push(`«${nombre}» (fila ${r + 1}): trae un coeficiente distinto (${coef}) al de su primera fila (${u.coef}); se usa el de la primera fila.`);
            if (coefP && !u.coefP) u.coefP = coefP;
            if (!u.etapa && etapa) u.etapa = etapa;
            const apDoc = idx.AP_DOC !== undefined && row[idx.AP_DOC] != null ? String(row[idx.AP_DOC]).trim() : '';
            if (apDoc && !u.apoderado) u.apoderado = { documento: apDoc, nombre: idx.AP_NOMBRE !== undefined && row[idx.AP_NOMBRE] != null ? String(row[idx.AP_NOMBRE]).trim() : '', correo: idx.AP_CORREO !== undefined ? tomarPrimero(row[idx.AP_CORREO]) : '', telefono: idx.AP_TEL !== undefined ? tomarPrimero(row[idx.AP_TEL]) : '' };
            if (persona.nombre || persona.documento || persona.correo || persona.telefono) u.personas.push(persona);
        }
        if (!orden.length) return { error: 'El archivo no tiene unidades debajo de los títulos.' };
        // 3) validaciones
        let correosMal = 0, sinCorreo = 0, sinTel = 0, sinCoef = 0, personasTotal = 0;
        const docs = new Map();
        orden.forEach(u => {
            if (!u.coef) { sinCoef++; }
            const p0 = u.personas[0];
            if (!u.personas.some(p => emailValido(p.correo))) sinCorreo++;
            if (!u.personas.some(p => String(p.telefono).replace(/\D/g, '').length >= 7)) sinTel++;
            u.personas.forEach(p => { personasTotal++; if (p.correo && !emailValido(p.correo)) correosMal++; if (p.documento) { if (!docs.has(p.documento)) docs.set(p.documento, []); docs.get(p.documento).push(u.nombre); } });
        });
        const sumaCoef = orden.reduce((s, u) => s + u.coef + u.coefP, 0);
        const repetidosDoc = [...docs.entries()].filter(([, v]) => new Set(v).size > 1).length; // misma persona en varias unidades (normal en apoderados/propietarios de varias)
        const etapas = [...new Set(orden.map(u => u.etapa).filter(Boolean))];
        const conApoderado = orden.filter(u => u.apoderado).length;
        return { unidades: orden, conApoderado, avisos, sumaCoef, sinCorreo, sinTel, sinCoef, correosMal, personasTotal, repetidosDoc, etapas, multiples: orden.filter(u => u.personas.length > 1).length };
    }

    function aplicarCargaUnidades(an, modo) { // modo: 'reemplazar' | 'actualizar'
        let nuevas = 0, actualizadas = 0;
        if (modo === 'reemplazar') { unidades.length = 0; asistencia.length = 0; }
        const porNombre = new Map(unidades.map(u => [normNombreUnidad(u.concatenado), u]));
        let etapasIdx = {};
        an.unidades.forEach(src => {
            let u = porNombre.get(normNombreUnidad(src.nombre));
            const principal = src.personas[0] || { nombre: '', documento: '', correo: '', telefono: '' };
            if (!u) {
                u = { id: (crypto.randomUUID ? crypto.randomUUID() : 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2)), numeroFila: unidades.length + 1, jerarquia: {}, concatenado: src.nombre, tipo: 'residencial', sextoNivelValor: src.etapa || 'general', haVotado: false, votos: {} };
                unidades.push(u); porNombre.set(normNombreUnidad(src.nombre), u); nuevas++;
            } else actualizadas++;
            u.propietario = principal.nombre; u.numeroDocumento = principal.documento; u.correo = principal.correo; u.telefono = principal.telefono;
            u.copropietarios = src.personas.slice(1);
            if (src.apoderado) u.apoderadoPrevio = src.apoderado; else delete u.apoderadoPrevio;
            u.coeficiente = src.coef; u.coeficienteParqueadero = src.coefP; actualizarCoeficienteTotal(u);
            if (src.etapa) { u.jerarquia = Object.assign({}, u.jerarquia, { Etapa: src.etapa }); u.sextoNivelValor = src.etapa; }
            u.jerarquia = Object.assign({}, u.jerarquia, { Unidad: u.numeroFila });
        });
        // Etapas → niveles de agrupación (para QR y listado)
        const nEt = an.etapas.length;
        configConjunto.niveles.forEach(n => { if (n.nombre === 'Etapa') { n.activo = nEt > 0; n.cantidad = nEt; } else if (n.nombre === 'Unidad') { n.activo = true; n.cantidad = Math.max(1, unidades.length); } else if (n.nombre !== 'Etapa' && modo === 'reemplazar') { n.activo = false; n.cantidad = 0; } });
        guardarDatos();
        return { nuevas, actualizadas };
    }

    function descargarPlantillaUnidades() {
        const X = XLSXMini;
        const ejemplo = [
            ['Casa 1', '12345678', 'Juan Pérez', 'juan@correo.com', '3001234567', 1.25, 0.1, 'Etapa 1', '99887766', 'Laura Mora (apoderada)', 'laura@correo.com', '3157778899'],
            ['Casa 2', '23456789', 'María Gómez', 'maria@correo.com', '3109876543', 1.25, 0, 'Etapa 1'],
            ['Casa 2', '34567890', 'Pedro Gómez', 'pedro@correo.com', '3205551234', '', '', 'Etapa 1'],
            ['Lote 1', '45678901', 'Ana Ruiz', 'ana@correo.com', '3011112222', 2.5, 0, 'Etapa 3', '99887766', 'Laura Mora (apoderada)', 'laura@correo.com', '3157778899']
        ];
        const filas = unidades.length ? unidades.flatMap(u => [[u.concatenado, u.numeroDocumento || '', u.propietario || '', u.correo || '', u.telefono || '', u.coeficiente || 0, u.coeficienteParqueadero || 0, (u.jerarquia && u.jerarquia.Etapa) || '', (u.apoderadoPrevio||{}).documento || '', (u.apoderadoPrevio||{}).nombre || '', (u.apoderadoPrevio||{}).correo || '', (u.apoderadoPrevio||{}).telefono || ''],
            ...((u.copropietarios || []).map(c => [u.concatenado, c.documento || '', c.nombre || '', c.correo || '', c.telefono || '', '', '', (u.jerarquia && u.jerarquia.Etapa) || '', '', '', '', '']))]) : ejemplo;
        const rows = [
            [{ v: 'CARGA DE UNIDADES — AdminPH', s: 'titulo' }],
            [{ v: 'Una fila por persona. Si una unidad tiene varios copropietarios, repita el nombre de la UNIDAD en filas seguidas (el coeficiente se escribe solo en la primera). ETAPA es opcional. Las 4 columnas APODERADO_* son opcionales: úselas si un apoderado representa varias unidades (escriba los mismos datos del apoderado en cada una de sus unidades). Borre las filas de ejemplo antes de cargar.', s: 'nota' }],
            [],
            CARGA_ENCABEZADOS.map(h => ({ v: h, s: 'enc' }))
        ];
        filas.forEach(f => rows.push(f.map((v, i) => ({ v, s: (i === 5 || i === 6) ? 'num' : 'celda' }))));
        return X.write([{ name: 'CARGA_UNIDADES', rows, cols: [22, 16, 34, 30, 16, 14, 16, 14, 18, 28, 26, 16], merges: ['A1:L1', 'A2:L2'], heights: { 1: 34 }, freeze: { row: 4 }, landscape: true }])
            .then(b => X.download(b, 'PLANTILLA_CARGA_UNIDADES.xlsx'));
    }

    function htmlCargaRapida() {
        return `<div class="card" id="cargaRapidaCard" style="border-left:6px solid #2d6a4f;">
            <h3>⚡ Carga rápida de unidades desde Excel <small style="font-weight:normal;color:#2d6a4f;">(recomendado)</small></h3>
            <p style="margin-top:0;">Suba un solo Excel con <strong>UNIDAD · DOCUMENTO · PROPIETARIO · CORREO · TELÉFONO · COEFICIENTE · COEF. PARQUEADERO</strong> (y opcionalmente ETAPA). AdminPH crea todas las unidades de una vez, sin armar etapas ni niveles a mano. Si una unidad tiene varios copropietarios, repita la unidad en filas seguidas, una fila por persona, cada uno con su correo y teléfono.</p>
            <div class="form-row" style="align-items:end;gap:8px;flex-wrap:wrap;">
                <button id="crPlantilla" class="btn-secondary">📥 Descargar plantilla${unidades.length ? ' (con las unidades actuales)' : ''}</button>
                <input type="file" id="crArchivo" accept=".xlsx" style="max-width:320px;">
            </div>
            <div id="crVista" style="margin-top:12px;"></div>
        </div>`;
    }

    function activarCargaRapida(root) {
        const puede = puedePrepararAsamblea();
        const $ = (id) => root.querySelector('#' + id);
        $('crPlantilla').onclick = () => descargarPlantillaUnidades().catch(e => alert('No se pudo generar la plantilla: ' + (e.message || e)));
        if (!puede) { $('crArchivo').disabled = true; return; }
        $('crArchivo').onchange = async (ev) => {
            const f = ev.target.files && ev.target.files[0]; if (!f) return;
            const box = $('crVista');
            try {
                const hojas = await XLSXMini.read(await f.arrayBuffer());
                if (!hojas.length) throw new Error('El archivo está vacío.');
                let an = null, errUlt = '';
                for (const h of hojas) { const r = analizarCargaUnidades(h.rows); if (!r.error) { an = r; break; } errUlt = r.error; }
                if (!an) { box.innerHTML = `<div class="summary-bar alerta">${escapeHtml(errUlt)}</div>`; return; }
                const hay = unidades.length > 0;
                const sumaOk = Math.abs(an.sumaCoef - 100) < 0.01;
                const filasHtml = an.unidades.slice(0, 400).map((u, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(u.nombre)}</td><td>${u.etapa ? escapeHtml(u.etapa) : ''}</td><td>${u.personas.map(p => escapeHtml(p.nombre || '(sin nombre)')).join('<br>')}</td><td>${u.personas.map(p => p.correo ? (emailValido(p.correo) ? escapeHtml(p.correo) : `<span style="color:#b71c1c;">${escapeHtml(p.correo)} ✖</span>`) : '<span style="color:#999;">—</span>').join('<br>')}</td><td style="text-align:right;">${u.coef.toFixed(4)}${u.coefP ? ' + ' + u.coefP.toFixed(4) : ''}</td></tr>`).join('');
                box.innerHTML = `
                    <div class="summary-bar ${sumaOk ? 'ok' : 'alerta'}"><strong>${an.unidades.length}</strong> unidades · <strong>${an.personasTotal}</strong> personas (${an.multiples} unidades con varios copropietarios) · suma de coeficientes: <strong>${an.sumaCoef.toFixed(4)}%</strong> ${sumaOk ? '✅' : '⚠️ (debería ser 100)'}${an.etapas.length ? ` · etapas: ${an.etapas.map(escapeHtml).join(', ')}` : ''}${an.conApoderado ? ` · 🤝 ${an.conApoderado} unidades con apoderado (se agrupan en Fase 2 → Apoderados)` : ''}</div>
                    ${(an.sinCorreo || an.sinTel || an.sinCoef || an.correosMal) ? `<div class="summary-bar" style="font-size:13px;margin-top:6px;">${an.sinCoef ? `⚠️ ${an.sinCoef} unidades sin coeficiente · ` : ''}${an.sinCorreo ? `✉️ ${an.sinCorreo} sin correo · ` : ''}${an.sinTel ? `📱 ${an.sinTel} sin teléfono · ` : ''}${an.correosMal ? `✖ ${an.correosMal} correos con formato dudoso` : ''}</div>` : ''}
                    ${an.avisos.length ? `<div class="summary-bar alerta" style="font-size:12px;margin-top:6px;">${an.avisos.slice(0, 6).map(escapeHtml).join('<br>')}${an.avisos.length > 6 ? `<br>… y ${an.avisos.length - 6} avisos más` : ''}</div>` : ''}
                    <div style="max-height:300px;overflow:auto;margin-top:8px;"><table class="data-table" style="width:100%;font-size:12px;"><thead><tr><th>#</th><th>Unidad</th><th>Etapa</th><th>Propietario(s)</th><th>Correo(s)</th><th>Coef.</th></tr></thead><tbody>${filasHtml}</tbody></table></div>
                    ${an.unidades.length > 400 ? '<p style="font-size:12px;">Se muestran las primeras 400 filas.</p>' : ''}
                    ${hay ? `<div style="margin-top:10px;"><label style="display:block;"><input type="radio" name="crModo" value="actualizar" checked style="width:auto;"> <strong>Agregar y actualizar</strong> por nombre de unidad (no borra las que ya existen)</label>
                    <label style="display:block;margin-top:4px;"><input type="radio" name="crModo" value="reemplazar" style="width:auto;"> <strong>Reemplazar todo</strong>: borra las ${unidades.length} unidades actuales y la asistencia registrada, y deja solo las del archivo</label></div>` : ''}
                    <div style="margin-top:10px;"><button id="crAplicar" class="btn-primary">✅ ${hay ? 'Aplicar carga' : 'Crear ' + an.unidades.length + ' unidades'}</button></div>
                    <div id="crFin"></div>`;
                $('crAplicar').onclick = () => {
                    const modo = hay ? (root.querySelector('input[name="crModo"]:checked') || {}).value || 'actualizar' : 'reemplazar';
                    if (modo === 'reemplazar' && hay && !confirm('Se borrarán las unidades actuales y la asistencia, y se cargarán las del archivo.\n\nSi ya hay una asamblea en curso NO haga esto.\n\n¿Continuar?')) return;
                    const r = aplicarCargaUnidades(an, modo);
                    $('crFin').innerHTML = `<div class="summary-bar ok" style="margin-top:10px;">✅ Listo: ${r.nuevas} unidades nuevas y ${r.actualizadas} actualizadas. Siguiente paso: <strong>Fase 1 → 🔗 Servidor y Asamblea → «Enviar unidades al servidor»</strong>.</div>`;
                    $('crAplicar').disabled = true;
                };
            } catch (e) { box.innerHTML = `<div class="summary-bar alerta">No se pudo leer el archivo: ${escapeHtml(e.message || String(e))}. Use un .xlsx (descargue la plantilla).</div>`; }
        };
    }

    // ==================== V3.7 APODERADOS (un solo QR para varias unidades) ====================
    function leerApoderados() { try { const a = JSON.parse(localStorage.getItem('apoderadosAsamblea') || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } }
    function guardarApoderados(a) { try { localStorage.setItem('apoderadosAsamblea', JSON.stringify(a)); } catch (_) { /* nada */ } }
    // 'principal' (lleva el QR) | 'representada' (vota con el QR del principal) | null
    function infoRepresentacion(unitId) {
        for (const g of leerApoderados()) {
            const ids = (g.unidadIds || []).map(String);
            if (!ids.includes(String(unitId)) || ids.length < 2) continue;
            return { tipo: String(g.principalId) === String(unitId) ? 'principal' : 'representada', grupo: g };
        }
        return null;
    }
    // V3.8: un apoderado con varias unidades cuenta como UN votante (sus unidades suman coeficiente).
    function resumenVotantesQR(lista) {
        lista = lista || [];
        const claves = new Set(lista.map(v => { const r = infoRepresentacion(v.unidadId); return r ? 'g' + r.grupo.id : 'u' + v.unidadId; }));
        return lista.length === claves.size ? String(lista.length) : `${claves.size} votante(s) — ${lista.length} unidades`;
    }
    function ordenarUnidadIds(ids) { return ids.slice().sort((a, b) => ((unidades.find(u => u.id === a) || {}).numeroFila || 0) - ((unidades.find(u => u.id === b) || {}).numeroFila || 0)); }
    function coefUnidad(u) { return parseFloat(u && (u.coeficienteTotal || u.coeficiente)) || 0; }
    function nombresCopropietarios(u) { return [u.propietario].concat((u.copropietarios || []).map(c => c.nombre)).map(x => String(x || '').trim()).filter(Boolean).join(' / ') || '(sin nombre registrado)'; }

    function aplicarAsistenciaApoderado(g, presente) {
        (g.unidadIds || []).forEach(id => {
            const a = asistencia.find(x => x.unidadId === id); if (!a) return;
            if (presente !== null) a.presente = presente;
            if (a.presente || presente === true) { a.condicion = 'apoderado'; a.nombreAsistente = g.nombre; a.numeroDocumentoAsistente = g.documento; }
        });
        guardarDatos();
    }
    function revertirAsistenciaUnidad(id) {
        const a = asistencia.find(x => x.unidadId === id), u = unidades.find(x => x.id === id);
        if (a && a.condicion === 'apoderado') { a.condicion = 'propietario'; a.nombreAsistente = a.presente && u ? (u.propietario || '') : ''; a.numeroDocumentoAsistente = a.presente && u ? (u.numeroDocumento || '') : ''; }
    }

    // ==================== V3.8 EVIDENCIA GENERAL DE ASISTENCIA ====================
    function etapaDeUnidad(u) { return String((u && ((u.jerarquia && u.jerarquia.Etapa) || u.sextoNivelValor)) || '').trim(); }
    function datosEvidenciaAsistencia() {
        const cmp = (x, y) => String(x).localeCompare(String(y), 'es', { numeric: true, sensitivity: 'base' });
        const presentes = [];
        for (const a of asistencia) {
            if (!a.presente) continue;
            const u = unidades.find(x => x.id === a.unidadId); if (!u) continue;
            const ap = a.condicion === 'apoderado';
            presentes.push({ unidad: u.concatenado || String(u.numeroFila), etapa: etapaDeUnidad(u), propietario: nombresCopropietarios(u),
                quien: ap ? (a.nombreAsistente || 'Apoderado') : (u.propietario || ''), doc: ap ? (a.numeroDocumentoAsistente || '') : (u.numeroDocumento || ''),
                condicion: ap ? 'Apoderado' : 'Propietario', coef: coefUnidad(u) });
        }
        presentes.sort((p, q) => cmp(p.etapa, q.etapa) || cmp(p.unidad, q.unidad));
        const apos = leerApoderados().map(g => {
            const us = ordenarUnidadIds(g.unidadIds || []).map(id => unidades.find(u => u.id === id)).filter(Boolean);
            const pres = us.filter(u => (asistencia.find(a => a.unidadId === u.id) || {}).presente);
            return { nombre: g.nombre, doc: g.documento, unidades: us.map(u => u.concatenado).join(', '), n: us.length, presentes: pres.length, coef: us.reduce((t, u) => t + coefUnidad(u), 0), coefPresente: pres.reduce((t, u) => t + coefUnidad(u), 0) };
        }).sort((p, q) => cmp(p.nombre, q.nombre));
        const totalCoef = presentes.reduce((t, x) => t + x.coef, 0);
        return { presentes, apos, totalCoef, totalUnidades: unidades.length };
    }
    function htmlEvidenciaAsistencia() {
        const d = datosEvidenciaAsistencia(), fx = n => Number(n).toFixed(4);
        const hayEtapa = d.presentes.some(x => x.etapa);
        let ult = null;
        const filas = d.presentes.map((x, i) => {
            const sep = hayEtapa && x.etapa !== ult ? `<tr style="background:#e8f5e9;font-weight:bold;"><td colspan="6">${x.etapa ? 'Etapa / módulo: ' + escapeHtml(x.etapa) : 'Sin etapa'}</td></tr>` : ''; ult = x.etapa;
            return sep + `<tr><td>${i + 1}</td><td><strong>${escapeHtml(x.unidad)}</strong></td><td>${escapeHtml(x.propietario)}</td><td>${escapeHtml(x.quien)}${x.doc ? ' <small>(' + escapeHtml(x.doc) + ')</small>' : ''}</td><td>${x.condicion === 'Apoderado' ? '📄 Apoderado' : '🏠 Propietario'}</td><td style="text-align:right;">${fx(x.coef)}</td></tr>`;
        }).join('');
        const filasAp = d.apos.map((g, i) => `<tr><td>${i + 1}</td><td><strong>${escapeHtml(g.nombre)}</strong><br><small>Doc. ${escapeHtml(g.doc)}</small></td><td>${escapeHtml(g.unidades)}</td><td style="text-align:center;">${g.presentes}/${g.n}</td><td style="text-align:right;">${fx(g.coefPresente)}</td></tr>`).join('');
        return `<div class="summary-bar ok"><strong>${d.presentes.length}</strong> de ${d.totalUnidades} unidades presentes · coeficiente presente <strong>${fx(d.totalCoef)}%</strong> · ${d.apos.length} apoderado(s)</div>
            <h4>1. Unidades presentes${hayEtapa ? ' (por etapa / módulo)' : ''}</h4>
            <div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:13px;"><thead><tr><th>#</th><th>Unidad</th><th>Copropietario(s)</th><th>Asiste</th><th>Condición</th><th>Coeficiente</th></tr></thead><tbody>${filas || '<tr><td colspan="6">Aún no hay asistentes.</td></tr>'}
            <tr style="font-weight:bold;background:#e8f5e9;"><td></td><td>TOTAL</td><td colspan="3">${d.presentes.length} unidades</td><td style="text-align:right;">${fx(d.totalCoef)}%</td></tr></tbody></table></div>
            <h4 style="margin-top:16px;">2. Apoderados</h4>
            <div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:13px;"><thead><tr><th>#</th><th>Apoderado</th><th>Unidades que representa</th><th>Presentes</th><th>Coef. presente</th></tr></thead><tbody>${filasAp || '<tr><td colspan="5">No hay apoderados registrados.</td></tr>'}</tbody></table></div>`;
    }
    async function descargarEvidenciaAsistencia() {
        const d = datosEvidenciaAsistencia();
        const enc = (a) => a.map(v => ({ v, s: 'enc' }));
        const r1 = [[{ v: `${configConjunto.nombreConjunto || 'Conjunto'} — Evidencia de asistencia`, s: 'titulo' }], [{ v: `Fecha: ${configConjunto.fechaReunion || '—'} · Generado: ${new Date().toLocaleString('es-CO')}`, s: 'nota' }], [], enc(['N°', 'ETAPA / MÓDULO', 'UNIDAD', 'COPROPIETARIO(S)', 'ASISTE', 'DOCUMENTO', 'CONDICIÓN', 'COEFICIENTE (%)'])];
        d.presentes.forEach((x, i) => r1.push([{ v: i + 1, s: 'centro' }, { v: x.etapa, s: 'texto' }, { v: x.unidad, s: 'texto' }, { v: x.propietario, s: 'texto' }, { v: x.quien, s: 'texto' }, { v: x.doc, s: 'texto' }, { v: x.condicion, s: 'texto' }, { v: Math.round(x.coef * 1e6) / 1e6, s: 'num' }]));
        r1.push([{ v: '', s: 'totalTxt' }, { v: '', s: 'totalTxt' }, { v: 'TOTAL', s: 'totalTxt' }, { v: `${d.presentes.length} unidades`, s: 'totalTxt' }, { v: '', s: 'totalTxt' }, { v: '', s: 'totalTxt' }, { v: '', s: 'totalTxt' }, { v: Math.round(d.totalCoef * 1e6) / 1e6, s: 'total' }]);
        const r2 = [[{ v: 'Apoderados', s: 'titulo' }], [], enc(['N°', 'APODERADO', 'DOCUMENTO', 'UNIDADES QUE REPRESENTA', 'PRESENTES', 'COEF. PRESENTE (%)'])];
        d.apos.forEach((g, i) => r2.push([{ v: i + 1, s: 'centro' }, { v: g.nombre, s: 'texto' }, { v: g.doc, s: 'texto' }, { v: g.unidades, s: 'texto' }, { v: `${g.presentes}/${g.n}`, s: 'centro' }, { v: Math.round(g.coefPresente * 1e6) / 1e6, s: 'num' }]));
        const blob = await XLSXMini.write([{ name: 'Asistencia', rows: r1, cols: [6, 18, 16, 40, 30, 16, 14, 16], freeze: { row: 4, col: 0 }, landscape: true }, { name: 'Apoderados', rows: r2, cols: [6, 30, 16, 50, 12, 18], landscape: true }]);
        XLSXMini.download(blob, `EVIDENCIA_ASISTENCIA_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    function renderApoderadosModule(editarId) {
        const content = document.getElementById('mainContent');
        const puede = ROLES[currentUser?.role]?.permissions?.canEditAttendance || false;
        for (const u of unidades) { if (!asistencia.find(a => a.unidadId === u.id)) asistencia.push({ unidadId: u.id, presente: false, nombreAsistente: '', numeroDocumentoAsistente: '', condicion: 'propietario' }); }
        const apos = leerApoderados();
        const ocupadas = new Map(); apos.forEach(g => (g.unidadIds || []).forEach(id => ocupadas.set(String(id), g.id)));
        const edit = editarId ? apos.find(g => g.id === editarId) : null;
        const fx = (n) => Number(n).toFixed(4);
        const totalReps = apos.reduce((s, g) => s + (g.unidadIds || []).length, 0);
        const totalCoef = apos.reduce((s, g) => s + (g.unidadIds || []).reduce((s2, id) => s2 + coefUnidad(unidades.find(u => u.id === id)), 0), 0);
        const precargados = unidades.filter(u => u.apoderadoPrevio && u.apoderadoPrevio.documento && !ocupadas.has(String(u.id)));
        const B = window.AdminPHBridge;

        const tarjetas = apos.map(g => {
            const us = ordenarUnidadIds(g.unidadIds || []).map(id => unidades.find(u => u.id === id)).filter(Boolean);
            const sum = us.reduce((s, u) => s + coefUnidad(u), 0);
            const pres = us.filter(u => (asistencia.find(a => a.unidadId === u.id) || {}).presente).length;
            const princ = unidades.find(u => String(u.id) === String(g.principalId));
            const qrOk = !!(B && princ && B.qrUrlFor && B.qrUrlFor(princ.id));
            return `<div class="card" style="border-left:6px solid #2d6a4f;">
                <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                    <div><h3 style="margin:0;">🤝 ${escapeHtml(g.nombre)} <small style="font-weight:normal;color:#555;">· doc. ${escapeHtml(g.documento)}</small></h3>
                    <div style="font-size:13px;color:#444;margin-top:4px;">${us.length} unidades · coeficiente sumado <strong>${fx(sum)}%</strong> · presentes ${pres}/${us.length}${g.correo ? ' · ✉️ ' + escapeHtml(g.correo) : ''}${g.telefono ? ' · 📱 ' + escapeHtml(g.telefono) : ''}</div></div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:start;">
                        ${puede ? `<button class="btn-primary apoPres" data-id="${escapeHtml(g.id)}">✅ Marcar todas presentes</button><button class="btn-secondary apoAus" data-id="${escapeHtml(g.id)}">⬜ Quitar asistencia</button><button class="btn-secondary apoEdit" data-id="${escapeHtml(g.id)}">✏️ Editar</button><button class="btn-danger apoDel" data-id="${escapeHtml(g.id)}">🗑️ Quitar poder</button>` : ''}
                    </div>
                </div>
                <div class="summary-bar ${qrOk ? 'ok' : ''}" style="margin:8px 0;font-size:13px;">🔳 <strong>Un solo QR</strong>, a nombre del apoderado, asociado a la unidad <strong>${princ ? escapeHtml(princ.concatenado) : '—'}</strong>. ${qrOk ? 'Ya está activo.' : 'Se activa cuando las unidades estén presentes y la asamblea iniciada.'} Al votar, su voto vale por las ${us.length} unidades (${fx(sum)}%). Envíelo desde <strong>📨 Enviar QR</strong>.</div>
                <div style="overflow-x:auto;"><table class="data-table" style="width:100%;font-size:13px;"><thead><tr><th>Unidad</th><th>Copropietario(s) que representa</th><th>Coeficiente</th><th>Asistencia</th></tr></thead><tbody>
                ${us.map(u => `<tr><td><strong>${escapeHtml(u.concatenado)}</strong>${String(u.id) === String(g.principalId) ? ' <small>(lleva el QR)</small>' : ''}</td><td>${escapeHtml(nombresCopropietarios(u))}</td><td style="text-align:right;">${fx(coefUnidad(u))}%</td><td>${(asistencia.find(a => a.unidadId === u.id) || {}).presente ? '🟢 Presente' : '⚪ Ausente'}</td></tr>`).join('')}
                <tr style="font-weight:bold;background:#e8f5e9;"><td>TOTAL</td><td>${us.length} unidades</td><td style="text-align:right;">${fx(sum)}%</td><td></td></tr></tbody></table></div></div>`;
        }).join('');

        const unidadesOrden = unidades.slice().sort((a, b) => String(a.concatenado).localeCompare(String(b.concatenado), 'es', { numeric: true }));
        content.innerHTML = `
            <div class="card"><h2>🤝 Apoderados</h2>
                <p>Un apoderado que representa varias unidades recibe <strong>un solo QR</strong>; su voto se cuenta por cada unidad con la <strong>suma de sus coeficientes</strong>. Aquí registra el poder, ve todas sus unidades en una sola pantalla y marca su asistencia de una vez.</p>
                <div class="summary-bar ok">${apos.length} apoderados · ${totalReps} unidades representadas · coeficiente representado <strong>${fx(totalCoef)}%</strong></div>
            </div>
            ${(precargados.length && puede) ? `<div class="card"><h3>📄 Poderes precargados desde el Excel</h3><p style="margin-top:0;">El archivo de unidades traía apoderado para <strong>${precargados.length}</strong> unidades. Cree los grupos con un clic (no marca asistencia).</p><button id="apoPrecargar" class="btn-primary">⚡ Crear apoderados desde el Excel</button></div>` : ''}
            ${puede ? `<div class="card"><h3>${edit ? '✏️ Editar poder' : '➕ Registrar poder'}</h3>
                <div class="form-row">
                    <div class="form-group"><label>Nombre del apoderado *</label><input id="apoNombre" value="${escapeHtml(edit ? edit.nombre : '')}"></div>
                    <div class="form-group"><label>Documento *</label><input id="apoDoc" value="${escapeHtml(edit ? edit.documento : '')}"></div>
                    <div class="form-group"><label>Correo (para enviarle el QR)</label><input id="apoCorreo" value="${escapeHtml(edit ? edit.correo || '' : '')}"></div>
                    <div class="form-group"><label>Teléfono / WhatsApp</label><input id="apoTel" value="${escapeHtml(edit ? edit.telefono || '' : '')}"></div>
                </div>
                <div class="form-group"><label>Unidades que representa (marque todas) <span id="apoResumen" style="font-weight:normal;color:#2d6a4f;"></span></label>
                    <input id="apoBuscar" placeholder="Buscar unidad o copropietario…" style="margin-bottom:6px;">
                    <div id="apoLista" style="max-height:260px;overflow:auto;border:1px solid #cfd8cf;border-radius:8px;padding:6px;">
                    ${unidadesOrden.map(u => { const oc = ocupadas.get(String(u.id)); const bloq = oc && (!edit || oc !== edit.id); const marcada = edit && (edit.unidadIds || []).includes(u.id);
                        return `<label class="apoFila" data-t="${escapeHtml((u.concatenado + ' ' + nombresCopropietarios(u)).toLowerCase())}" style="display:flex;gap:8px;align-items:center;padding:3px 4px;${bloq ? 'opacity:.45;' : ''}"><input type="checkbox" class="apoChk" value="${escapeHtml(u.id)}" ${marcada ? 'checked' : ''} ${bloq ? 'disabled' : ''} style="width:auto;"> <strong style="min-width:90px;">${escapeHtml(u.concatenado)}</strong> <span style="flex:1;">${escapeHtml(nombresCopropietarios(u))}</span> <span>${fx(coefUnidad(u))}%</span>${bloq ? '<small>(ya tiene apoderado)</small>' : ''}</label>`; }).join('') || '<p>No hay unidades creadas.</p>'}
                    </div></div>
                <label style="display:block;margin:8px 0;"><input type="checkbox" id="apoMarcar" ${edit ? '' : 'checked'} style="width:auto;"> Marcar estas unidades como <strong>presentes</strong> (asistencia por poder)</label>
                <button id="apoGuardar" class="btn-primary">💾 ${edit ? 'Guardar cambios' : 'Registrar poder'}</button> ${edit ? '<button id="apoCancelar" class="btn-secondary">Cancelar</button>' : ''}
                <div id="apoMsg"></div></div>` : ''}
            <h3 style="margin:14px 4px;">Panorámica de apoderados</h3>
            ${tarjetas || '<div class="card"><p>Aún no hay apoderados registrados.</p></div>'}
            <div class="card" id="evidCard"><h3 style="margin-top:0;">📋 Evidencia general de asistencia</h3>
                <p style="margin-top:0;">Listado de las unidades presentes en orden (por etapa/módulo y unidad) y, debajo, los apoderados con las unidades que representan. Sirve como soporte para el acta.</p>
                <button id="evidVer" class="btn-primary">📋 Ver evidencia</button> <button id="evidXls" class="btn-secondary">⬇️ Descargar Excel</button> <button id="evidPrint" class="btn-secondary">🖨️ Imprimir</button>
                <div id="evidBody" style="margin-top:12px;"></div></div>`;

        const $ = (id) => content.querySelector('#' + id);
        const mostrarEvid = () => { $('evidBody').innerHTML = htmlEvidenciaAsistencia(); };
        $('evidVer').onclick = mostrarEvid;
        $('evidXls').onclick = () => descargarEvidenciaAsistencia().catch(e => alert('No se pudo generar el Excel: ' + (e.message || e)));
        $('evidPrint').onclick = () => { mostrarEvid(); setTimeout(() => window.print(), 100); };
        const actualizarResumen = () => {
            const ids = [...content.querySelectorAll('.apoChk:checked')].map(c => c.value);
            const s = ids.reduce((t, id) => t + coefUnidad(unidades.find(u => u.id === id)), 0);
            const r = $('apoResumen'); if (r) r.textContent = ids.length ? `— ${ids.length} marcadas · ${fx(s)}%` : '';
        };
        content.querySelectorAll('.apoChk').forEach(c => c.onchange = actualizarResumen); actualizarResumen();
        $('apoBuscar')?.addEventListener('input', e => { const t = e.target.value.trim().toLowerCase(); content.querySelectorAll('.apoFila').forEach(l => { l.style.display = !t || l.dataset.t.includes(t) ? 'flex' : 'none'; }); });
        $('apoCancelar')?.addEventListener('click', () => renderApoderadosModule());
        $('apoGuardar')?.addEventListener('click', () => {
            const nombre = $('apoNombre').value.trim(), documento = $('apoDoc').value.trim();
            const ids = [...content.querySelectorAll('.apoChk:checked')].map(c => c.value);
            const msg = (t) => { $('apoMsg').innerHTML = `<div class="summary-bar alerta" style="margin-top:8px;">${escapeHtml(t)}</div>`; };
            if (!nombre || !documento) return msg('Escriba el nombre y el documento del apoderado.');
            if (!ids.length) return msg('Marque al menos una unidad.');
            if (apos.some(g => g.documento === documento && (!edit || g.id !== edit.id))) return msg('Ya existe un apoderado con ese documento: edítelo y agregue las unidades allí.');
            const ordenadas = ordenarUnidadIds(ids);
            const g = { id: edit ? edit.id : 'ap_' + Date.now(), nombre, documento, correo: $('apoCorreo').value.trim(), telefono: $('apoTel').value.trim(), unidadIds: ordenadas, principalId: ordenadas[0] };
            if (edit) (edit.unidadIds || []).filter(id => !ids.includes(id)).forEach(revertirAsistenciaUnidad);
            const lista = apos.filter(x => !edit || x.id !== edit.id); lista.push(g); guardarApoderados(lista);
            aplicarAsistenciaApoderado(g, $('apoMarcar').checked ? true : null);
            renderApoderadosModule();
        });
        content.querySelectorAll('.apoEdit').forEach(b => b.onclick = () => renderApoderadosModule(b.dataset.id));
        content.querySelectorAll('.apoPres').forEach(b => b.onclick = () => { const g = apos.find(x => x.id === b.dataset.id); if (g) { aplicarAsistenciaApoderado(g, true); renderApoderadosModule(); } });
        content.querySelectorAll('.apoAus').forEach(b => b.onclick = () => { const g = apos.find(x => x.id === b.dataset.id); if (!g) return; if (!confirm('¿Quitar la asistencia de todas las unidades de este apoderado?')) return; (g.unidadIds || []).forEach(id => { const a = asistencia.find(x => x.unidadId === id); if (a) { a.presente = false; a.nombreAsistente = ''; a.numeroDocumentoAsistente = ''; } }); guardarDatos(); renderApoderadosModule(); });
        content.querySelectorAll('.apoDel').forEach(b => b.onclick = () => { const g = apos.find(x => x.id === b.dataset.id); if (!g) return; if (!confirm(`¿Quitar el poder de ${g.nombre}? Las unidades vuelven a votar cada una con su propio QR.`)) return; (g.unidadIds || []).forEach(revertirAsistenciaUnidad); guardarApoderados(apos.filter(x => x.id !== g.id)); guardarDatos(); renderApoderadosModule(); });
        $('apoPrecargar')?.addEventListener('click', () => {
            const porDoc = new Map(); precargados.forEach(u => { const k = u.apoderadoPrevio.documento; if (!porDoc.has(k)) porDoc.set(k, { ap: u.apoderadoPrevio, ids: [] }); porDoc.get(k).ids.push(u.id); });
            const lista = leerApoderados(); let n = 0;
            porDoc.forEach(({ ap, ids }, doc) => { const ord = ordenarUnidadIds(ids); const ex = lista.find(g => g.documento === doc); if (ex) { ex.unidadIds = ordenarUnidadIds([...new Set([...(ex.unidadIds || []), ...ord])]); ex.principalId = ex.unidadIds[0]; } else { lista.push({ id: 'ap_' + Date.now() + '_' + (n++), nombre: ap.nombre || 'Apoderado', documento: doc, correo: ap.correo || '', telefono: ap.telefono || '', unidadIds: ord, principalId: ord[0] }); } });
            guardarApoderados(lista); renderApoderadosModule();
        });
    }

    function renderQuorumModule() {
    const content = document.getElementById('mainContent');
    const r = calcularQuorum();
    const asistentes = asistencia.filter(a => a.presente === true).length;
    const ausentes = r.total - asistentes;
    const pct = r.total > 0 ? (asistentes / r.total) * 100 : 0;

    content.innerHTML = `
        <div class="card"><h2>📊 Panel de Quórum</h2><p>El quórum se calcula por <strong>coeficientes de copropiedad</strong>, no por número de unidades (Ley 675/2001).</p></div>
        <div class="card">
            <div class="summary-bar">
                <div>🏢 ${escapeHtml(configConjunto.nombreConjunto)}</div>
                <div>📅 ${configConjunto.fechaReunion || 'Sin fecha'}</div>
                <div>📣 Convocatoria: <strong>${etiquetaConvocatoriaActual()}</strong></div><div>📌 Quórum requerido: <strong>${r.requerido}% + 1</strong></div>
            </div>

            <div class="summary-bar ${r.quorumOk ? 'ok' : 'alerta'}">
                <strong>${r.quorumOk ? '✅ QUÓRUM ALCANZADO — Se puede deliberar y votar' : '❌ QUÓRUM NO ALCANZADO — La asamblea solo es INFORMATIVA'}</strong>
            </div>

            <h4 style="margin-top:15px;">📊 Coeficientes de Copropiedad</h4>
            <div class="form-row">
                <div class="form-group"><label>Coef. Total del Conjunto</label><input type="text" value="${r.totalCoeficientes.toFixed(4)}%" readonly style="text-align:center;font-weight:bold;"></div>
                <div class="form-group"><label>Coef. Presentes</label><input type="text" value="${r.coeficientesPresentes.toFixed(4)}%" readonly style="background:#c8e6c9;text-align:center;font-weight:bold;"></div>
                <div class="form-group"><label>Coef. Ausentes</label><input type="text" value="${(r.totalCoeficientes - r.coeficientesPresentes).toFixed(4)}%" readonly style="background:#ffcdd2;text-align:center;font-weight:bold;"></div>
            </div>

            <div style="display:flex;height:40px;border-radius:20px;overflow:hidden;margin:15px 0;background:#e0e0e0;">
                <div style="width:${Math.min(r.pctAsistencia,100)}%;background:${r.quorumOk?'#2d6a4f':'#ff9800'};display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">
                    ${r.pctAsistencia > 0 ? r.pctAsistencia.toFixed(1)+'%' : ''}
                </div>
            </div>

            <div class="form-row">
                <div class="form-group"><label>Unidades Presentes</label><input type="text" value="${r.asistentes} de ${r.total}" readonly style="text-align:center;"></div>
                <div class="form-group"><label>% por Unidades (info)</label><input type="text" value="${r.pctUnidades.toFixed(1)}%" readonly style="text-align:center;"></div>
                <div class="form-group"><label>% por Coeficientes</label><input type="text" value="${r.pctAsistencia.toFixed(4)}%" readonly style="background:${r.quorumOk?'#c8e6c9':'#ffcdd2'};text-align:center;font-weight:bold;font-size:18px;"></div>
            </div>

            <div style="margin-top:12px;"><button class="btn-primary" onclick="document.querySelector('#navMenu [data-module=participacion]')?.click()">📐 Ver coeficiente de participación (asistentes = 100%)</button></div>
            ${!r.quorumOk ? `
                <div class="summary-bar alerta" style="margin-top:15px;">
                    ⚠️ Faltan <strong>${r.faltante.toFixed(4)}%</strong> de coeficientes para alcanzar el quórum del ${r.requerido}% + 1.<br>
                    <small>Sin quórum, la asamblea NO puede tomar decisiones ni votar. Solo se puede levantar un acta informativa.</small>
                </div>
            ` : `
                <div class="summary-bar ok" style="margin-top:15px;">
                    ✅ Puede proceder con la asamblea. Se habilitan las votaciones.
                </div>
            `}
        </div>
    `;
}

    // ==================== ADMIN USUARIOS ====================
    function renderAdminUsersModule() {
        const content = document.getElementById('mainContent');
        if (!puedeGestionarUsuarios()) {
            content.innerHTML = '<div class="card"><div class="summary-bar alerta"><strong>🔒 Acceso restringido</strong><br>Solo el Super Administrador puede crear, cambiar o eliminar usuarios y roles.</div></div>';
            return;
        }
        let users = JSON.parse(localStorage.getItem('ph_users') || JSON.stringify(DEFAULT_USERS));

        content.innerHTML = `
            <div class="card"><h2>👑 Administración de Usuarios</h2></div>
            <div class="card"><h3>➕ Crear Usuario</h3>
                <div class="form-row">
                    <div class="form-group"><label>Usuario</label><input id="newUser"></div>
                    <div class="form-group"><label>Contraseña</label><input id="newPass" value="123"></div>
                    <div class="form-group"><label>Rol</label>
                        <select id="newRole">
                            <option value="admin">Administrador</option>
                            <option value="operador">Operador</option>
                            <option value="usuario">Propietario</option>
                            <option value="invitado">Invitado</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Nombre</label><input id="newName"></div>
                    <div class="form-group"><label>Unidad</label><input id="newUnidad" type="number"></div>
                </div>
                <button id="createUserBtn">➕ Crear</button>
            </div>
            <div class="card"><h3>📋 Usuarios</h3><div id="usersList" class="table-wrapper"></div></div>
        `;

        function renderUsers() {
            const c = document.getElementById('usersList');
            let html = `<table class="data-table"><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Unidad</th><th>QR</th><th>Acción</th></tr></thead><tbody>`;
            for (const [user, data] of Object.entries(users)) {
                if (user !== 'superadmin') {
                    html += `<tr><td>${user}</td><td>${data.name}</td><td>${ROLES[data.role]?.name||data.role}</td><td>${data.unidadAsignada||'-'}</td>
                        <td><button onclick="generarQRUsuario('${user}')" class="btn-secondary">📱</button></td>
                        <td><button onclick="eliminarUsuario('${user}')" class="btn-danger">🗑️</button></td></tr>`;
                }
            }
            html += `</tbody></table>`;
            c.innerHTML = html;
        }
        renderUsers();

        document.getElementById('createUserBtn').onclick = () => {
            if (!puedeGestionarUsuarios()) { alert('🔒 Solo el Super Administrador puede crear usuarios.'); return; }
            const u = document.getElementById('newUser').value;
            const p = document.getElementById('newPass').value;
            const r = document.getElementById('newRole').value;
            const n = document.getElementById('newName').value;
            const un = parseInt(document.getElementById('newUnidad').value);
            if (!u || !p || !n) { alert("Complete campos"); return; }
            if (users[u]) { alert("Ya existe"); return; }
            users[u] = { name: n, role: r, password: p };
            if (un && r === 'usuario') users[u].unidadAsignada = un;
            localStorage.setItem('ph_users', JSON.stringify(users));
            renderAdminUsersModule();
        };

        window.generarQRUsuario = (user) => {
            const url = `${location.origin}${location.pathname}?user=${user}`;
            const modal = document.getElementById('qrModal');
            document.getElementById('modalQrCode').innerHTML = '';
            new QRCode(document.getElementById('modalQrCode'), { text: url, width: 200, height: 200 });
            document.getElementById('modalQrInfo').innerHTML = `Usuario: ${user}`;
            modal.style.display = 'flex';
        };
        window.eliminarUsuario = (user) => {
            if (!puedeGestionarUsuarios()) { alert('🔒 Solo el Super Administrador puede eliminar usuarios.'); return; }
            const objetivo = users[user];
            if (!objetivo) return;
            if (user === 'superadmin') { alert('🔒 El Super Administrador principal está protegido y no puede eliminarse.'); return; }
            if (objetivo.role === 'admin') {
                if (!confirm('El usuario tiene rol de Administrador. ¿Confirma que el Super Administrador desea eliminarlo?')) return;
            } else if (!confirm(`¿Eliminar ${user}?`)) return;
            delete users[user];
            localStorage.setItem('ph_users', JSON.stringify(users));
            renderAdminUsersModule();
        };
    }

    // ==================== MANUAL ====================
    function renderManualModule() {
        document.getElementById('mainContent').innerHTML = `
            <div class="card"><h2>📘 Manual de Usuario</h2></div>
            <div class="card"><h3>🎬 Fases</h3>
                <p><strong>FASE 1:</strong> Configure el conjunto, cargue propietarios.</p>
                <p><strong>FASE 2:</strong> Genere QR, tome asistencia y verifique quórum.</p>
                <p><strong>FASE 3:</strong> Modo Asamblea con votaciones de Presidente y Secretario.</p>
            </div>
            <div class="card"><h3>💰 Coeficientes</h3>
                <p>La suma de coeficientes debe ser 100%. El coeficiente total = unidad + parqueadero.</p>
                <p>Use el módulo <strong>Coeficientes</strong> para gestionar los parqueaderos masivamente.</p>
            </div>
            <div class="card"><h3>🗳️ Votación</h3>
                <p>En el Modo Asamblea se importan automáticamente los asistentes. Si una unidad tiene apoderado, aparecerá el apoderado en lugar del propietario.</p>
            </div>
        `;
    }

    // ==================== MODO ASAMBLEA ====================
    function renderModoAsamblea() {
        const content = document.getElementById('mainContent');

        content.innerHTML = `
            <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                    <div><h2>🎬 Modo Asamblea</h2><p>Orden del día y votaciones en tiempo real</p>${esSoloConsulta() ? '<div class="summary-bar" style="margin-top:8px;font-size:12px;">👁️ Modo consulta: puede seguir el avance, pero no modificar información.</div>' : ''}</div>
                    <div>
                        <button id="manualBtn" class="btn-primary" title="Excel de respaldo para votar en papel o manualmente si falla el QR">📥 Votación manual (Excel)</button>
                        <button id="participacionBtn" class="btn-primary" title="Muestra el coeficiente de cada asistente tomando a los presentes como el 100%">📐 Coef. de participación</button>
                        <button id="cronometroBtn" class="btn-primary" title="Abre una ventana con cronómetro regresivo y aviso sonoro para las intervenciones">⏱️ Cronómetro de intervención</button>
                        ${esAdministrador() ? '<button id="resetOrdenDiaBtn" class="btn-warning">🔄 Resetear</button>' : ''}
                        ${esAdministrador() ? '<button id="salirModoAsambleaBtn" class="btn-secondary">⚙️ Salir</button>' : ''}
                    </div>
                </div>
            </div>
            <div id="votacionAbiertaBanner" style="display:none;"></div>
            <div class="card">
                <h3>📊 Quórum en Tiempo Real</h3>
                <div id="quorumResumen" style="display:flex;gap:15px;flex-wrap:wrap;"></div>
                <div class="progress-bar" style="margin-top:10px;"><div id="quorumBarra" style="height:20px;border-radius:10px;"></div></div>
                <p id="quorumEstado" style="margin-top:10px;text-align:center;font-weight:bold;"></p>
            </div>
            <div class="card">
                <div style="display:flex;justify-content:space-between;margin-bottom:15px;">
                    <h3>📋 Orden del Día</h3>
                    ${esAdministrador() ? '<button id="agregarPuntoBtn" class="btn-secondary" style="padding:4px 12px;">➕ Agregar punto</button>' : ''}
                </div>
                <div id="ordenDelDiaLista"></div>
            </div>
            <div id="actividadContainer" style="display:none;" class="card">
                <div style="display:flex;justify-content:space-between;">
                    <h3 id="actividadTitulo">Actividad</h3>
                    
                </div>
                <div id="actividadContenido"></div>
            </div>
        `;

        document.getElementById('salirModoAsambleaBtn')?.addEventListener('click', () => {
            if (!esAdministrador()) return;
            if (confirm("¿Salir del modo asamblea?")) cambiarFase(1);
        });
        document.getElementById('resetOrdenDiaBtn')?.addEventListener('click', () => {
            if (!esAdministrador()) return;
            if (confirm("¿Resetear el orden del día?")) {
                puntosOrdenDia = [
                    { id: 1, texto: "Verificación del Quórum", activo: true, completado: false, modulo: "quorum" },
                    { id: 2, texto: "Nombramiento presidente de asamblea", activo: true, completado: false, modulo: "presidente" },
                    { id: 3, texto: "Nombramiento secretario de asamblea", activo: true, completado: false, modulo: "secretario" },
                    { id: 4, texto: "Aprobación del orden del día", activo: true, completado: false, modulo: "personalizado" },
                    { id: 5, texto: "Designación comisión verificadora del acta", activo: true, completado: false, modulo: "comite" },
                    { id: 6, texto: "Aprobación del acta anterior", activo: true, completado: false, modulo: "acta" },
                    { id: 7, texto: "Informe de administración y consejo", activo: true, completado: false, modulo: "informe" },
                    { id: 8, texto: "Informe de revisoría fiscal", activo: true, completado: false, modulo: "revisor" },
                    { id: 9, texto: "Aprobación estados financieros", activo: true, completado: false, modulo: "financieros" },
                    { id: 10, texto: "Aprobación presupuesto y cuota", activo: true, completado: false, modulo: "presupuesto" },
                    { id: 11, texto: "Informe jurídico", activo: true, completado: false, modulo: "juridico" },
                    { id: 12, texto: "Nombramiento consejo de administración", activo: true, completado: false, modulo: "consejo" },
                    { id: 13, texto: "Nombramiento comité de convivencia", activo: true, completado: false, modulo: "convivencia" },
                    { id: 14, texto: "Nombramiento revisor fiscal", activo: true, completado: false, modulo: "revisorFiscal" },
                    { id: 15, texto: "Proposiciones y varios", activo: true, completado: false, modulo: "proposiciones" },
                    { id: 16, texto: "Votaciones adicionales (fuera del orden del día)", activo: true, completado: false, modulo: "votacionesExtra", fueraOrdenDia: true },
                    { id: 17, texto: "Cierre de la asamblea", activo: true, completado: false, modulo: "cierre" }
                ];
                contadorPuntos = 18;
                guardarDatos();
                renderOrdenDelDia();
            }
        });
        document.getElementById('participacionBtn')?.addEventListener('click', abrirParticipacionModal);
        document.getElementById('manualBtn')?.addEventListener('click', abrirVotacionManualModal);
        document.getElementById('cronometroBtn')?.addEventListener('click', () => {
            const w = window.open('cronometro.html?min=3&aviso=30', 'AdminPH_Cronometro', 'width=1000,height=720,resizable=yes');
            if (!w) alert('El navegador bloqueó la ventana del cronómetro. Permita ventanas emergentes para AdminPH.');
        });
        document.getElementById('agregarPuntoBtn')?.addEventListener('click', () => {
            if (!esAdministrador()) return;
            dialogoNuevoPunto();
        });
        renderOrdenDelDia();
        actualizarQuorumPanel();
        if (intervaloQuorum) clearInterval(intervaloQuorum);
        intervaloQuorum = setInterval(actualizarQuorumPanel, 2000);
    }

    function actualizarQuorumPanel() {
    const r = calcularQuorum();
    pintarAvisoVotacionAbierta(false);

    const cont = document.getElementById('quorumResumen');
    if (cont) {
        cont.innerHTML = `
            <div style="flex:1;background:#eef5ee;padding:10px;border-radius:10px;text-align:center;">
                <strong>Coef. Total</strong><br>
                <span style="font-size:20px;font-weight:bold;">${r.totalCoeficientes.toFixed(4)}%</span>
            </div>
            <div style="flex:1;background:#c8e6c9;padding:10px;border-radius:10px;text-align:center;">
                <strong>✅ Coef. Presentes</strong><br>
                <span style="font-size:20px;font-weight:bold;">${r.coeficientesPresentes.toFixed(4)}%</span>
            </div>
            <div style="flex:1;background:#ffcdd2;padding:10px;border-radius:10px;text-align:center;">
                <strong>❌ Coef. Ausentes</strong><br>
                <span style="font-size:20px;font-weight:bold;">${(r.totalCoeficientes - r.coeficientesPresentes).toFixed(4)}%</span>
            </div>
            <div style="flex:1;background:#e0e0e0;padding:10px;border-radius:10px;text-align:center;">
                <strong>📊 % Quórum</strong><br>
                <span style="font-size:20px;font-weight:bold;">${r.pctAsistencia.toFixed(2)}%</span>
            </div>
        `;
    }
    const barra = document.getElementById('quorumBarra');
    if (barra) {
        barra.style.width = `${Math.min(r.pctAsistencia,100)}%`;
        barra.style.background = r.quorumOk ? '#2d6a4f' : '#ff9800';
    }
    const est = document.getElementById('quorumEstado');
    if (est) {
        est.innerHTML = r.quorumOk
            ? '✅ QUÓRUM ALCANZADO — Se puede votar'
            : `❌ QUÓRUM NO ALCANZADO — Faltan ${r.faltante.toFixed(4)}% — Asamblea solo informativa`;
        est.style.color = r.quorumOk ? '#2d6a4f' : '#c62828';
    }
}

    function renderOrdenDelDia() {
        const cont = document.getElementById('ordenDelDiaLista');
        if (!cont) return;
        if (asegurarCierreAlFinal()) guardarDatos();
        const activos = puntosOrdenDia.filter(p => p.activo);
        if (activos.length === 0) { cont.innerHTML = '<p style="text-align:center;padding:20px;">No hay puntos activos.</p>'; return; }

        const puedeEditarOrden = esAdministrador();
        let html = `<div class="table-wrapper"><table class="data-table" id="ordenDiaTable"><thead><tr><th>#</th><th>Punto</th><th>Activo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>`;
        activos.forEach((p, index) => {
            const color = p.completado ? '#c8e6c9' : '#fff3e0';
            const text = p.completado ? '✓ Completado' : '⏳ Pendiente';
            html += `<tr data-id="${p.id}" draggable="${puedeEditarOrden && p.modulo!=='cierre' ? 'true' : 'false'}" class="orden-fila">
                <td style="text-align:center;">${index+1}</td>
                <td><strong>${escapeHtml(p.texto)}</strong></td>
                <td style="text-align:center;"><input type="checkbox" class="punto-activo" data-id="${p.id}" ${p.activo?'checked':''} ${!puedeEditarOrden?'disabled':''} style="width:20px;"></td>
                <td style="text-align:center;"><span class="estado-punto" data-id="${p.id}" style="background:${color};padding:6px 12px;border-radius:20px;cursor:pointer;">${text}</span></td>
                <td>
                    <div class="acciones-grid">
                        <button class="btn-secondary abrir-punto" data-id="${p.id}">▶️ Abrir</button>
                        ${(votacionDePunto(p) || p.modulo==='votacionesExtra') ? `<button class="btn-secondary excel-punto" data-id="${p.id}" title="Descargar el Excel de votación manual de este punto">📥 Excel</button><button class="btn-secondary cargar-punto" data-id="${p.id}" title="Cargar el Excel diligenciado de este punto">📤 Cargar</button>` : '<span></span><span></span>'}
                        ${puedeEditarOrden && p.modulo!=='cierre' ? `<button class="btn-danger eliminar-punto-btn" data-id="${p.id}" title="Eliminar este punto">🗑️</button>` : '<span></span>'}
                    </div>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
        cont.innerHTML = html;

        document.querySelectorAll('.punto-activo').forEach(chk => {
            chk.onchange = () => {
                if (!esAdministrador()) { chk.checked = !chk.checked; return; }
                const p = puntosOrdenDia.find(x => x.id === parseInt(chk.dataset.id));
                if (p) { p.activo = chk.checked; guardarDatos(); renderOrdenDelDia(); }
            };
        });

        document.querySelectorAll('.estado-punto').forEach(span => {
            span.style.cursor='default';
            span.title='Estado informativo. Para eliminar un punto use únicamente el botón 🗑️ del listado.';
        });

        document.querySelectorAll('.abrir-punto').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const p = puntosOrdenDia.find(x => x.id === parseInt(btn.dataset.id));
                if (p && p.modulo) abrirActividad(p.modulo, p.texto);
            };
        });

        document.querySelectorAll('.cargar-punto').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const p = puntosOrdenDia.find(x => x.id === parseInt(btn.dataset.id)); if (!p) return;
                const keys = p.modulo === 'votacionesExtra' ? (votacionesExtra || []).filter(v => !v.puntoId).map(v => v.key) : [votacionDePunto(p)];
                abrirVotacionManualModal(keys, true);
            };
        });
        document.querySelectorAll('.excel-punto').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const p = puntosOrdenDia.find(x => x.id === parseInt(btn.dataset.id)); if (!p) return;
                const todas = listarVotacionesManual();
                const keys = p.modulo === 'votacionesExtra' ? (votacionesExtra || []).filter(v => !v.puntoId).map(v => v.key) : [votacionDePunto(p)];
                const sel = todas.filter(v => keys.includes(v.key) && !v.pendiente);
                if (!sel.length) { abrirVotacionManualModal(keys); return; }
                descargarVotacionManual(sel).catch(err => alert('No se pudo generar el Excel: ' + (err.message || err)));
            };
        });
        document.querySelectorAll('.eliminar-punto-btn').forEach(btn => {
            btn.onclick = () => {
                if (!esAdministrador()) return;
                const pt = puntosOrdenDia.find(x => x.id === parseInt(btn.dataset.id));
                if (!pt || pt.modulo === 'cierre') return;
                const key = 'punto_' + pt.id;
                if (pt.tipoPunto === 'votacion' && votacionEstado[key] && votacionEstado[key].abierta) { alert('Cierre la votación de este punto antes de eliminarlo.'); return; }
                if (confirm(pt.tipoPunto === 'votacion' ? "¿Eliminar este punto y los resultados de su votación?" : "¿Eliminar?")) {
                    if (pt.tipoPunto === 'votacion') {
                        try { if (window.AdminPHBridge) window.AdminPHBridge.forgetVoting(key); } catch (e) {}
                        votacionesExtra = votacionesExtra.filter(v => v.key !== key); delete votacionEstado[key]; delete votosQR[key]; delete votacionApertura[key];
                    }
                    puntosOrdenDia = puntosOrdenDia.filter(x => x.id !== pt.id);
                    guardarDatos(); renderOrdenDelDia();
                }
            };
        });

        // Drag & drop
        let dragged = null;
        document.querySelectorAll('.orden-fila').forEach(row => {
            row.ondragstart = (e) => { if (!esAdministrador()) return; dragged = row; e.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); };
            row.ondragend = () => { row.classList.remove('dragging'); dragged = null; };
            row.ondragover = (e) => { if (!esAdministrador()) return; e.preventDefault(); };
            row.ondrop = (e) => {
                if (!esAdministrador()) return;
                e.preventDefault();
                if (dragged && dragged !== row) {
                    const src = parseInt(dragged.dataset.id);
                    const dst = parseInt(row.dataset.id);
                    const si = puntosOrdenDia.findIndex(x => x.id === src);
                    const di = puntosOrdenDia.findIndex(x => x.id === dst);
                    if (si !== -1 && di !== -1) {
                        const [m] = puntosOrdenDia.splice(si, 1);
                        puntosOrdenDia.splice(di, 0, m);
                        asegurarCierreAlFinal();
                        guardarDatos(); renderOrdenDelDia();
                    }
                }
            };
        });
    }


    function renderCierreAsamblea(container) {
        const ahora = new Date();
        const fechaActual = ahora.toLocaleDateString('es-CO', {day:'2-digit', month:'2-digit', year:'numeric'});
        const horaActual = ahora.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
        const registrado = cierreAsamblea && cierreAsamblea.registrado;
        const puedeDesbloquear = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
        container.innerHTML = `
            <div class="summary-bar ${registrado ? 'ok' : ''}">
                <strong>🏁 Cierre de la Asamblea</strong>
                <span>${registrado ? 'La asamblea ya tiene un cierre registrado y sus datos están protegidos.' : 'Registre aquí la fecha y hora exactas en que finaliza la asamblea.'}</span>
            </div>
            <div class="card" style="margin-top:15px;">
                <div class="form-row">
                    <div class="form-group"><label>Fecha de cierre</label><input id="fechaCierreAsamblea" type="text" value="${escapeHtml(registrado ? cierreAsamblea.fecha : fechaActual)}" readonly></div>
                    <div class="form-group"><label>Hora de cierre</label><input id="horaCierreAsamblea" type="text" value="${escapeHtml(registrado ? cierreAsamblea.hora : horaActual)}" readonly></div>
                </div>
                <div style="margin-bottom:10px;"><button type="button" class="btn-secondary" id="verHistorialBtn">📚 Ver asambleas cerradas anteriores</button></div>
                ${!registrado ? '<button id="registrarCierreAsambleaBtn" class="btn-primary">🏁 Consignar fecha y hora de cierre definitivo</button>' : `<div class="summary-bar ok" style="margin-top:12px;"><strong>✅ ASAMBLEA CERRADA DEFINITIVAMENTE</strong><br>Fecha: ${escapeHtml(cierreAsamblea.fecha)} · Hora: ${escapeHtml(cierreAsamblea.hora)}<br><small>Registrado por: ${escapeHtml(cierreAsamblea.cerradoPor||'-')}</small></div>${puedeDesbloquear ? '<button id="autorizarCambioCierreBtn" class="btn-warning" style="margin-top:12px;">🔐 Autorizar modificación excepcional</button>' : ''}`}
            </div>
        `;
        document.getElementById('verHistorialBtn')?.addEventListener('click',abrirHistorialAsambleas);
        document.getElementById('registrarCierreAsambleaBtn')?.addEventListener('click',async()=>{
            if(!await cierreDefinitivoIntegrado()) return;
            renderCierreAsamblea(container); renderOrdenDelDia();
        });
        document.getElementById('autorizarCambioCierreBtn')?.addEventListener('click',()=>solicitarDesbloqueoAsamblea('cierre'));
    }

    function abrirActividad(modulo, titulo) {
        if (asambleaCerrada() && !asambleaEdicionAutorizada && modulo !== 'cierre') {
            const contenidoBloqueo = document.getElementById('actividadContenido');
            const contBloqueo = document.getElementById('actividadContainer');
            if (contenidoBloqueo && contBloqueo) {
                actividadActiva = modulo; actividadActivaId = null;
                document.getElementById('actividadTitulo').textContent = '🔒 Asamblea cerrada';
                contenidoBloqueo.innerHTML = `<div class="summary-bar alerta"><strong>🔒 Punto protegido</strong><br>La asamblea ya fue cerrada. No es posible reabrir ni modificar este punto sin autorización administrativa adicional.</div>${(currentUser?.role==='admin'||currentUser?.role==='superadmin')?'<button id="desbloquearPuntoBtn" class="btn-primary">🔐 Autorizar modificación excepcional</button>':''}`;
                contBloqueo.style.display='block';
                document.getElementById('desbloquearPuntoBtn')?.addEventListener('click',()=>solicitarDesbloqueoAsamblea(modulo));
            }
            return;
        }
        const cont = document.getElementById('actividadContainer');
        const contenido = document.getElementById('actividadContenido');
        const puntoActual = puntosOrdenDia.find(x => x.modulo === modulo && x.texto === titulo && x.activo) || puntosOrdenDia.find(x => x.modulo === modulo && x.activo);
        const activosOrden = puntosOrdenDia.filter(x => x.activo);
        const numeral = puntoActual ? activosOrden.findIndex(x => x.id === puntoActual.id) + 1 : 0;
        document.getElementById('actividadTitulo').innerHTML = `📌 ${numeral ? numeral + '. ' : ''}${escapeHtml(titulo)}`;
        actividadActiva = modulo;
        actividadActivaId = puntoActual ? puntoActual.id : null;
        const modulosVotacion = ['presidente','secretario','comite','ordenDia','acta','financieros','presupuesto','consejo','convivencia','revisorFiscal'];
        if ((modulosVotacion.includes(modulo) && modulo !== 'revisorFiscal') || (String(modulo).startsWith('custom_') && puntoActual && puntoActual.tipoPunto === 'votacion')) {
            const r=calcularQuorum();
            if (!r.quorumOk) {
                contenido.innerHTML=`<div class="summary-bar alerta"><strong>🚫 SIN QUÓRUM</strong><br>El punto puede revisarse, pero las decisiones/votaciones quedan bloqueadas hasta alcanzar el quórum.</div>`;
                agregarBotonContinuar(contenido); cont.style.display='block'; return;
            }
        }
        if (modulo==='presidente' || modulo==='secretario' || modulo==='comite' || modulo==='consejo' || modulo==='convivencia' || modulo==='revisorFiscal') {
            renderVotacionCargo(modulo, contenido);
        } else if (modulo==='quorum') {
            const r=calcularQuorum(); contenido.innerHTML=`<div class="summary-bar"><div>Total: ${r.total}</div><div>Presentes: ${r.asistentes}</div><div>Nominal: ${r.pctUnidades.toFixed(2)}%</div><div>Coeficiente: ${r.pctAsistencia.toFixed(2)}%</div></div><div class="progress-bar"><div style="width:${Math.min(r.pctAsistencia,100)}%;background:#2d6a4f;height:20px"></div></div>`;
            agregarBotonContinuar(contenido);
        } else if (modulo==='personalizado') {
            renderVotacionOpciones('ordenDia', contenido, 'Aprobación del orden del día');
        } else if (modulo==='acta') {
            renderVotacionOpciones('actaAnterior', contenido, 'Aprobación del acta anterior');
        } else if (modulo==='financieros') {
            renderVotacionOpciones('financieros', contenido, 'Aprobación de estados financieros');
        } else if (modulo==='presupuesto') {
            renderPresupuesto(contenido);
        } else if (['informe','revisor','juridico'].includes(modulo)) {
            renderModuloInforme(modulo, titulo, contenido);
        } else if (modulo==='proposiciones') {
            renderProposiciones(contenido);
        } else if (modulo==='votacionesExtra') {
            renderVotacionesExtra(contenido);
        } else if (String(modulo).startsWith('custom_')) {
            renderPuntoPersonalizado(puntoActual || puntosOrdenDia.find(x => x.modulo === modulo), contenido);
        } else if (modulo==='cierre') {
            renderCierreAsamblea(contenido);
        } else {
            contenido.innerHTML=`<p>${escapeHtml(titulo)}</p>`; agregarBotonContinuar(contenido);
        }
        cont.style.display='block';
        if (esSoloConsulta()) protegerVistaConsulta(contenido);
    }

    function protegerVistaConsulta(contenido) {
        if (!contenido || !esSoloConsulta()) return;
        const aplicar = () => {
            contenido.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);
            contenido.querySelectorAll('button').forEach(btn => {
                const esNavegacion = /Punto anterior|Continuar al siguiente|Volver a Votaciones/i.test(btn.textContent || '');
                const esVista = /Abrir reloj en pantalla/i.test(btn.textContent || '');
                if (!esNavegacion && !esVista) btn.disabled = true;
            });
            if (!contenido.querySelector('[data-modo-consulta="1"]')) {
                const aviso=document.createElement('div');
                aviso.dataset.modoConsulta='1';
                aviso.className='summary-bar';
                aviso.style.marginTop='12px';
                aviso.innerHTML='👁️ <strong>Modo consulta:</strong> este perfil puede visualizar el avance, pero no puede modificar datos de la asamblea.';
                contenido.prepend(aviso);
            }
        };
        aplicar();
        if (window._adminPHConsultaObserver) window._adminPHConsultaObserver.disconnect();
        window._adminPHConsultaObserver = new MutationObserver(() => aplicar());
        window._adminPHConsultaObserver.observe(contenido, {childList:true, subtree:true});
    }

    function agregarBotonContinuar(contenido) {
        const wrap=document.createElement('div');
        wrap.style.cssText='display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;margin-top:20px;padding-top:15px;border-top:1px solid #ddd;';
        const anterior=document.createElement('button'); anterior.className='btn-secondary'; anterior.innerHTML='⬅️ Punto anterior';
        anterior.title='Volver al punto anterior sin modificar su estado.';
        anterior.onclick=()=>{
            if(asambleaCerrada() && !asambleaEdicionAutorizada){ solicitarDesbloqueoAsamblea('asamblea'); return; }
            const activos=puntosOrdenDia.filter(x=>x.activo); const p=actividadActivaId!=null ? activos.find(x=>x.id===actividadActivaId) : activos.find(x=>x.modulo===actividadActiva); const idx=p?activos.findIndex(x=>x.id===p.id):-1;
            if(idx>0){ abrirActividad(activos[idx-1].modulo,activos[idx-1].texto); } else { alert('Este es el primer punto activo.'); }
        };
        const siguiente=document.createElement('button'); siguiente.className='btn-primary'; siguiente.innerHTML='➡️ Continuar al siguiente punto';
        siguiente.title=esSoloConsulta() ? 'Avanza al siguiente punto sin modificar su estado.' : 'Marca este punto como completado y continúa. No elimina el punto del listado.';
        siguiente.onclick=()=>{
            if(asambleaCerrada() && !asambleaEdicionAutorizada){ solicitarDesbloqueoAsamblea('asamblea'); return; }
            if(!actividadActiva)return; const p=actividadActivaId!=null ? puntosOrdenDia.find(x=>x.id===actividadActivaId && x.activo) : puntosOrdenDia.find(x=>x.modulo===actividadActiva && x.activo);
            if(!p){alert('No se encontró el punto activo. No se realizó ningún cambio.');return;}
            if(!confirm('¿Marcar este punto como completado y continuar al siguiente?\n\nEl punto NO será eliminado del listado.'))return;
            p.completado=true; guardarDatos(); const activos=puntosOrdenDia.filter(x=>x.activo); const idx=activos.findIndex(x=>x.id===p.id); const sig=idx>=0?activos[idx+1]:null; renderOrdenDelDia();
            if(sig) abrirActividad(sig.modulo,sig.texto); else {document.getElementById('actividadContainer').style.display='none';actividadActiva=null;actividadActivaId=null;alert('✅ Punto completado. No quedan puntos activos por desarrollar.');}
        };
        wrap.appendChild(anterior); wrap.appendChild(siguiente); contenido.appendChild(wrap);
    }

    function detenerTemporizadorVotacion(key){
        if(votacionTemporizadores[key]){ clearInterval(votacionTemporizadores[key]); delete votacionTemporizadores[key]; }
    }

    function cerrarVotacionAutomaticamente(key, rerender){
        const est=votacionEstado[key];
        if(!est || !est.abierta) return;
        const vencio = !!(est.tiempoFin && Date.now() >= est.tiempoFin - 1500);
        est.abierta=false;
        est.tiempoFin=null;
        if (vencio) sonidoVotacion('fin');
        est.votacionCerradaEn=new Date().toISOString();
        capturarGraficoVotacion(key);
        votacionApertura[key]=null;
        guardarDatos();
        detenerTemporizadorVotacion(key);
        if(typeof rerender==='function') rerender();
    }


    // ==================== V3.2: CONTROL DE VOTACIONES ABIERTAS ====================
    let extraAbrirKey = null;
    const MODULO_DE_KEY = { ordenDia: 'personalizado', actaAnterior: 'acta' };
    function tituloVotacionLocal(key) { try { return puenteTituloVotacion(key); } catch (e) { return key; } }
    function votacionesAbiertas() { return Object.keys(votacionEstado).filter(k => votacionEstado[k] && votacionEstado[k].abierta); }
    // Solo puede haber UNA votación abierta a la vez: evita votos cruzados.
    function hayOtraVotacionAbierta(key) {
        const otra = votacionesAbiertas().find(k => k !== key);
        if (!otra) return false;
        alert(`⚠️ YA HAY UNA VOTACIÓN ABIERTA\n\n«${tituloVotacionLocal(otra)}» sigue abierta.\n\nPara evitar votos cruzados, ciérrela primero con el botón «Cerrar ahora» del aviso verde (parte superior de la Fase 3) y luego abra esta.`);
        return true;
    }
    function irAVotacion(key) {
        const ex = (votacionesExtra || []).find(v => v.key === key);
        let modulo;
        if (ex && ex.puntoId) modulo = 'custom_' + ex.puntoId;
        else if (ex) { extraAbrirKey = key; modulo = 'votacionesExtra'; }
        else modulo = MODULO_DE_KEY[key] || key;
        const pt = puntosOrdenDia.find(x => x.modulo === modulo && x.activo) || puntosOrdenDia.find(x => x.modulo === modulo);
        if (pt && document.getElementById('actividadContainer')) abrirActividad(pt.modulo, pt.texto);
    }
    function cerrarVotacionDesdeAviso(key) {
        if (!puedeModificarAsamblea()) { solicitarDesbloqueoAsamblea('asamblea'); return; }
        if (!votacionEstado[key] || !votacionEstado[key].abierta) return;
        if (!confirm(`¿Cerrar ahora la votación «${tituloVotacionLocal(key)}»?\n\nLos resultados quedarán consignados y no podrán alterarse.`)) return;
        cerrarVotacionAutomaticamente(key, null);
        pintarAvisoVotacionAbierta(true);
        alert('🔒 VOTACIÓN CERRADA\n\nLos resultados quedan consignados.');
        irAVotacion(key);
    }
    function pintarAvisoVotacionAbierta(forzar) {
        const box = document.getElementById('votacionAbiertaBanner');
        if (!box) return;
        const abiertas = votacionesAbiertas();
        if (!abiertas.length) { box.style.display = 'none'; box.innerHTML = ''; box.dataset.sig = ''; return; }
        const sig = abiertas.join('|');
        box.style.display = 'block';
        if (forzar || box.dataset.sig !== sig) {
            box.dataset.sig = sig;
            box.innerHTML = abiertas.map(k => `<div class="summary-bar ok" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;border:2px solid #2d6a4f;margin-bottom:8px;"><span>🟢 <strong>VOTACIÓN ABIERTA:</strong> ${escapeHtml(tituloVotacionLocal(k))} · <span class="vt-time" data-k="${escapeHtml(k)}"></span></span><span><button type="button" class="btn-secondary" data-ir-vot="${escapeHtml(k)}">Ir a la votación</button> <button type="button" class="btn-danger" data-cerrar-vot="${escapeHtml(k)}">🔒 Cerrar ahora</button></span></div>`).join('');
            box.onclick = (ev) => {
                const b = ev.target.closest('button'); if (!b) return;
                if (b.dataset.irVot) irAVotacion(b.dataset.irVot);
                if (b.dataset.cerrarVot) cerrarVotacionDesdeAviso(b.dataset.cerrarVot);
            };
        }
        box.querySelectorAll('.vt-time').forEach(el => {
            const e = votacionEstado[el.dataset.k];
            el.textContent = e && e.tiempoFin ? '⏱️ ' + formatearTiempoRestante(e.tiempoFin) : '⏱️ sin límite de tiempo';
        });
    }
    // Vigila las votaciones abiertas (cierra las que vencieron aunque el propietario esté viendo otro punto).
    function vigilarVotaciones() {
        votacionesAbiertas().forEach(k => {
            const e = votacionEstado[k];
            if (e.tiempoFin && Date.now() >= e.tiempoFin) {
                cerrarVotacionAutomaticamente(k, null);
                alert(`⏰ TIEMPO AGOTADO\n\nLa votación «${tituloVotacionLocal(k)}» se cerró automáticamente y los resultados quedan consignados.`);
            }
        });
        pintarAvisoVotacionAbierta(false);
    }

    // ==================== V3.2: ORDEN DEL DÍA (cierre al final, puntos con opciones) ====================
    function asegurarCierreAlFinal() {
        const i = puntosOrdenDia.findIndex(p => p.modulo === 'cierre');
        if (i >= 0 && i !== puntosOrdenDia.length - 1) { const [c] = puntosOrdenDia.splice(i, 1); puntosOrdenDia.push(c); return true; }
        return false;
    }
    function mostrarModal(html, ancho) {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto;';
        ov.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:${ancho || 640}px;width:100%;padding:22px;margin:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);position:relative;"><button type="button" data-cerrar-modal style="position:absolute;top:10px;right:14px;border:0;background:none;font-size:22px;cursor:pointer;">✕</button>${html}</div>`;
        ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-cerrar-modal]')) ov.remove(); });
        document.body.appendChild(ov);
        return ov;
    }
    function dialogoNuevoPunto() {
        const ov = mostrarModal(`<h3 style="margin-top:0">➕ Agregar punto al orden del día</h3>
            <div class="form-group"><label>Nombre del punto</label><input id="npNombre" placeholder="Ej.: Autorización para obras de fachada" style="width:100%"></div>
            <div class="summary-bar" style="margin-top:12px;"><label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" id="npVotacion"> <strong>Este punto tiene una votación</strong></label>
              <div id="npVotBox" style="display:none;margin-top:10px;">
                <div class="form-group"><label>Modalidad</label><select id="npModalidad"><option value="nominal">🗳️ Nominal / QR</option><option value="coeficiente">📊 Por coeficiente / QR</option><option value="manoAlzada">✋ Mano alzada</option></select></div>
                <div class="form-group"><label>Opciones (separadas por coma)</label><input id="npOpciones" value="Sí, No" style="width:100%"></div>
              </div></div>
            <div class="summary-bar" style="margin-top:12px;"><label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" id="npArchivos"> <strong>Permite cargar archivos</strong> (documentos de soporte)</label></div>
            <p style="font-size:13px;color:#5b6b5b;">Todo punto permite además dejar constancias y notas que pasan al acta. El punto «Cierre de la asamblea» siempre queda de último.</p>
            <div style="text-align:right;margin-top:14px;"><button type="button" class="btn-secondary" data-cerrar-modal>Cancelar</button> <button type="button" class="btn-primary" id="npCrear">Crear punto</button></div>`);
        const $ = (id) => ov.querySelector('#' + id);
        $('npVotacion').onchange = () => { $('npVotBox').style.display = $('npVotacion').checked ? 'block' : 'none'; };
        $('npCrear').onclick = () => {
            const nombre = $('npNombre').value.trim();
            if (!nombre) { alert('Escriba el nombre del punto.'); return; }
            const esVot = $('npVotacion').checked;
            let opciones = [];
            if (esVot) {
                opciones = $('npOpciones').value.split(',').map(x => x.trim()).filter(Boolean);
                if (opciones.length < 2) { alert('Una votación necesita al menos dos opciones (separadas por coma).'); return; }
            }
            const id = contadorPuntos++;
            const punto = { id, texto: nombre, activo: true, completado: false, modulo: 'custom_' + id, tipoPunto: esVot ? 'votacion' : 'informativo', permiteArchivos: $('npArchivos').checked, notas: '' };
            if (esVot) {
                const key = 'punto_' + id;
                votacionesExtra.push({ id, key, titulo: nombre, puntoId: id });
                votacionEstado[key] = { candidatos: [], abierta: false, tipoVoto: $('npModalidad').value, modoEntrada: 'manual', votantes: [], tipoQuorum: 'deliberatorio', porcentajeQuorum: 50, duracionMinutos: 5,
                    opciones: opciones.map(n => ({ nombre: n, votosNominal: 0, votosCoeficiente: 0, votosManoAlzada: 0 })) };
                votosQR[key] = []; votacionApertura[key] = null;
            }
            const ic = puntosOrdenDia.findIndex(p => p.modulo === 'cierre');
            if (ic >= 0) puntosOrdenDia.splice(ic, 0, punto); else puntosOrdenDia.push(punto);
            guardarDatos(); renderOrdenDelDia(); ov.remove();
        };
        setTimeout(() => $('npNombre').focus(), 50);
    }
    function renderPuntoPersonalizado(p, container) {
        if (!p) { container.innerHTML = '<p>Punto no encontrado.</p>'; return; }
        container.innerHTML = `<div class="summary-bar"><strong>${escapeHtml(p.texto)}</strong></div>
            <div id="cpVot"></div>
            <div class="form-group" style="margin-top:14px;"><label>📝 Constancias, notas o proposiciones de este punto (pasan al acta)</label>
              <textarea id="cpNotas" rows="6" style="width:100%;resize:vertical" placeholder="Escriba aquí lo que debe quedar consignado en el acta.">${escapeHtml(p.notas || '')}</textarea>
              <button type="button" class="btn-primary" id="cpGuardar" style="margin-top:8px;">💾 Guardar notas</button> <span id="cpOk" style="color:#2d6a4f;font-weight:bold;"></span></div>
            <div id="cpArch"></div>`;
        document.getElementById('cpGuardar').onclick = () => { p.notas = document.getElementById('cpNotas').value; guardarDatos(); document.getElementById('cpOk').textContent = '✅ Guardado'; };
        if (p.tipoPunto === 'votacion') {
            const key = 'punto_' + p.id;
            if (votacionEstado[key]) renderVotacionOpciones(key, document.getElementById('cpVot'), p.texto, true);
        }
        if (p.permiteArchivos) renderModuloInforme(p.modulo, p.texto, document.getElementById('cpArch'), true);
        agregarBotonContinuar(container);
    }

    // ==================== V3.2: HISTORIAL DE ASAMBLEAS CERRADAS ====================
    function leerHistorial() { try { const h = JSON.parse(localStorage.getItem('adminph_historial') || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; } }
    function construirResumenAsamblea() {
        const r = calcularQuorum();
        const valor = (e, o) => e.tipoVoto === 'manoAlzada' ? (o.votosManoAlzada || 0) : e.tipoVoto === 'coeficiente' ? (o.votosCoeficiente || 0) : (o.votosNominal || 0);
        const votacionesRes = [];
        Object.keys(votacionEstado).forEach(k => {
            const e = votacionEstado[k]; if (!e) return;
            const lista = (e.opciones && e.opciones.length) ? e.opciones : (e.candidatos || []);
            if (!lista.length) return;
            const total = lista.reduce((a, o) => a + valor(e, o), 0);
            if (!total && !e.votacionCerradaEn) return;
            votacionesRes.push({ titulo: tituloVotacionLocal(k), modalidad: e.tipoVoto === 'manoAlzada' ? 'Mano alzada' : e.tipoVoto === 'coeficiente' ? 'Por coeficiente' : 'Nominal / QR', cerrada: !e.abierta, opciones: lista.map(o => ({ nombre: o.nombre, votos: valor(e, o) })) });
        });
        const asistentes = (asistencia || []).filter(a => a.presente).map(a => {
            const u = unidades.find(x => x.id === a.unidadId) || {};
            return { unidad: u.concatenado || u.nombre || String(a.unidadId), nombre: a.nombreAsistente || '', coeficiente: parseFloat(u.coeficienteTotal) || parseFloat(u.coeficiente) || 0 };
        });
        const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
        return {
            cierre: Object.assign({}, cierreAsamblea),
            quorum: { pct: r.pctAsistencia, coefPresentes: r.coeficientesPresentes, coefTotal: r.totalCoeficientes, presentes: r.asistentes, total: r.total },
            asistentes, votaciones: votacionesRes,
            puntos: puntosOrdenDia.filter(p => p.activo).map(p => ({ texto: p.texto, completado: !!p.completado, notas: p.notas || '', archivos: archivosAsamblea.filter(a => a.punto === p.modulo).map(a => a.nombre) })),
            proposiciones: leer('proposicionesAsamblea'), varios: leer('variosInformativosAsamblea')
        };
    }
    function archivarAsambleaActual() {
        try {
            const B = window.AdminPHBridge; const st = (B && B.state && B.state()) || {};
            const hist = leerHistorial();
            const entry = Object.assign({ id: 'h' + Date.now(), asambleaId: st.assemblyId || null, nombre: st.assemblyName || 'Asamblea', archivadaEn: new Date().toISOString() }, construirResumenAsamblea());
            const i = entry.asambleaId ? hist.findIndex(h => h.asambleaId === entry.asambleaId) : -1;
            if (i >= 0) { entry.id = hist[i].id; hist[i] = entry; } else hist.unshift(entry);
            localStorage.setItem('adminph_historial', JSON.stringify(hist));
        } catch (e) { console.warn('No se pudo archivar la asamblea', e); }
    }
    function htmlDetalleHistorial(h) {
        const f = (d) => { try { return new Date(d).toLocaleString('es-CO'); } catch (e) { return d; } };
        const q = h.quorum || {};
        return `<h3 style="margin-top:0">${escapeHtml(h.nombre)}</h3>
            <p><strong>Cierre:</strong> ${escapeHtml((h.cierre && h.cierre.fecha) || '—')} ${escapeHtml((h.cierre && h.cierre.hora) || '')} · <strong>Cerró:</strong> ${escapeHtml((h.cierre && h.cierre.cerradoPor) || '—')}<br><small>Archivada: ${escapeHtml(f(h.archivadaEn))}</small></p>
            <div class="summary-bar"><strong>Quórum:</strong> ${Number(q.pct || 0).toFixed(2)}% del coeficiente · ${q.presentes || 0} de ${q.total || 0} unidades presentes</div>
            <h4>Votaciones</h4>${(h.votaciones || []).map(v => `<div class="summary-bar" style="margin:6px 0;"><strong>${escapeHtml(v.titulo)}</strong> — ${escapeHtml(v.modalidad)} — ${v.cerrada ? '🔒 Cerrada' : '🟢 Abierta'}<br>${v.opciones.map(o => `${escapeHtml(o.nombre)}: <strong>${Number.isInteger(o.votos) ? o.votos : Number(o.votos).toFixed(4)}</strong>`).join(' · ')}</div>`).join('') || '<p>Sin votaciones registradas.</p>'}
            <h4>Orden del día</h4><ol>${(h.puntos || []).map(p => `<li>${escapeHtml(p.texto)} ${p.completado ? '✓' : ''}${p.notas ? `<div style="font-size:13px;color:#444;white-space:pre-wrap;">${escapeHtml(p.notas)}</div>` : ''}${(p.archivos || []).length ? `<div style="font-size:12px;">📎 ${p.archivos.map(escapeHtml).join(', ')}</div>` : ''}</li>`).join('')}</ol>
            <h4>Proposiciones y varios</h4>${[...(h.proposiciones || []), ...(h.varios || [])].map(x => `<div class="summary-bar" style="margin:6px 0;"><strong>${escapeHtml(x.titulo || '')}</strong><br>${escapeHtml(x.detalle || '')}<br><small>Unidad: ${escapeHtml(x.unidad || '-')}</small></div>`).join('') || '<p>Ninguno.</p>'}
            <h4>Asistentes (${(h.asistentes || []).length})</h4><div style="font-size:13px;columns:2;">${(h.asistentes || []).map(a => `${escapeHtml(a.unidad)} — ${escapeHtml(a.nombre)} (${Number(a.coeficiente).toFixed(4)}%)`).join('<br>')}</div>`;
    }
    function abrirHistorialAsambleas() {
        const hist = leerHistorial();
        const ov = mostrarModal(`<h3 style="margin-top:0">📚 Asambleas cerradas</h3>
            ${hist.length ? `<div class="form-group"><label>Elija una asamblea para revisarla (solo lectura)</label><select id="histSel" style="width:100%"><option value="">— Seleccionar —</option>${hist.map(h => `<option value="${escapeHtml(h.id)}">${escapeHtml(h.nombre)} — cierre ${escapeHtml((h.cierre && h.cierre.fecha) || '')}</option>`).join('')}</select></div><div id="histDet"></div><div id="histAcc" style="text-align:right;margin-top:10px;"></div>` : '<p>Todavía no hay asambleas cerradas. Al hacer el «cierre definitivo» de una asamblea, queda guardada aquí para consultarla.</p>'}`, 820);
        const sel = ov.querySelector('#histSel'); if (!sel) return;
        sel.onchange = () => {
            const h = hist.find(x => x.id === sel.value);
            ov.querySelector('#histDet').innerHTML = h ? htmlDetalleHistorial(h) : '';
            ov.querySelector('#histAcc').innerHTML = h ? '<button type="button" class="btn-secondary" id="histPrint">🖨️ Imprimir / guardar PDF</button>' : '';
            const b = ov.querySelector('#histPrint');
            if (b) b.onclick = () => { const w = window.open('', '_blank'); if (!w) return; w.document.write(`<html><head><meta charset="utf-8"><title>${escapeHtml(h.nombre)}</title><style>body{font-family:Arial;padding:24px;font-size:14px}.summary-bar{background:#eef5ee;padding:8px 12px;border-radius:8px}</style></head><body>${htmlDetalleHistorial(h)}</body></html>`); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); };
        };
    }

    let ventanaRelojVotacion = null;

    // V3.2: avisos sonoros de la cuenta regresiva de cada votación (30 s finales y fin de tiempo).
    let _ctxSonidoVot = null; const _avisoSonadoVot = {};
    function sonidoVotacion(tipo) {
        try {
            _ctxSonidoVot = _ctxSonidoVot || new (window.AudioContext || window.webkitAudioContext)();
            const c = _ctxSonidoVot; if (c.state === 'suspended') c.resume();
            const tono = (f, d, delay, v) => { const t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + d + 0.05); };
            if (tipo === 'aviso') { tono(880, 0.25, 0, 0.5); tono(880, 0.25, 0.4, 0.5); tono(1174, 0.4, 0.8, 0.55); }
            else { tono(523, 0.5, 0, 0.6); tono(392, 0.5, 0.6, 0.6); tono(262, 1.2, 1.2, 0.65); }
        } catch (e) { /* sin audio: no pasa nada */ }
    }
    function actualizarRelojVotacionVisual(key, texto, ms) {
        const estT = votacionEstado[key];
        if (estT && estT.tiempoFin && ms > 0 && ms <= 30000 && _avisoSonadoVot[key] !== estT.tiempoFin) { _avisoSonadoVot[key] = estT.tiempoFin; sonidoVotacion('aviso'); }
        const el=document.getElementById(`timer_${key}`);
        if(el){
            el.textContent=`⏱️ ${texto}`;
            el.classList.toggle('timer-urgente', ms <= 30000);
        }
        try {
            if(ventanaRelojVotacion && !ventanaRelojVotacion.closed){
                const reloj=ventanaRelojVotacion.document.getElementById('relojGrande');
                if(reloj){ reloj.textContent=texto; reloj.className=ms<=30000?'urgente':''; }
                const estado=ventanaRelojVotacion.document.getElementById('estadoReloj');
                if(estado) estado.textContent=ms<=30000?'⚠️ ¡ÚLTIMOS SEGUNDOS!':'VOTACIÓN EN CURSO';
            }
        } catch(e) {}
    }

    function abrirRelojVotacion(key){
        const est=votacionEstado[key];
        if(!est || !est.abierta || !est.tiempoFin){
            alert('Primero debe abrir la votación para mostrar el reloj.');
            return;
        }
        ventanaRelojVotacion=window.open('', 'AdminPH_RelojVotacion', 'width=900,height=650,resizable=yes');
        if(!ventanaRelojVotacion){ alert('El navegador bloqueó la ventana del reloj. Permita ventanas emergentes para AdminPH.'); return; }
        ventanaRelojVotacion.document.open();
        ventanaRelojVotacion.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>AdminPH — Reloj de votación</title><style>body{margin:0;background:#111;color:#fff;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}.box{width:90%;max-width:850px;padding:40px}.titulo{font-size:30px;font-weight:700;margin-bottom:20px}.reloj{font-size:150px;font-weight:900;letter-spacing:4px;line-height:1.05}.estado{font-size:28px;margin-top:24px}.urgente{animation:parpadeo .8s infinite}@keyframes parpadeo{50%{opacity:.35}}small{display:block;margin-top:35px;font-size:16px;opacity:.7}</style></head><body><div class="box"><div class="titulo">⏱️ TIEMPO RESTANTE</div><div id="relojGrande" class="reloj">00:00</div><div id="estadoReloj" class="estado">VOTACIÓN EN CURSO</div><small>AdminPH · Pantalla pública de votación</small></div></body></html>`);
        ventanaRelojVotacion.document.close();
        actualizarRelojVotacionVisual(key, formatearTiempoRestante(est.tiempoFin), Math.max(0,est.tiempoFin-Date.now()));
        try{ ventanaRelojVotacion.focus(); }catch(e){}
    }

    function formatearTiempoRestante(tiempoFin){
        const sec=Math.max(0,Math.ceil((tiempoFin-Date.now())/1000));
        const h=Math.floor(sec/3600); const m=Math.floor((sec%3600)/60); const s=sec%60;
        return h>0 ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    function iniciarTemporizadorVotacion(key, rerender){
        detenerTemporizadorVotacion(key);
        const est=votacionEstado[key];
        if(!est.abierta || !est.tiempoFin) return;
        const tick=()=>{
            if(!est.abierta){detenerTemporizadorVotacion(key);return;}
            if(Date.now()>=est.tiempoFin){
                cerrarVotacionAutomaticamente(key, rerender);
                alert('⏰ TIEMPO AGOTADO\n\nLa votación se ha cerrado automáticamente y los resultados quedan consignados.');
                return;
            }
            const ms=Math.max(0,est.tiempoFin-Date.now());
            actualizarRelojVotacionVisual(key, formatearTiempoRestante(est.tiempoFin), ms);
        };
        tick();
        votacionTemporizadores[key]=setInterval(tick,1000);
    }

    function prepararTemporizadorDesdeInput(key){
        const est=votacionEstado[key];
        const minutos=Math.max(1,parseInt(document.getElementById(`dur_${key}`)?.value)||est.duracionMinutos||5);
        est.duracionMinutos=minutos;
        est.tiempoFin=Date.now()+minutos*60000;
        votacionApertura[key]=Date.now();
    }

    // Todas las votaciones manuales quedan limitadas por la cantidad de asistentes presentes.
    // Las votaciones adicionales también usan esta misma regla.
    function sinLimiteAsistentesManoAlzada(key){
        return false;
    }

    function limiteVotosManoAlzada(key){
        const r=calcularQuorum();
        return Math.max(0, parseInt(r.asistentes)||0);
    }

    function validarTotalManoAlzada(key){
        const est=votacionEstado[key];
        const limite=limiteVotosManoAlzada(key);
        if (sinLimiteAsistentesManoAlzada(key)) return {ok:true,total:0,limite:Infinity};
        let total=0;
        if(est && Array.isArray(est.opciones) && est.opciones.length) total=est.opciones.reduce((s,o)=>s+(parseInt(o.votosManoAlzada)||0),0);
        else if(est && Array.isArray(est.candidatos)) total=est.candidatos.reduce((s,c)=>s+(parseInt(c.votosManoAlzada)||0),0);
        return {ok:total<=limite,total,limite};
    }

    function validarLimiteAntesDeAbrir(key){
        const est=votacionEstado[key];
        if(!est || est.tipoVoto!=='manoAlzada') return {ok:true,total:0,limite:limiteVotosManoAlzada(key)};
        return validarTotalManoAlzada(key);
    }

    function renderVotacionOpciones(key, container, titulo, sinNavegacion=false) {
        const est = votacionEstado[key];
        if (!est.opciones || !Array.isArray(est.opciones)) est.opciones=[{nombre:'Sí',votosNominal:0,votosCoeficiente:0,votosManoAlzada:0},{nombre:'No',votosNominal:0,votosCoeficiente:0,votosManoAlzada:0}];
        est.tipoVoto=est.tipoVoto||'nominal';
        est.duracionMinutos=parseInt(est.duracionMinutos)||5;
        const esMano=est.tipoVoto==='manoAlzada';
        const esCoef=est.tipoVoto==='coeficiente';
        const estadoTexto=est.abierta?'🟢 VOTACIÓN ABIERTA':'🔴 VOTACIÓN CERRADA';
        let h=`<div class="summary-bar"><strong>🗳️ ${escapeHtml(titulo)}</strong><span>Opciones: ${est.opciones.length}</span></div>
        <div class="form-row votacion-config-row" style="margin-bottom:12px;">
          <div class="form-group"><label>Modalidad de votación</label><select id="modVoto_${key}" ${est.abierta?'disabled':''}>
            <option value="nominal" ${!esMano&&!esCoef?'selected':''}>🗳️ Votación nominal / QR</option>
            <option value="coeficiente" ${esCoef?'selected':''}>📊 Votación por coeficiente / QR</option>
            <option value="manoAlzada" ${esMano?'selected':''}>✋ Votación a mano alzada</option>
          </select></div>
          <div class="form-group"><label>Tiempo de votación (minutos)</label><input id="dur_${key}" type="number" min="1" max="120" step="1" value="${est.duracionMinutos}" ${est.abierta?'disabled':''}></div>
        </div>
        ${htmlSelectorQuorumVotacion(key, est)}
        <div id="timer_${key}" class="votacion-timer" style="${est.abierta?'':'display:none;'}">${est.abierta?'⏱️ 00:00':''}</div>
        <button type="button" class="btn-secondary" onclick="abrirRelojVotacion('${key}')" style="margin:8px 0 12px;font-size:15px;">🖥️ Abrir reloj en pantalla</button><div class="summary-bar" style="font-size:12px;">⚠️ <strong>Restricción de votación:</strong> por QR solo pueden votar unidades registradas como presentes en la asistencia. En votación a mano alzada, la suma de votos no puede superar los ${limiteVotosManoAlzada(key)} asistentes presentes.</div>
        <div id="opciones_${key}">`;
        est.opciones.forEach((o,i)=>{
          const v=esMano?(o.votosManoAlzada||0):(esCoef?(o.votosCoeficiente||0):(o.votosNominal||0));
          h+=`<div class="votacion-opcion-row"><div class="votacion-opcion-nombre"><label>Opción ${i+1}</label><input class="op-nombre" data-i="${i}" value="${escapeHtml(o.nombre)}" ${est.abierta?'disabled':''}></div>
          ${esMano?`<div class="votacion-opcion-votos"><label>✋ Votos</label><input type="number" min="0" step="1" class="op-mano" data-i="${i}" value="${o.votosManoAlzada||0}" max="${limiteVotosManoAlzada(key)}" inputmode="numeric"></div>`:`<div class="votacion-opcion-votos"><label>Votos registrados</label><strong>${esCoef?v.toFixed(4):v} votos</strong></div>`}</div>`;
        });
        h+=`</div><div style="margin-top:12px;">
          <button class="btn-secondary" id="addOpt_${key}" ${est.abierta?'disabled':''}>➕ Agregar opción</button>
          <button class="btn-primary" id="openOpt_${key}" style="margin-left:8px" ${est.abierta?'disabled':''}>▶️ Abrir votación</button>
          <button class="btn-danger" id="closeOpt_${key}" style="margin-left:8px" ${!est.abierta?'disabled':''}>🔒 Cerrar votaciones</button>
          <span style="margin-left:10px;padding:7px 12px;border-radius:16px;font-weight:bold;">${estadoTexto}</span></div>
          <div id="resOpt_${key}" style="margin-top:15px"></div>`;
        container.innerHTML=h;
        document.getElementById(`modVoto_${key}`).onchange=e=>{if(est.abierta)return;est.tipoVoto=e.target.value;guardarDatos();renderVotacionOpciones(key,container,titulo);};
        document.getElementById(`dur_${key}`).onchange=e=>{est.duracionMinutos=Math.max(1,parseInt(e.target.value)||5);guardarDatos();};
        container.querySelectorAll('.op-nombre').forEach(inp=>inp.onchange=()=>{est.opciones[+inp.dataset.i].nombre=inp.value.trim()||`Opción ${+inp.dataset.i+1}`;guardarDatos();});
        container.querySelectorAll('.op-mano').forEach(inp=>inp.onchange=()=>{const idx=+inp.dataset.i;const anterior=est.opciones[idx].votosManoAlzada||0;const valor=Math.max(0,parseInt(inp.value)||0);est.opciones[idx].votosManoAlzada=valor;const v=validarTotalManoAlzada(key);if(!v.ok){est.opciones[idx].votosManoAlzada=anterior;inp.value=anterior;alert(`⚠️ LÍMITE DE VOTACIÓN

La suma de votos a mano alzada no puede superar el número de asistentes presentes (${v.limite}).

Votos registrados: ${v.total}.`);return;}guardarDatos();renderResultadosOpciones(key);});
        document.getElementById(`addOpt_${key}`).onclick=()=>{est.opciones.push({nombre:`Opción ${est.opciones.length+1}`,votosNominal:0,votosCoeficiente:0,votosManoAlzada:0});guardarDatos();renderVotacionOpciones(key,container,titulo);};
        document.getElementById(`openOpt_${key}`).onclick=()=>{if(!puedeModificarAsamblea()){solicitarDesbloqueoAsamblea('asamblea');return;}if(hayOtraVotacionAbierta(key))return;const lim=validarLimiteAntesDeAbrir(key);if(!lim.ok){alert(`⚠️ LÍMITE DE VOTACIÓN\n\nLa suma de votos a mano alzada (${lim.total}) supera el número de asistentes presentes (${lim.limite}).\n\nCorrija los votos antes de abrir la votación.`);return;}prepararTemporizadorDesdeInput(key);est.abierta=true;est.votantes=[];guardarDatos();renderVotacionOpciones(key,container,titulo);iniciarTemporizadorVotacion(key,()=>renderVotacionOpciones(key,container,titulo));};
        configurarSelectorQuorumVotacion(key, est, ()=>renderVotacionOpciones(key,container,titulo));
        document.getElementById(`closeOpt_${key}`).onclick=()=>{if(!puedeModificarAsamblea()){solicitarDesbloqueoAsamblea('asamblea');return;}if(!est.abierta)return;cerrarVotacionAutomaticamente(key,()=>renderVotacionOpciones(key,container,titulo));alert('🔒 VOTACIONES CERRADAS\n\nLos resultados quedan consignados.');};
        renderResultadosOpciones(key);
        if(!sinNavegacion) agregarBotonContinuar(container);
        if(est.abierta) iniciarTemporizadorVotacion(key,()=>renderVotacionOpciones(key,container,titulo,sinNavegacion));
    }
    function renderResultadosOpciones(key){
        const e=votacionEstado[key]; const r=document.getElementById(`resOpt_${key}`) || document.getElementById(key==='presupuesto'?'presRes':`resOpt_${key}`); if(!r)return;
        const esMano=e.tipoVoto==='manoAlzada', esCoef=e.tipoVoto==='coeficiente';
        const vals=e.opciones.map(o=>esMano?(o.votosManoAlzada||0):(esCoef?(o.votosCoeficiente||0):(o.votosNominal||0)));
        const total=vals.reduce((a,b)=>a+b,0);
        const q=resumenQuorumVotacion(e);
        r.innerHTML=e.opciones.map((o,i)=>{const v=vals[i],pct=total?(v/total*100):0;return `<div class="summary-bar" style="margin:5px 0"><strong>${escapeHtml(o.nombre)}</strong>: <span class="voto-grande">${esCoef?v.toFixed(4):v}</span> votos <span style="float:right">${pct.toFixed(1)}%</span></div>`}).join('')+
            `<div class="summary-bar" style="margin-top:8px"><strong>Modalidad:</strong> ${esMano?'✋ Mano Alzada':esCoef?'📊 Por Coeficiente':'🗳️ Nominal / QR'} &nbsp; <strong>Total:</strong> <span class="voto-grande">${esCoef?total.toFixed(4):total}</span></div>`+
            `<div class="summary-bar ${q.aprobado?'ok':'alerta'}" style="margin-top:8px"><strong>⚖️ Quórum ${q.tipo==='decisorio'?'decisorio':'deliberatorio'}:</strong> ${q.porcentaje}% de ${q.esCoef ? Number(q.base).toFixed(4)+' coeficientes presentes' : q.asistentes+' asistentes presentes'} = <strong>${q.esCoef ? Number(q.votosRequeridos).toFixed(4) : q.votosRequeridos}</strong> ${q.esCoef?'de coeficiente favorable':'votos favorables'} requeridos. <strong>Favorables: ${esCoef?q.favorables.toFixed(4):q.favorables}</strong> · ${q.aprobado?'✅ APROBADA':'❌ NO ALCANZA EL UMBRAL'}</div>` + (e.graficoResultado ? generarGraficoVotacionHTML(e.graficoResultado, 'Resultado final') : '');
    }

    function renderModuloInforme(modulo,titulo,container,sinNav){
        const existentes=archivosAsamblea.filter(a=>a.punto===modulo);
        container.innerHTML=`<p>📎 Adjunte los documentos que se utilizarán durante la exposición de <strong>${escapeHtml(titulo)}</strong>.</p><input type="file" id="archivo_${modulo}" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp,.odt,.ods,.odp"><div id="listaArch_${modulo}" style="margin-top:15px"></div>`;
        const lista=document.getElementById(`listaArch_${modulo}`);
        function pintar(){lista.innerHTML=archivosAsamblea.filter(a=>a.punto===modulo).map((a,i)=>`<div class="summary-bar" style="display:flex;justify-content:space-between;align-items:center;margin:6px 0"><span>📄 <a href="#" class="abrir-arch" data-id="${a.id}" style="font-weight:700;color:#2d6a4f;">${escapeHtml(a.nombre)}</a></span><span><button class="btn-secondary abrir-arch" data-id="${a.id}">Abrir</button> <button class="btn-danger del-arch" data-id="${a.id}">🗑️</button></span></div>`).join('')||'<p>No hay archivos adjuntos.</p>'; lista.querySelectorAll('.abrir-arch').forEach(b=>b.onclick=(ev)=>{ev.preventDefault();const a=archivosAsamblea.find(x=>x.id===b.dataset.id);if(a)AdminPHVisor.abrir(a);}); lista.querySelectorAll('.del-arch').forEach(b=>b.onclick=()=>{archivosAsamblea=archivosAsamblea.filter(x=>x.id!==b.dataset.id);guardarDatos();pintar();});}
        document.getElementById(`archivo_${modulo}`).onchange=e=>{[...e.target.files].forEach(f=>{const rd=new FileReader();rd.onload=ev=>{archivosAsamblea.push({id:Date.now()+Math.random().toString(16).slice(2),punto:modulo,nombre:f.name,tipo:f.type,data:ev.target.result});guardarDatos();pintar();};rd.readAsDataURL(f);});};
        pintar(); if(!sinNav) agregarBotonContinuar(container);
    }

    function renderPresupuesto(container){
        const est=votacionEstado.presupuesto; if(!Array.isArray(est.opciones))est.opciones=[];
        est.tipoVoto=est.tipoVoto||'nominal'; est.duracionMinutos=parseInt(est.duracionMinutos)||5;
        const draw=()=>{
          const esMano=est.tipoVoto==='manoAlzada', esCoef=est.tipoVoto==='coeficiente';
          document.getElementById('presOpts').innerHTML=est.opciones.map((o,i)=>`<div class="votacion-presupuesto-row"><div class="form-group"><label>Opción ${i+1}</label><input data-f="n" data-i="${i}" value="${escapeHtml(o.nombre||`OPCIÓN ${i+1}`)}" ${est.abierta?'disabled':''}></div><div class="form-group"><label>Cuota / descripción</label><input data-f="d" data-i="${i}" value="${escapeHtml(o.descripcion||'')}" ${est.abierta?'disabled':''}></div>${esMano?`<div class="votacion-opcion-votos"><label>✋ Votos</label><input type="number" min="0" max="${limiteVotosManoAlzada('presupuesto')}" step="1" inputmode="numeric" data-f="v" data-i="${i}" value="${o.votosManoAlzada||0}"></div>`:''}</div>`).join('')||'<p>Agregue dos o más opciones.</p>';
          document.querySelectorAll('#presOpts input').forEach(x=>x.onchange=()=>{const o=est.opciones[+x.dataset.i];const f=x.dataset.f;const anterior=f==='v'?(o.votosManoAlzada||0):null;if(f==='n')o.nombre=x.value;else if(f==='d')o.descripcion=x.value;else {o.votosManoAlzada=Math.max(0,parseInt(x.value)||0);const lim=validarTotalManoAlzada('presupuesto');if(!lim.ok){o.votosManoAlzada=anterior;x.value=anterior;alert(`⚠️ LÍMITE DE VOTACIÓN\n\nLa suma de votos a mano alzada no puede superar el número de asistentes presentes (${lim.limite}).\n\nVotos registrados: ${lim.total}.`);return;}}guardarDatos();renderResultadosOpciones('presupuesto');});
          renderResultadosOpciones('presupuesto');
        };
        container.innerHTML=`<div class="summary-bar"><strong>💰 Opciones de presupuesto y cuota</strong></div>${htmlSelectorQuorumVotacion('presupuesto', est)}<div class="summary-bar" style="font-size:12px;">⚠️ <strong>Restricción de votación:</strong> por QR solo pueden votar unidades registradas como presentes. En votación a mano alzada, la suma de votos no puede superar los ${limiteVotosManoAlzada('presupuesto')} asistentes presentes.</div>
        <div class="form-row votacion-config-row"><div class="form-group"><label>Modalidad de votación</label><select id="presModalidad" ${est.abierta?'disabled':''}><option value="nominal">🗳️ Nominal / QR</option><option value="coeficiente">📊 Por coeficiente / QR</option><option value="manoAlzada">✋ Mano alzada</option></select></div><div class="form-group"><label>Tiempo de votación (minutos)</label><input id="dur_presupuesto" type="number" min="1" max="120" value="${est.duracionMinutos}" ${est.abierta?'disabled':''}></div></div>
        <div id="timer_presupuesto" class="votacion-timer" style="${est.abierta?'':'display:none;'}">⏱️ 00:00</div>
        <button type="button" class="btn-secondary" onclick="abrirRelojVotacion('presupuesto')" style="margin:8px 0 12px;font-size:15px;">🖥️ Abrir reloj en pantalla</button><div id="presOpts"></div>
        <button class="btn-secondary" id="addPres" ${est.abierta?'disabled':''}>➕ Agregar opción</button>
        <button class="btn-primary" id="openPres" style="margin-left:8px" ${est.abierta?'disabled':''}>▶️ Abrir votación</button>
        <button class="btn-danger" id="closePres" style="margin-left:8px" ${!est.abierta?'disabled':''}>🔒 Cerrar votaciones</button>
        <span style="margin-left:10px;font-weight:bold;">${est.abierta?'🟢 VOTACIÓN ABIERTA':'🔴 VOTACIÓN CERRADA'}</span><div id="presRes" style="margin-top:15px"></div>`;
        const modal=document.getElementById('presModalidad'); modal.value=est.tipoVoto;
        modal.onchange=()=>{if(est.abierta)return;est.tipoVoto=modal.value;guardarDatos();draw();};
        document.getElementById('dur_presupuesto').onchange=e=>{est.duracionMinutos=Math.max(1,parseInt(e.target.value)||5);guardarDatos();};
        document.getElementById('addPres').onclick=()=>{est.opciones.push({nombre:`OPCIÓN ${est.opciones.length+1}`,descripcion:'',votosNominal:0,votosCoeficiente:0,votosManoAlzada:0});guardarDatos();draw();};
        document.getElementById('openPres').onclick=()=>{if(!puedeModificarAsamblea()){solicitarDesbloqueoAsamblea('asamblea');return;}if(hayOtraVotacionAbierta('presupuesto'))return;if(est.opciones.length<2){alert('Agregue al menos dos opciones.');return;}const lim=validarLimiteAntesDeAbrir('presupuesto');if(!lim.ok){alert(`⚠️ LÍMITE DE VOTACIÓN\n\nLa suma de votos a mano alzada (${lim.total}) supera el número de asistentes presentes (${lim.limite}).\n\nCorrija los votos antes de abrir la votación.`);return;}prepararTemporizadorDesdeInput('presupuesto');est.abierta=true;guardarDatos();renderPresupuesto(container);iniciarTemporizadorVotacion('presupuesto',()=>renderPresupuesto(container));};
        document.getElementById('closePres').onclick=()=>{if(!puedeModificarAsamblea()){solicitarDesbloqueoAsamblea('asamblea');return;}if(!est.abierta)return;cerrarVotacionAutomaticamente('presupuesto',()=>renderPresupuesto(container));alert('🔒 VOTACIONES CERRADAS\n\nLos resultados quedan consignados.');};
        draw();
        configurarSelectorQuorumVotacion('presupuesto', est, ()=>renderPresupuesto(container));
        agregarBotonContinuar(container);if(est.abierta)iniciarTemporizadorVotacion('presupuesto',()=>renderPresupuesto(container));
    }

    function renderVotacionesExtra(container, auto){
        if(!Array.isArray(votacionesExtra)) votacionesExtra=[];
        if(auto===undefined) auto=true;
        const propias=()=>votacionesExtra.filter(v=>!v.puntoId);
        const gestionar=(key)=>{
            const v=votacionesExtra.find(x=>x.key===key); if(!v)return;
            const zona=document.getElementById('extraEditor'); zona.innerHTML='';
            renderVotacionOpciones(v.key,zona,v.titulo||'Votación adicional',true);
            const volver=document.createElement('button');volver.className='btn-secondary';volver.style.marginTop='10px';volver.textContent='⬅️ Volver a la lista de votaciones adicionales';
            volver.onclick=()=>renderVotacionesExtra(container,false);zona.appendChild(volver);
            zona.scrollIntoView({behavior:'smooth',block:'nearest'});
        };
        const renderLista=()=>{
            const lista=document.getElementById('listaVotacionesExtra'); if(!lista)return;
            lista.innerHTML=propias().map((v,i)=>{
                const e=votacionEstado[v.key]||{};
                const estado=e.abierta?'<span style="background:#c8e6c9;color:#1b5e20;padding:3px 10px;border-radius:12px;font-weight:bold;">🟢 ABIERTA</span>':(e.votacionCerradaEn?'<span style="background:#ffcdd2;color:#b71c1c;padding:3px 10px;border-radius:12px;">🔴 Cerrada</span>':'<span style="background:#eee;padding:3px 10px;border-radius:12px;">⚪ Sin abrir</span>');
                return `<div class="summary-bar" style="margin:10px 0;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;"><span><strong>Votación ${i+1}:</strong> ${escapeHtml(v.titulo||'Votación adicional')} ${estado}</span><span><button class="btn-secondary" data-extra="${escapeHtml(v.key)}">${e.abierta?'Ver / gestionar':'Abrir / gestionar'}</button> ${e.abierta?`<button class="btn-danger" data-cerrar-extra="${escapeHtml(v.key)}">🔒 Cerrar ahora</button>`:''} <button class="btn-danger" data-del-extra="${escapeHtml(v.key)}" ${e.abierta?'disabled title="Ciérrela antes de eliminar"':''}>🗑️</button></span></div>`;
            }).join('')||'<p>No se han agregado votaciones adicionales.</p>';
            lista.querySelectorAll('[data-extra]').forEach(b=>b.onclick=()=>gestionar(b.dataset.extra));
            lista.querySelectorAll('[data-cerrar-extra]').forEach(b=>b.onclick=()=>{cerrarVotacionDesdeAviso(b.dataset.cerrarExtra);renderLista();});
            lista.querySelectorAll('[data-del-extra]').forEach(b=>b.onclick=()=>{if(!confirm('¿Eliminar esta votación adicional y todos sus resultados?'))return;const key=b.dataset.delExtra;if(votacionEstado[key]?.abierta){alert('Cierre la votación antes de eliminarla.');return;}if(window.AdminPHBridge)window.AdminPHBridge.forgetVoting(key);votacionesExtra=votacionesExtra.filter(x=>x.key!==key);delete votacionEstado[key];delete votosQR[key];delete votacionApertura[key];guardarDatos();renderVotacionesExtra(container,false);});
        };
        container.innerHTML=`<div class="summary-bar"><strong>➕ Votaciones adicionales</strong><br><small>Este punto permite registrar decisiones o votaciones surgidas durante la asamblea que no hacen parte del orden del día original. Puede agregar tantas votaciones como necesite; solo una puede estar abierta a la vez. Cada una queda en el acta con su resultado.</small></div><div class="form-row" style="margin-top:12px;"><div class="form-group"><label>Nombre de la nueva votación</label><input id="tituloExtra" placeholder="Ej.: Aprobación de una decisión adicional"></div><div class="form-group" style="display:flex;align-items:end;"><button class="btn-primary" id="addExtra">➕ Agregar votación</button></div></div><div id="listaVotacionesExtra"></div><div id="extraEditor" style="margin-top:15px;"></div>`;
        document.getElementById('addExtra').onclick=()=>{const t=document.getElementById('tituloExtra').value.trim();if(!t){alert('Ingrese el nombre de la votación.');return;}const id=Date.now(),key='extra_'+id;votacionesExtra.push({id,key,titulo:t});votacionEstado[key]={candidatos:[],abierta:false,tipoVoto:'manoAlzada',modoEntrada:'manual',votantes:[],tipoQuorum:'deliberatorio',porcentajeQuorum:50,opciones:[{nombre:'Opción 1',votosNominal:0,votosCoeficiente:0,votosManoAlzada:0},{nombre:'Opción 2',votosNominal:0,votosCoeficiente:0,votosManoAlzada:0}]};votosQR[key]=[];votacionApertura[key]=null;guardarDatos();document.getElementById('tituloExtra').value='';renderLista();};
        renderLista();
        agregarBotonContinuar(container);
        if(auto){
            const k=extraAbrirKey||((propias().find(v=>votacionEstado[v.key]?.abierta)||{}).key);
            extraAbrirKey=null;
            if(k) gestionar(k);
        }
    }

    function renderProposiciones(container){
        const r=calcularQuorum();
        const informativa=!r.quorumOk;
        const storageKey=informativa?'variosInformativosAsamblea':'proposicionesAsamblea';
        let props=JSON.parse(localStorage.getItem(storageKey)||'[]');
        const elegibles=obtenerAsistentesElegibles();
        const draw=()=>{container.querySelector('#listaProps').innerHTML=props.map((p,i)=>`<div class="summary-bar" style="margin:8px 0"><strong>${escapeHtml(p.unidad||'Sin unidad')}</strong> — ${escapeHtml(p.propietario||'Sin propietario')}<br><strong>${informativa?'Varios / asunto':'Proposición'}:</strong> ${escapeHtml(p.titulo)}<div style="margin-top:8px">${escapeHtml(p.detalle)}</div>${informativa?`<small><strong>Destino sugerido:</strong> ${escapeHtml(p.destino||'Siguiente Asamblea')}</small>`:''}</div>`).join('')||`<p>No hay ${informativa?'varios informativos':'proposiciones'} registrados.</p>`;};
        container.innerHTML=`<div class="summary-bar ${informativa?'alerta':''}"><strong>📝 ${informativa?'Varios de asamblea informativa':'Proposiciones y varios — sin votación'}</strong><br><small>${informativa?'Al no existir quórum no se registran proposiciones para decisión. Aquí se dejan consultas, solicitudes, constancias y asuntos que Administración debe revisar para la Siguiente Asamblea o para el Consejo de Administración.':'Registro de proposiciones y varios para el acta.'}</small></div>
        <div class="form-row"><div class="form-group"><label>Unidad residencial</label><select id="propUni"><option value="">Seleccionar unidad...</option>${elegibles.map(e=>`<option value="${e.unidadId}" data-nombre="${escapeHtml(e.nombreAsistente)}">${escapeHtml(e.unidadNombre)} — ${escapeHtml(e.nombreAsistente)}</option>`).join('')}</select></div>
        <div class="form-group"><label>Copropietario / solicitante</label><input id="propSolicitante" placeholder="Se completa desde la unidad; puede ajustarse"></div>
        <div class="form-group"><label>${informativa?'Varios / asunto':'Proposición'}</label><input id="propTit" placeholder="Título o asunto"></div></div>
        ${informativa?`<div class="form-row"><div class="form-group"><label>Destino / seguimiento</label><select id="propDestino"><option>Siguiente Asamblea</option><option>Consejo de Administración</option><option>Administración</option><option>Comité / área responsable</option></select></div></div>`:''}
        <div class="form-group"><label>Detalle</label><textarea id="propDet" rows="10" style="width:100%;min-height:240px;resize:vertical" placeholder="Describa la consulta, solicitud, constancia o asunto a tener en cuenta."></textarea></div>
        <button class="btn-primary" id="addProp">💾 Guardar ${informativa?'varios':'proposición'}</button><div id="listaProps" style="margin-top:15px"></div>`;
        const sel=document.getElementById('propUni'), solicitante=document.getElementById('propSolicitante');
        sel.onchange=()=>{const opt=sel.options[sel.selectedIndex]; solicitante.value=opt?.dataset?.nombre||'';};
        document.getElementById('addProp').onclick=()=>{const opt=sel.options[sel.selectedIndex],t=document.getElementById('propTit').value.trim(),d=document.getElementById('propDet').value.trim(),sol=solicitante.value.trim();if(!sel.value||!sol||!t||!d){alert('Seleccione la unidad e ingrese el copropietario/solicitante, el asunto y su detalle.');return;}const u=unidades.find(x=>String(x.id)===String(sel.value));props.push({unidad:u?u.concatenado:opt.textContent.split(' — ')[0],propietario:sol,titulo:t,detalle:d,destino:informativa?(document.getElementById('propDestino')?.value||'Siguiente Asamblea'):'',tipo:informativa?'varios_informativo':'proposicion',convocatoria:Number(configConjunto.convocatoriaActual||1),fecha:new Date().toISOString()});localStorage.setItem(storageKey,JSON.stringify(props));document.getElementById('propTit').value=document.getElementById('propDet').value='';solicitante.value='';sel.value='';draw();};draw();agregarBotonContinuar(container);
    }

    // ==================== VOTACIÓN POR CARGO (PRESIDENTE / SECRETARIO) ====================
    function renderVotacionCargo(cargo, container) {
    const est = votacionEstado[cargo];
    const elegibles = obtenerAsistentesElegibles();
    const r = calcularQuorum();
    const esRevisorFiscal = cargo === 'revisorFiscal';
    const esConsejo = cargo === 'consejo';
    const esMultiple = cargo === 'comite' || cargo === 'consejo' || cargo === 'convivencia';

    // Detener intervalo previo si existe
    if (window[`_interval_${cargo}`]) clearInterval(window[`_interval_${cargo}`]);

    let html = `
        <div class="summary-bar ${r.quorumOk ? 'ok' : 'alerta'}">
            <strong>${r.quorumOk ? '✅ QUÓRUM ALCANZADO' : '❌ SIN QUÓRUM — ASAMBLEA SOLO INFORMATIVA'}</strong>
            <span>Coef. presentes: ${r.coeficientesPresentes.toFixed(4)}% / ${r.totalCoeficientes.toFixed(4)}%</span>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Modalidad de votación</label>
                <select id="${cargo}_modalidad" ${!r.quorumOk ? 'disabled' : ''}>
                    <option value="nominal" ${est.tipoVoto==='nominal'?'selected':''}>🗳️ Nominal (1 unidad = 1 voto por QR)</option>
                    <option value="coeficiente" ${est.tipoVoto==='coeficiente'?'selected':''}>📊 Por Coeficiente (voto QR vale según coef.)</option>
                    <option value="manoAlzada" ${est.tipoVoto==='manoAlzada'?'selected':''}>✋ Mano Alzada (presidente cuenta)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Modo de ingreso de candidatos</label>
                ${esRevisorFiscal ? `<input value="✏️ Ingreso manual — persona externa" readonly>` : `<select id="${cargo}_modo" ${!r.quorumOk ? 'disabled' : ''}>
                    <option value="avanzado" ${est.modoEntrada==='avanzado'?'selected':''}>🔍 Seleccionar de asistentes</option>
                    <option value="simple" ${est.modoEntrada==='simple'?'selected':''}>✏️ Manual (nombre y unidad)</option>
                </select>`}
            </div>
        </div>
        ${htmlSelectorQuorumVotacion(cargo, est)}
        <div class="summary-bar" style="font-size:12px;">⚠️ <strong>Restricción de votación:</strong> por QR solo pueden votar unidades registradas como presentes en la asistencia. En votación a mano alzada, la suma de votos no puede superar los ${r.asistentes} asistentes presentes.</div>
        ${esMultiple ? `<div class="summary-bar"><strong>👥 Elección múltiple:</strong> pueden quedar varios elegidos. Después de la votación podrá marcar manualmente en la lista quiénes quedan designados. ${esConsejo?'Si la asamblea decide que sean los tres primeros, el sistema mostrará automáticamente esos tres primeros resultados.':''}</div>` : ''}
        <div id="${cargo}_formAgregar" style="margin:15px 0;"></div>
        <div id="${cargo}_lista"></div>
        <div class="form-row" style="margin-top:15px;">
            <div class="form-group"><label>Tiempo de votación (minutos)</label><input id="dur_${cargo}" type="number" min="1" max="120" value="${est.duracionMinutos||5}" ${est.abierta?'disabled':''}></div>
            <button id="${cargo}_abrir" class="btn-primary" ${!r.quorumOk ? 'disabled' : ''}>🔓 Abrir votación</button>
            <button id="${cargo}_cerrar" class="btn-danger" ${!est.abierta ? 'disabled' : ''}>🔒 Cerrar votaciones</button>
            <button id="${cargo}_reset" class="btn-warning">🔄 Reiniciar votos</button>
            <span id="${cargo}_estado" style="padding:8px 15px;border-radius:20px;font-weight:bold;background:${est.abierta?'#c8e6c9':'#ffcdd2'};">
                ${est.abierta?'🟢 ABIERTA':'🔴 CERRADA'}
            </span>
        </div>
        <div id="timer_${cargo}" class="votacion-timer" style="${est.abierta?'':'display:none;'}">${est.abierta?'⏱️ 00:00':''}</div>
        <button type="button" class="btn-secondary" onclick="abrirRelojVotacion('${cargo}')" style="margin:8px 0 12px;font-size:15px;">🖥️ Abrir reloj en pantalla</button>
        <div id="${cargo}_resultados" style="margin-top:15px;"></div>
    `;
    container.innerHTML = html;
    est.duracionMinutos=parseInt(est.duracionMinutos)||5;
    const durEl=document.getElementById(`dur_${cargo}`); if(durEl) durEl.onchange=e=>{est.duracionMinutos=Math.max(1,parseInt(e.target.value)||5);guardarDatos();};
    if (cargo === 'comite') {
        const nota = document.createElement('div');
        nota.className = 'summary-bar';
        nota.innerHTML = '👥 <strong>Comisión verificadora:</strong> puede registrar más de tres candidatos. Al cerrar la votación, el sistema determinará automáticamente los <strong>3 candidatos con mayor votación</strong>.';
        container.insertBefore(nota, container.firstChild);
    }

    // ============ FORMULARIO AGREGAR CANDIDATOS ============
    function renderFormAgregar() {
        const f = document.getElementById(`${cargo}_formAgregar`);
        if (!r.quorumOk && !esRevisorFiscal) {
            f.innerHTML = '<div class="summary-bar alerta">⚠️ Debe alcanzar el quórum para agregar candidatos y votar.</div>';
            return;
        }
        if (est.abierta) {
            f.innerHTML = '<div class="summary-bar">🔒 La votación está abierta. Cierre la votación para modificar candidatos.</div>';
            return;
        }
        if (esRevisorFiscal) {
            f.innerHTML = `<div class="form-row"><div class="form-group"><label>Nombre completo del candidato externo</label><input id="${cargo}_manualNom" placeholder="Nombre del revisor fiscal"></div><div class="form-group"><label>Identificación / NIT (opcional)</label><input id="${cargo}_manualDoc" placeholder="C.C. / NIT"></div><button id="${cargo}_btnAgregarManual" class="btn-secondary">➕ Agregar candidato</button></div>`;
            document.getElementById(`${cargo}_btnAgregarManual`).onclick=()=>{const nom=document.getElementById(`${cargo}_manualNom`).value.trim();const doc=document.getElementById(`${cargo}_manualDoc`).value.trim();if(!nom){alert('Ingrese el nombre del revisor fiscal.');return;}est.candidatos.push({unidadId:null,unidadNombre:'',nombre:nom,documento:doc,condicion:'externo',coeficiente:0,votosNominal:0,votosCoeficiente:0,votosManoAlzada:0});guardarDatos();renderVotacionCargo(cargo,container);};
            return;
        }
        if (est.modoEntrada === 'avanzado') {
            if (elegibles.length === 0) {
                f.innerHTML = '<div class="summary-bar alerta">⚠️ No hay asistentes. Vaya a "Toma de Asistencia".</div>';
                return;
            }
            f.innerHTML = `
                <label style="font-size:12px;font-weight:600;">Seleccionar candidato desde asistentes (apoderado tiene prioridad):</label>
                <div class="form-row">
                    <div class="form-group">
                        <select id="${cargo}_selectElegible">
                            ${elegibles.map((e,i) => `<option value="${i}">${e.unidadIds.length>1?escapeHtml(e.nombreAsistente)+' — 📄 Apoderado de '+e.unidadIds.length+' unidades ('+escapeHtml(e.unidadNombre)+') coef. sumado: '+e.coeficiente.toFixed(4):escapeHtml(e.unidadNombre)+' — '+escapeHtml(e.nombreAsistente)+' ('+(e.condicion==='apoderado'?'📄 Apoderado':'🏠 Propietario')+') coef:'+e.coeficiente.toFixed(4)}</option>`).join('')}
                        </select>
                    </div>
                    <button id="${cargo}_btnAgregarAvz" class="btn-secondary">➕ Agregar candidato</button>
                </div>
            `;
            document.getElementById(`${cargo}_btnAgregarAvz`).onclick = () => {
                const idx = parseInt(document.getElementById(`${cargo}_selectElegible`).value);
                const e = elegibles[idx];
                if (!e) return;
                if (est.candidatos.find(c => c.unidadId === e.unidadId)) { alert("Ya es candidato"); return; }
                est.candidatos.push({
                    unidadId: e.unidadId,
                    unidadNombre: e.unidadNombre,
                    nombre: e.nombreAsistente,
                    documento: e.documentoAsistente,
                    condicion: e.condicion,
                    coeficiente: e.coeficiente,
                    votosNominal: 0,
                    votosCoeficiente: 0,
                    votosManoAlzada: 0
                });
                guardarDatos();
                renderVotacionCargo(cargo, container);
            };
        } else {
            f.innerHTML = `
                <div class="form-row">
                    <div class="form-group"><label>Nombre</label><input id="${cargo}_manualNom" placeholder="Nombre del candidato"></div>
                    <div class="form-group"><label>Unidad</label><input id="${cargo}_manualUni" placeholder="Ej: 101"></div>
                    <div class="form-group"><label>Coeficiente</label><input type="number" step="0.0001" id="${cargo}_manualCoef" value="1"></div>
                    <button id="${cargo}_btnAgregarManual" class="btn-secondary">➕ Agregar</button>
                </div>
            `;
            document.getElementById(`${cargo}_btnAgregarManual`).onclick = () => {
                const nom = document.getElementById(`${cargo}_manualNom`).value.trim();
                const uni = document.getElementById(`${cargo}_manualUni`).value.trim();
                const coef = parseFloat(document.getElementById(`${cargo}_manualCoef`).value) || 1;
                if (!nom) { alert("Ingrese el nombre"); return; }
                est.candidatos.push({
                    unidadId: null, unidadNombre: uni || 'Sin unidad', nombre: nom,
                    documento: '', condicion: 'manual', coeficiente: coef,
                    votosNominal: 0, votosCoeficiente: 0, votosManoAlzada: 0
                });
                guardarDatos();
                renderVotacionCargo(cargo, container);
            };
        }
    }

    // ============ LISTA DE CANDIDATOS ============
    function renderLista() {
        const l = document.getElementById(`${cargo}_lista`);
        if (est.candidatos.length === 0) {
            l.innerHTML = '<p style="padding:10px;color:#6c7a6c;">No hay candidatos.</p>';
            return;
        }
        const esManoAlzada = est.tipoVoto === 'manoAlzada';
        const esCoef = est.tipoVoto === 'coeficiente';

        let h = `<div class="table-wrapper"><table class="data-table"><thead><tr>
            <th>#</th>${!esRevisorFiscal?'<th>Unidad</th>':''}<th>Candidato</th><th>Condición</th>${!esRevisorFiscal?'<th>Coef.</th>':''}
            ${!esManoAlzada ? '<th>Votos QR</th>' : ''}
            ${esManoAlzada ? '<th>Votos Mano Alzada</th>' : ''}
            <th>Total</th><th>Acciones</th>
        </tr></thead><tbody>`;

        est.candidatos.forEach((c, i) => {
            const vQR = esCoef ? (c.votosCoeficiente||0) : (c.votosNominal||0);
            const vMano = c.votosManoAlzada || 0;
            const total = esManoAlzada ? vMano : vQR;

            h += `<tr>
                <td>${i+1}</td>
                ${!esRevisorFiscal?`<td>${escapeHtml(c.unidadNombre||'-')}</td>`:''}
                <td><strong>${escapeHtml(c.nombre)}</strong>${c.documento?`<br><small>Doc: ${escapeHtml(c.documento)}</small>`:''}</td>
                <td>${c.condicion==='apoderado'?'📄 Apoderado':c.condicion==='propietario'?'🏠 Propietario':c.condicion==='externo'?'🌐 Externo':'✏️ Manual'}</td>
                ${!esRevisorFiscal?`<td>${(c.coeficiente||0).toFixed(4)}</td>`:''}
                ${!esManoAlzada ? `<td><strong>${esCoef ? vQR.toFixed(4) : vQR}</strong></td>` : ''}
                ${esManoAlzada ? `<td><input type="number" min="0" ${sinLimiteAsistentesManoAlzada(cargo)?'':'max="'+r.asistentes+'"'} step="1" inputmode="numeric" value="${vMano}" data-idx="${i}" class="input-mano" style="width:130px;min-width:130px;text-align:center;font-size:18px;padding:10px;"></td>` : ''}
                <td><strong>${esCoef && !esManoAlzada ? total.toFixed(4) : total}</strong></td>
                <td>
                    <button class="btn-danger elim-cand" data-idx="${i}" style="padding:4px 8px;font-size:11px;">🗑️</button>
                </td>
            </tr>`;
        });
        h += `</tbody></table></div>`;
        if (esConsejo || cargo==='convivencia') {
            h += `<div class="summary-bar" style="margin-top:12px"><strong>☑️ ${esConsejo?'Designación final del Consejo':'Designación final del Comité de Convivencia'}</strong><br><small>Marque los candidatos que finalmente quedan designados. Esto permite resolver empates o aceptar más de tres candidatos si así lo decide la asamblea.</small><div id="${cargo}_checkFinal" style="margin-top:10px">${est.candidatos.map((c,i)=>`<label style="display:block;margin:6px 0"><input type="checkbox" class="consejo-final" data-idx="${i}" ${Array.isArray(est.designadosFinales)&&est.designadosFinales.includes(i)?'checked':''}> ${escapeHtml(c.nombre)}</label>`).join('')}</div></div>`;
        }
        l.innerHTML = h;
        if (esConsejo || cargo==='convivencia') document.querySelectorAll(`#${cargo}_lista .consejo-final`).forEach(ch=>ch.onchange=()=>{est.designadosFinales=Array.from(document.querySelectorAll(`#${cargo}_lista .consejo-final:checked`)).map(x=>parseInt(x.dataset.idx));guardarDatos();});

        document.querySelectorAll(`#${cargo}_lista .elim-cand`).forEach(btn => {
            btn.onclick = () => {
                if (est.abierta) { alert("Cierre la votación primero"); return; }
                if (confirm("¿Eliminar candidato?")) {
                    est.candidatos.splice(parseInt(btn.dataset.idx), 1);
                    guardarDatos();
                    renderVotacionCargo(cargo, container);
                }
            };
        });

        // Inputs de mano alzada
        document.querySelectorAll(`#${cargo}_lista .input-mano`).forEach(inp => {
            inp.onchange = () => {
                const idx = parseInt(inp.dataset.idx);
                const v = parseInt(inp.value) || 0;
                const anterior=est.candidatos[idx].votosManoAlzada||0;
                est.candidatos[idx].votosManoAlzada = v;
                const lim=validarTotalManoAlzada(cargo);
                if(!sinLimiteAsistentesManoAlzada(cargo) && !lim.ok){ est.candidatos[idx].votosManoAlzada=anterior; inp.value=anterior; alert(`⚠️ LÍMITE DE VOTACIÓN\n\nLa suma de votos a mano alzada no puede superar el número de asistentes presentes (${lim.limite}).\n\nVotos registrados: ${lim.total}.`); return; }
                guardarDatos();
                renderResultados();
            };
        });
    }

    // ============ RESULTADOS EN VIVO ============
    function renderResultados() {
        const res = document.getElementById(`${cargo}_resultados`);
        const esCoef = est.tipoVoto === 'coeficiente';
        const esMano = est.tipoVoto === 'manoAlzada';

        let totalVotos = 0;
        est.candidatos.forEach(c => {
            if (esMano) totalVotos += (c.votosManoAlzada || 0);
            else if (esCoef) totalVotos += (c.votosCoeficiente || 0);
            else totalVotos += (c.votosNominal || 0);
        });

        let h = `<div class="summary-bar">
            <strong>📊 Modalidad: ${esMano ? '✋ Mano Alzada' : esCoef ? '📊 Por Coeficiente (QR)' : '🗳️ Nominal (QR)'}</strong>
            <span>Total votos: <strong>${esCoef ? totalVotos.toFixed(4) : totalVotos}</strong></span>
            <span>Votos QR recibidos: <strong>${resumenVotantesQR(votosQR[cargo])}</strong></span>
        </div>`;

        let maxV = -1, ganadores = [];
        est.candidatos.forEach(c => {
            const v = esMano ? (c.votosManoAlzada||0) : esCoef ? (c.votosCoeficiente||0) : (c.votosNominal||0);
            if (v > maxV) { maxV = v; ganadores = [c.nombre]; }
            else if (v === maxV && v > 0) ganadores.push(c.nombre);

            const pct = totalVotos > 0 ? (v / totalVotos) * 100 : 0;
            h += `<div style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;">
                    <span><strong>${escapeHtml(c.nombre)}</strong> (${escapeHtml(c.unidadNombre)})</span>
                    <span><strong style="font-size:24px;line-height:1;">${esCoef ? v.toFixed(4) : v}</strong> <span style="font-weight:700;">votos</span> <small>(${pct.toFixed(1)}%)</small></span>
                </div>
                <div class="progress-bar" style="height:14px;">
                    <div style="width:${pct}%;background:#2d6a4f;height:14px;border-radius:10px;"></div>
                </div>
            </div>`;
        });

        if (totalVotos > 0) {
            if (cargo === 'comite') {
                const ordenados = [...est.candidatos].map(c => ({...c, votos: esMano ? (c.votosManoAlzada||0) : esCoef ? (c.votosCoeficiente||0) : (c.votosNominal||0)})).sort((a,b)=>b.votos-a.votos);
                const top = ordenados.slice(0,3);
                h += `<div class="summary-bar ok"><strong>🏆 TRES DESIGNADOS A LA COMISIÓN</strong><br>${top.map((c,i)=>`${i+1}. ${escapeHtml(c.nombre)} — ${esCoef ? c.votos.toFixed(4) : c.votos} votos`).join('<br>')}</div>`;
                if (ordenados.length > 3) h += `<p style="font-size:12px;color:#666;">Los demás candidatos quedan como no designados, según el orden de votación.</p>`;
            }
            if (esConsejo || cargo==='convivencia') {
                const designados=Array.isArray(est.designadosFinales)?est.designadosFinales:[];
                h += `<div class="summary-bar ok"><strong>☑️ Selección final</strong><br>${designados.length ? designados.map(i=>escapeHtml(est.candidatos[i]?.nombre||'')).join(', ') : 'Ningún candidato marcado como elegido todavía.'}</div>`;
            }
        } else {
            h += `<div class="summary-bar">⏳ Esperando votos...</div>`;
        }

        const q=resumenQuorumEleccion(est, cargo);
        h += `<div class="summary-bar ${q.aprobado?'ok':'alerta'}" style="margin-top:12px"><strong>⚖️ Quórum ${q.tipo==='decisorio'?'decisorio':'deliberatorio'}:</strong> ${q.porcentaje}% de ${q.esCoef ? Number(q.base).toFixed(4)+' coeficientes presentes' : q.asistentes+' asistentes presentes'} = <strong>${q.esCoef ? Number(q.votosRequeridos).toFixed(4) : q.votosRequeridos}</strong> ${q.esCoef?'de coeficiente favorable':'votos favorables'} requeridos. <strong>${q.sumatoria ? `Sumatoria de todos los votos: ${esCoef?q.totalVotos.toFixed(4):q.totalVotos}` : `Mayor votación: ${esCoef?maxV.toFixed(4):maxV}`}</strong> · ${q.sumatoria ? (q.aprobado?'✅ QUÓRUM ALCANZADO':'⚠️ QUÓRUM PENDIENTE') : (q.aprobado?'✅ UMBRAL ALCANZADO':'❌ UMBRAL NO ALCANZADO')}</div>`;
        if (!est.abierta && est.graficoResultado) h += generarGraficoVotacionHTML(est.graficoResultado, 'Resultado final de la votación');
        res.innerHTML = h;
    }

    // ============ RECIBIR VOTOS QR (simula backend) ============
    function sincronizarVotosQR() {
        // votosQR ya viene de localStorage; solo recalculamos los totales en candidatos
        let cambio = false;
        votosQR[cargo].forEach(v => {
            // Solo contar si la votación está abierta y el candidato existe
            const cand = est.candidatos[v.candidatoIdx];
            if (!cand) return;
            // Marcar como ya contado con un flag
            if (v.contado) return;
            if (est.tipoVoto === 'coeficiente') {
                cand.votosCoeficiente = (cand.votosCoeficiente || 0) + v.coeficiente;
            } else if (est.tipoVoto === 'nominal') {
                cand.votosNominal = (cand.votosNominal || 0) + 1;
            }
            v.contado = true;
            cambio = true;
        });
        if (cambio) {
            guardarDatos();
            localStorage.setItem('votosQR', JSON.stringify(votosQR));
            renderLista();
            renderResultados();
        }
    }

    // ============ EVENTOS DE SELECTS ============
    const modoEl = document.getElementById(`${cargo}_modo`);
    if (modoEl) {
        modoEl.onchange = (e) => {
            est.modoEntrada = e.target.value;
            guardarDatos();
            renderVotacionCargo(cargo, container);
        };
    }
    document.getElementById(`${cargo}_modalidad`).onchange = (e) => {
        if (est.abierta) { alert("Cierre la votación antes de cambiar modalidad"); e.target.value = est.tipoVoto; return; }
        est.tipoVoto = e.target.value;
        guardarDatos();
        renderVotacionCargo(cargo, container);
    };

    configurarSelectorQuorumVotacion(cargo, est, ()=>renderVotacionCargo(cargo,container));

    // ============ ABRIR / CERRAR VOTACIÓN ============
    document.getElementById(`${cargo}_abrir`).onclick = () => {
        if (!puedeModificarAsamblea()) { solicitarDesbloqueoAsamblea('asamblea'); return; }
        if (!r.quorumOk) { alert("Sin quórum no se puede votar"); return; }
        if (hayOtraVotacionAbierta(cargo)) return;
        if (est.candidatos.length === 0) { alert("Agregue al menos un candidato"); return; }
        const lim = validarLimiteAntesDeAbrir(cargo); if(!lim.ok){ alert(`⚠️ LÍMITE DE VOTACIÓN\n\nLa suma de votos a mano alzada (${lim.total}) supera el número de asistentes presentes (${lim.limite}).\n\nCorrija los votos antes de abrir la votación.`); return; }
        prepararTemporizadorDesdeInput(cargo);
        est.abierta = true;
        est.votantes = [];
        guardarDatos();
        renderVotacionCargo(cargo, container);
        iniciarTemporizadorVotacion(cargo,()=>renderVotacionCargo(cargo,container));
    };

    document.getElementById(`${cargo}_cerrar`).onclick = () => {
        if (!puedeModificarAsamblea()) { solicitarDesbloqueoAsamblea('asamblea'); return; }
        est.abierta = false;
        est.tiempoFin = null;
        est.votacionCerradaEn = new Date().toISOString();
        capturarGraficoVotacion(cargo);
        votacionApertura[cargo] = null;
        detenerTemporizadorVotacion(cargo);
        guardarDatos();
        renderVotacionCargo(cargo, container);

        // Mostrar ganador
        const esCoef = est.tipoVoto === 'coeficiente';
        const esMano = est.tipoVoto === 'manoAlzada';
        let maxV = -1, gan = null;
        est.candidatos.forEach(c => {
            const v = esMano ? (c.votosManoAlzada||0) : esCoef ? (c.votosCoeficiente||0) : (c.votosNominal||0);
            if (v > maxV) { maxV = v; gan = c; }
        });
        if (cargo === 'comite') {
            const ordenados = [...est.candidatos].map(c => ({...c, votos: esMano ? (c.votosManoAlzada||0) : esCoef ? (c.votosCoeficiente||0) : (c.votosNominal||0)})).sort((a,b)=>b.votos-a.votos).slice(0,3);
            if (ordenados.length) alert(`🔒 VOTACIÓN CERRADA\n\n🏆 Comisión verificadora (3 primeros):\n${ordenados.map((c,i)=>`${i+1}. ${c.nombre} — ${esCoef ? c.votos.toFixed(4) : c.votos} votos`).join('\n')}`);
            else alert("🔒 Votación cerrada sin votos registrados");
        } else if (gan) {
            alert(`🔒 VOTACIONES CERRADAS\n\n${(cargo==='consejo'||cargo==='convivencia')?'☑️ Resultado: use la lista de selección final para señalar los ELEGIDOS.':'🏆 Ganador: '+gan.nombre+' ('+gan.unidadNombre+')'}\nVotos: ${esCoef ? maxV.toFixed(4) : maxV}`);
        } else {
            alert("🔒 Votación cerrada sin votos registrados");
        }
    };

    document.getElementById(`${cargo}_reset`).onclick = () => {
        if (!puedeModificarAsamblea()) { solicitarDesbloqueoAsamblea('asamblea'); return; }
        if (!confirm("¿Reiniciar TODOS los votos de esta votación? Se borrarán los votos QR también.")) return;
        if (window.AdminPHBridge) window.AdminPHBridge.forgetVoting(cargo);
        est.candidatos.forEach(c => { c.votosNominal = 0; c.votosCoeficiente = 0; c.votosManoAlzada = 0; });
        est.votantes = [];
        est.abierta = false;
        votosQR[cargo] = [];
        votacionApertura[cargo] = null;
        est.tiempoFin = null;
        detenerTemporizadorVotacion(cargo);
        guardarDatos();
        localStorage.setItem('votosQR', JSON.stringify(votosQR));
        renderVotacionCargo(cargo, container);
    };

    // ============ RENDER INICIAL ============
    renderFormAgregar();
    renderLista();
    renderResultados();
    agregarBotonContinuar(container);
    if(est.abierta) iniciarTemporizadorVotacion(cargo,()=>renderVotacionCargo(cargo,container));

    // ============ POLLING PARA LEER VOTOS QR EN VIVO ============
    window[`_interval_${cargo}`] = setInterval(() => {
        // Recargar votosQR desde localStorage (simula backend)
        const svq = localStorage.getItem('votosQR');
        if (svq) {
            try {
                const fresh = JSON.parse(svq);
                if (fresh[cargo]) votosQR[cargo] = fresh[cargo];
            } catch(e){}
        }
        sincronizarVotosQR();
    }, 2000);
}

    // ==================== PUENTE CON EL SERVIDOR (Patch V2) ====================
    // Todo lo que sigue conecta las Fases 1, 2 y 3 con el backend mediante js/puente-backend.js.
    // Si el servidor no está disponible, la aplicación sigue funcionando de forma local como antes.
    const CARGOS_CANDIDATOS = ['presidente', 'secretario', 'comite', 'consejo', 'convivencia', 'revisorFiscal'];
    const TITULOS_VOTACION = {
        presidente: 'Presidente de Asamblea', secretario: 'Secretario de Asamblea', comite: 'Comisión Verificadora del Acta',
        consejo: 'Consejo de Administración', convivencia: 'Comité de Convivencia', revisorFiscal: 'Revisor Fiscal',
        ordenDia: 'Aprobación del orden del día', actaAnterior: 'Aprobación del acta anterior',
        financieros: 'Aprobación estados financieros', presupuesto: 'Aprobación presupuesto y cuota'
    };

    function puenteTituloVotacion(key) {
        const extra = (votacionesExtra || []).find(v => v.key === key);
        return (extra && extra.titulo) || TITULOS_VOTACION[key] || key;
    }

    // Descripción de una votación local para crearla en el servidor.
    function puenteDescribir(key) {
        const est = votacionEstado[key];
        if (!est) return null;
        const esCargo = CARGOS_CANDIDATOS.includes(key);
        const labels = esCargo
            ? (est.candidatos || []).map((c, i) => (String(c.nombre || `Candidato ${i + 1}`) + (c.unidadNombre ? ` (${c.unidadNombre})` : '')).slice(0, 200))
            : (est.opciones || []).map((o, i) => String(o.nombre || `Opción ${i + 1}`).slice(0, 200));
        return {
            key, kind: esCargo ? 'candidatos' : 'opciones', title: puenteTituloVotacion(key),
            method: est.tipoVoto === 'coeficiente' ? 'coefficient' : 'nominal',
            labels, winners: est.ganadoresRequeridos || 1
        };
    }

    // Votaciones abiertas en Fase 3 que deben estar visibles en los celulares (no aplica mano alzada).
    function puenteVotacionesAbiertas() {
        const out = [];
        Object.keys(votacionEstado).forEach(key => {
            const est = votacionEstado[key];
            if (!est || !est.abierta || !['nominal', 'coeficiente'].includes(est.tipoVoto)) return;
            const d = puenteDescribir(key);
            if (d && d.labels.length >= 1) out.push(d);
        });
        return out;
    }

    // Asistencia de Fase 2 en el formato que necesita el servidor.
    function puenteSnapshotAsistencia() {
        return (asistencia || []).map(a => {
            const u = unidades.find(x => String(x.id) === String(a.unidadId));
            if (!u) return null;
            const apoderado = a.condicion === 'apoderado';
            let name = String(a.nombreAsistente || '').trim();
            let doc = String(a.numeroDocumentoAsistente || '').trim();
            if (!apoderado) { name = name || String(u.propietario || '').trim() || `Unidad ${u.concatenado}`; doc = ''; }
            return { localId: u.id, label: u.concatenado, present: a.presente === true, role: apoderado ? 'proxy' : 'owner', name, doc,
                     incomplete: apoderado && a.presente === true && (!name || !doc) };
        }).filter(Boolean);
    }

    // Recibe los votos que llegaron por QR (desde el servidor) y los suma a la votación de Fase 3.
    function puenteAplicarVotos(key, kind, data) {
        const est = votacionEstado[key];
        if (!est || !data) return;
        if (est.registroManual && !est.abierta) return;   // V3.9: el resultado cargado desde Excel no se pisa con lecturas del servidor
        let cambio = false;
        if (kind === 'candidatos') {
            if (!Array.isArray(votosQR[key])) votosQR[key] = [];
            (data.options || []).forEach(o => {
                const cand = (est.candidatos || [])[o.index];
                if (!cand) return;
                (o.voters || []).forEach(v => {
                    if (!v.localUnitId) return;
                    if (votosQR[key].some(x => String(x.unidadId) === String(v.localUnitId))) return;   // ya contado
                    const u = unidades.find(x => String(x.id) === String(v.localUnitId));
                    const coef = Number(v.coefficient || 0);
                    votosQR[key].push({ unidadId: v.localUnitId, unidadNombre: u ? u.concatenado : '', coeficiente: coef,
                        candidatoIdx: o.index, candidatoNombre: cand.nombre, timestamp: Date.parse(v.castAt) || Date.now(), contado: true });
                    cand.votosNominal = (cand.votosNominal || 0) + 1;
                    cand.votosCoeficiente = (cand.votosCoeficiente || 0) + coef;
                    cambio = true;
                });
            });
        } else {
            (est.opciones || []).forEach((op, i) => {
                const o = (data.options || [])[i];
                if (!o) return;
                if ((op.votosNominal || 0) !== o.votes || Math.abs((op.votosCoeficiente || 0) - o.coefficient) > 1e-9) {
                    op.votosNominal = o.votes; op.votosCoeficiente = o.coefficient; cambio = true;
                }
            });
        }
        if (!cambio) return;
        guardarDatos();
        try { localStorage.setItem('votosQR', JSON.stringify(votosQR)); } catch (e) { /* nada */ }
        // Refrescar la pantalla si el usuario está viendo esta votación.
        try {
            const cont = document.getElementById('actividadContenido');
            if (kind === 'candidatos') {
                if (cont && document.getElementById(`${key}_resultados`) && !est.abierta === false) renderVotacionCargo(key, cont);
                else if (cont && document.getElementById(`${key}_resultados`)) renderVotacionCargo(key, cont);
            } else renderResultadosOpciones(key);
        } catch (e) { /* la pantalla no está visible */ }
    }

    function puenteRegistrar() {
        if (!window.AdminPHBridge) return;
        window.AdminPHBridge.register({
            getConfig: () => ({ nombreConjunto: configConjunto.nombreConjunto, nit: configConjunto.nit, ciudad: configConjunto.ciudad, direccion: configConjunto.direccion }),
            getUnits: () => unidades,
            getAttendance: puenteSnapshotAsistencia,
            getProxyGroups: () => leerApoderados().filter(g => (g.unidadIds || []).length > 1).map(g => ({ principalLocalId: g.principalId, unitLocalIds: g.unidadIds.slice(), name: g.nombre, document: g.documento })),
            getOpenVotings: puenteVotacionesAbiertas,
            describeVoting: puenteDescribir,
            applyVotes: puenteAplicarVotos,
            abrirFase1: () => { cambiarFase(1); loadModule('servidor'); }
        });
    }

    // Aviso en "QR de asistentes" sobre el estado real de los códigos.
    function puenteAvisoQR(presentes) {
        const B = window.AdminPHBridge;
        if (!B || !B.isConnected()) return '<div class="summary-bar alerta">⚠️ <strong>Sin conexión con el servidor:</strong> estos QR son del formato ANTIGUO y no permiten votar desde un celular. Conéctese en <strong>Fase 1 → 🔗 Servidor y Asamblea</strong>.</div>';
        const st = B.state();
        if (B.qrBaseInfo().unusable) return '<div class="summary-bar alerta">⚠️ Está abriendo AdminPH con <strong>localhost</strong>: estos QR no abrirán en los celulares. Escriba la <strong>dirección pública</strong> en Fase 1 → 🔗 Servidor y Asamblea (sección 4).</div>';
        if (!st.assemblyId) return '<div class="summary-bar alerta">⚠️ Falta crear o elegir la asamblea en <strong>Fase 1 → 🔗 Servidor y Asamblea</strong>. Sin ella los QR no son válidos.</div>';
        const sin = (presentes || []).filter(u => !u.qrReal).length;
        if (sin) return `<div class="summary-bar alerta">⏳ ${sin} QR se están habilitando en el servidor… (se actualizan solos)</div>`;
        if (st.assemblyStatus !== 'active') return '<div class="summary-bar alerta">⏳ La asamblea está <strong>en preparación</strong>: los QR funcionarán cuando la inicie en <strong>Fase 1 → 🔗 Servidor y Asamblea</strong>.</div>';
        return '<div class="summary-bar ok">✅ QR reales habilitados: cada propietario puede votar desde su celular.</div>';
    }

    // ---------- Cierre definitivo (local + servidor) ----------
    function ejecutarCierreDefinitivo() {
        const d = new Date();
        cierreAsamblea = { registrado: true, fecha: d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }), hora: d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), cerradoPor: currentUser?.name || currentUser?.username || '-', reaperturaAutorizadaEn: '', reaperturaAutorizadaPor: '' };
        // El cierre también cierra cualquier votación que haya quedado abierta y genera su gráfico.
        Object.keys(votacionEstado).forEach(key => { const e = votacionEstado[key]; if (e?.abierta || !e?.graficoResultado) { if (e?.abierta) e.abierta = false; e.tiempoFin = null; e.votacionCerradaEn = e.votacionCerradaEn || new Date().toISOString(); votacionApertura[key] = null; capturarGraficoVotacion(key); detenerTemporizadorVotacion(key); } });
        const punto = puntosOrdenDia.find(p => p.modulo === 'cierre' && p.activo); if (punto) punto.completado = true;
        asambleaEdicionAutorizada = false; guardarDatos();
        archivarAsambleaActual();
    }

    async function cierreDefinitivoIntegrado() {
        if (!solicitarDesbloqueoAsamblea('cierre') && asambleaCerrada()) return false;
        if (!confirm('¿Confirmar el cierre definitivo de la asamblea?\n\nDespués de confirmar, los datos quedarán protegidos y cualquier modificación posterior requerirá autorización administrativa adicional.')) return false;
        const B = window.AdminPHBridge;
        const conServidor = !!(B && B.isConnected() && B.state().assemblyId);
        if (conServidor) { try { await B.pollNow(); } catch (e) { /* se cierra igual */ } }   // traer los últimos votos antes de fijar resultados
        ejecutarCierreDefinitivo();
        let aviso = '';
        if (conServidor) {
            try { await B.closeAssembly(); }
            catch (e) { aviso = '\n\n⚠️ La asamblea se cerró aquí, pero NO en el servidor: ' + e.message; }
        }
        alert(`🏁 ASAMBLEA CERRADA Y BLOQUEADA\n\nFecha: ${cierreAsamblea.fecha}\nHora: ${cierreAsamblea.hora}\n\nLos datos quedan protegidos. Las modificaciones posteriores requieren la clave administrativa adicional.` + aviso);
        return true;
    }

    // ---------- Nueva asamblea (conjunto + unidades + asamblea en el servidor) ----------
    async function puenteCrearAsamblea(nombre, fecha) {
        const B = window.AdminPHBridge;
        if (!B || !B.isConnected()) throw new Error('Primero conéctese con el servidor en Fase 1 → 🔗 Servidor y Asamblea.');
        if (!nombre || nombre.length < 2) throw new Error('Escriba el nombre de la asamblea.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) throw new Error('La fecha debe tener el formato AAAA-MM-DD.');
        const habiaAnterior = !!B.state().assemblyId;
        if (habiaAnterior && cierreAsamblea && cierreAsamblea.registrado) archivarAsambleaActual();
        await B.createAssembly(nombre, fecha);
        if (habiaAnterior) {
            limpiarEstadoNuevaAsamblea();
            alert('✅ Nueva asamblea creada en el servidor.\n\nLa anterior queda como histórico. Se limpiaron la asistencia, las votaciones y el orden del día para empezar de cero; las unidades se conservan.\n\nRecuerde: inicie la asamblea en Fase 1 → 🔗 Servidor y Asamblea cuando vaya a comenzar.');
            window.location.reload();
        } else {
            alert('✅ Asamblea creada en el servidor (en preparación).\n\nCuando vaya a comenzar, presione «Iniciar asamblea».');
            loadModule('servidor');
        }
    }

    // ---------- Pantalla Fase 1: Servidor y Asamblea ----------
    function renderServidorModule() {
        const content = document.getElementById('mainContent');
        const B = window.AdminPHBridge;
        if (!B) {
            content.innerHTML = '<div class="card"><h2>🔗 Servidor y Asamblea</h2><div class="summary-bar alerta">No se cargó <code>js/puente-backend.js</code>. Verifique que exista y que index.html lo incluya antes de app.js.</div></div>';
            return;
        }
        const st = B.state();
        const usr = B.user();
        const conectado = B.isConnected();
        const puede = puedePrepararAsamblea();
        const s = B.status();
        const nombreConjunto = String(configConjunto.nombreConjunto || '').trim();
        const nUnidades = unidades.length;
        const nMapeadas = Object.keys(st.unitMap || {}).length;
        const cerradaLocal = asambleaCerrada();
        const estadoAsm = { preparation: 'En preparación', active: 'ACTIVA', closed: 'Cerrada', cancelled: 'Cancelada' }[st.assemblyStatus] || (st.assemblyId ? st.assemblyStatus : 'Sin asamblea');
        const hoy = new Date().toISOString().slice(0, 10);
        const dis = (!puede || !conectado) ? 'disabled' : '';

        content.innerHTML = `
        <div class="card">
            <h2>🔗 Servidor y Asamblea</h2>
            <p>Aquí se conecta AdminPH con el servidor para que los <strong>QR y los votos de los celulares sean reales</strong>. El orden es: <strong>1)</strong> conectar, <strong>2)</strong> enviar las unidades, <strong>3)</strong> crear la asamblea, <strong>4)</strong> iniciarla. Luego marque asistencia (Fase 2) y abra las votaciones (Fase 3).</p>
            <div class="summary-bar ${s.level === 'ok' ? 'ok' : 'alerta'}"><strong>🔌 ${escapeHtml(s.text)}</strong></div>
            <div id="svMsg"></div>
            ${!puede ? '<div class="summary-bar alerta">🔒 Solo el Administrador o Super Administrador puede modificar esta sección.</div>' : ''}
        </div>

        <div class="card">
            <h3>1. Conexión con el servidor</h3>
            ${conectado
                ? `<p>Conectado como <strong>${escapeHtml((usr && (usr.fullName || usr.username)) || 'usuario')}</strong>.</p><button id="svDesconectar" class="btn-secondary">Desconectar</button>`
                : `<div class="form-row">
                        <div class="form-group"><label>Usuario del servidor</label><input id="svUser" value="superadmin" autocomplete="username"></div>
                        <div class="form-group"><label>Contraseña del servidor</label><input id="svPass" type="password" autocomplete="current-password"></div>
                        <div class="form-group" style="display:flex;align-items:end;"><button id="svConectar" class="btn-primary" ${!puede ? 'disabled' : ''}>🔌 Conectar</button></div>
                   </div>
                   <p style="font-size:12px;color:#6c7a6c;">Es el usuario del <strong>servidor</strong> (backend), distinto del usuario con el que entró a esta página.</p>`}
        </div>

        <div class="card">
            <h3>2. Conjunto y unidades</h3>
            <p>Conjunto: <strong>${escapeHtml(nombreConjunto || '(sin nombre)')}</strong> · Unidades en Fase 1: <strong>${nUnidades}</strong> · Unidades enviadas al servidor: <strong>${nMapeadas}</strong>${st.propertyId ? '' : ' · <em>aún no se ha creado el conjunto en el servidor</em>'}</p>
            <button id="svSync" class="btn-primary" ${dis}>⬆ Enviar unidades al servidor</button>
            <p style="font-size:12px;color:#6c7a6c;">El conjunto se crea con el nombre de <em>Configuración</em>. Es independiente del conjunto de demostración. Los cambios posteriores en unidades y coeficientes se envían solos.</p>
        </div>

        <div class="card">
            <h3>3. Asamblea</h3>
            <p>Asamblea de trabajo: <strong>${escapeHtml(st.assemblyName || '—')}</strong> · Estado: <strong>${escapeHtml(estadoAsm)}</strong>${cerradaLocal ? ' · <span style="color:#b71c1c;">cierre definitivo registrado</span>' : ''}</p>
            <div class="form-row">
                <div class="form-group"><label>Asambleas de este conjunto en el servidor</label><select id="svAsmSel" ${dis}><option>${st.propertyId ? 'cargando…' : '(primero envíe las unidades)'}</option></select></div>
                <div class="form-group" style="display:flex;align-items:end;"><button id="svUsar" class="btn-secondary" ${dis}>Usar esta asamblea</button></div>
            </div>
            <div style="margin:10px 0;">
                <button id="svIniciar" class="btn-primary" ${dis || (st.assemblyStatus !== 'preparation' ? 'disabled' : '')}>▶ Iniciar asamblea</button>
                <button id="svCerrar" class="btn-danger" style="margin-left:8px;" ${dis || (st.assemblyStatus !== 'active' ? 'disabled' : '')}>🏁 Cerrar asamblea</button>
            </div>
            <p style="font-size:12px;color:#6c7a6c;">«Iniciar» habilita los QR de los propietarios presentes. «Cerrar» registra el cierre definitivo (igual que en Acta y trazabilidad), cierra las votaciones abiertas y deja de aceptar votos.</p>
            <h4 style="margin-top:18px;">Nueva asamblea</h4>
            <div class="form-row">
                <div class="form-group"><label>Nombre</label><input id="svNuevaNombre" placeholder="Asamblea Ordinaria ${new Date().getFullYear()}"></div>
                <div class="form-group"><label>Fecha</label><input id="svNuevaFecha" type="date" value="${hoy}"></div>
                <div class="form-group" style="display:flex;align-items:end;"><button id="svNueva" class="btn-primary" ${dis}>🆕 Crear nueva asamblea</button></div>
            </div>
            <p style="font-size:12px;color:#6c7a6c;">Si ya había una asamblea, la anterior queda como histórico en el servidor y aquí se limpian asistencia, votaciones y orden del día. Las unidades se conservan.</p>
        </div>

        <div class="card">
            <h3>4. Dirección pública para los QR</h3>
            <p style="margin-top:0;">Es la dirección con la que los <strong>celulares</strong> abren el QR. Si usted abre AdminPH desde <code>localhost</code> o desde una IP de su red, escriba aquí el enlace público (por ejemplo el de <em>Cloudflare Tunnel</em>): <code>https://votar.midominio.com</code>. Si lo deja vacío, los QR usan la misma dirección con la que abrió esta página.</p>
            <div class="form-row">
                <div class="form-group"><label>Dirección pública (opcional)</label><input id="svPublica" value="${escapeHtml(B.getPublicBase())}" placeholder="https://votar.midominio.com/"></div>
                <div class="form-group" style="display:flex;align-items:end;"><button id="svPublicaGuardar" class="btn-secondary">Guardar dirección</button></div>
            </div>
            <div id="svPublicaInfo" class="summary-bar ${B.qrBaseInfo().unusable ? 'alerta' : 'ok'}">${B.qrBaseInfo().unusable
                ? '⚠️ Está abriendo AdminPH con <strong>localhost</strong>: los QR NO funcionarán en los celulares hasta que escriba aquí la dirección pública.'
                : `Los QR se generan con: <strong>${escapeHtml(B.qrBaseInfo().base)}</strong>`}</div>
        </div>

        <div class="card">
            <h3>5. Copia de seguridad en el servidor</h3>
            <p style="margin-top:0;">Todo lo que se digita en AdminPH (configuración, unidades, asistencia, orden del día, votaciones —incluida la mano alzada— y cierre) se guarda solo en la base de datos PostgreSQL cada pocos segundos. Si cambia de navegador, de dirección o de computador, puede restaurarlo.</p>
            <div id="svSnapInfo" class="summary-bar">Consultando…</div>
            <div style="margin:10px 0;">
                <button id="svSnapNow" class="btn-primary" ${dis}>💾 Guardar copia ahora</button>
                <button id="svSnapList" class="btn-secondary" style="margin-left:8px;" ${!conectado ? 'disabled' : ''}>🕘 Ver versiones y restaurar</button>
                <button id="svSnapFile" class="btn-secondary" style="margin-left:8px;">⬇️ Descargar copia (archivo)</button>
                <button id="svSnapLoad" class="btn-secondary" style="margin-left:8px;">⬆️ Cargar copia desde archivo</button>
                <input type="file" id="svSnapFileInput" accept=".json,application/json" style="display:none;">
            </div>
            <div id="svSnapVersions"></div>
            <div id="svSnapForce"></div>
        </div>

        <div class="card">
            <h3>6. Ver la votación en vivo (opcional)</h3>
            <p>Un monitor con resultados y QR, sin controles: <a href="panel-votacion.html" target="_blank" rel="noopener">abrir panel de votación en vivo</a>.</p>
        </div>

        <div class="card">
            <h3>7. Asambleas cerradas</h3>
            <p>Cada asamblea cerrada queda guardada para consultarla (solo lectura): asistencia, votaciones, proposiciones y notas.</p>
            <button type="button" class="btn-secondary" id="svHistorial">📚 Ver asambleas cerradas</button>
        </div>`;

        { const hb = document.getElementById('svHistorial'); if (hb) hb.onclick = abrirHistorialAsambleas; }
        const msg = (tipo, txt) => { const el = document.getElementById('svMsg'); if (el) el.innerHTML = txt ? `<div class="summary-bar ${tipo}" style="margin-top:10px;">${escapeHtml(txt)}</div>` : ''; };
        const run = async (btn, texto, fn) => {
            const original = btn.textContent; btn.disabled = true; btn.textContent = texto; msg('', '');
            try { await fn(); } catch (e) { msg('alerta', e.message || 'Error inesperado'); btn.disabled = false; btn.textContent = original; return; }
            btn.textContent = original;
        };
        const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = () => fn(el); };

        on('svConectar', (b) => run(b, 'Conectando…', async () => {
            await B.login(document.getElementById('svUser').value, document.getElementById('svPass').value);
            renderServidorModule();
        }));
        on('svDesconectar', () => { B.logout(); renderServidorModule(); });
        on('svSync', (b) => run(b, 'Enviando…', async () => {
            const r = await B.syncUnits();
            renderServidorModule();
            const m = document.getElementById('svMsg'); if (m) m.innerHTML = `<div class="summary-bar ok" style="margin-top:10px;">✅ ${r.mapped} unidades enviadas${r.deactivated ? ` (${r.deactivated} antiguas desactivadas)` : ''}.</div>`;
        }));
        on('svUsar', (b) => run(b, 'Cargando…', async () => {
            const id = document.getElementById('svAsmSel').value;
            if (!id) throw new Error('Elija una asamblea de la lista.');
            await B.selectAssembly(id);
            renderServidorModule();
        }));
        on('svIniciar', (b) => run(b, 'Iniciando…', async () => {
            if (!confirm('¿Iniciar la asamblea?\n\nDesde este momento los QR de los propietarios presentes permitirán votar.')) { b.disabled = false; return; }
            await B.startAssembly();
            renderServidorModule();
            const m = document.getElementById('svMsg'); if (m) m.innerHTML = '<div class="summary-bar ok" style="margin-top:10px;">✅ Asamblea iniciada. Los QR de los presentes ya funcionan.</div>';
        }));
        on('svCerrar', (b) => run(b, 'Cerrando…', async () => {
            const hecho = await cierreDefinitivoIntegrado();
            if (!hecho) { b.disabled = false; return; }
            renderServidorModule();
        }));
        on('svNueva', (b) => run(b, 'Creando…', async () => {
            const nombre = document.getElementById('svNuevaNombre').value.trim();
            const fecha = document.getElementById('svNuevaFecha').value;
            if (st.assemblyId && !confirm('Se creará una nueva asamblea independiente. La anterior permanecerá como histórico.\n\nSe limpiarán la asistencia, las votaciones y el orden del día de esta pantalla.\n\n¿Continuar?')) { b.disabled = false; return; }
            await puenteCrearAsamblea(nombre, fecha);
        }));

        on('svPublicaGuardar', (b) => run(b, 'Guardando…', async () => {
            B.setPublicBase(document.getElementById('svPublica').value);
            renderServidorModule();
            const m = document.getElementById('svMsg'); if (m) m.innerHTML = '<div class="summary-bar ok" style="margin-top:10px;">✅ Dirección guardada. Los QR se actualizan en unos segundos.</div>';
        }));

        const pintarCopia = async () => {
            const box = document.getElementById('svSnapInfo'); if (!box) return;
            if (!conectado) { box.className = 'summary-bar alerta'; box.textContent = 'Conéctese al servidor para usar la copia de seguridad.'; return; }
            const i = await B.snapshotInfo();
            const fmt = (d) => { try { return new Date(d).toLocaleString('es-CO'); } catch (e) { return String(d); } };
            const partes = [];
            partes.push(i.server && i.server.exists ? `Copia en el servidor: <strong>${escapeHtml(fmt(i.server.updatedAt))}</strong> (${Math.round((i.server.sizeBytes || 0) / 1024)} KB)` : 'El servidor aún no tiene copia.');
            if (i.lastOkAt) partes.push(`Último guardado desde este navegador: ${escapeHtml(fmt(i.lastOkAt))}`);
            if (i.skipped && i.skipped.length) partes.push(`No se incluyeron por su tamaño: ${escapeHtml(i.skipped.join(', '))}`);
            if (i.error) partes.push(`<span style="color:#b71c1c;">${escapeHtml(i.error)}</span>`);
            box.className = 'summary-bar ok';
            box.innerHTML = partes.join('<br>');
        };
        pintarCopia().catch(() => {});
        on('svSnapNow', (b) => run(b, 'Guardando…', async () => {
            const et = prompt('Nombre para esta versión (opcional), por ejemplo "Antes de la votación 3":', '');
            if (et === null) { b.disabled = false; return; }
            await B.snapshotNow(true, (et || 'Copia manual') + ' · ' + new Date().toLocaleString('es-CO'));
            await pintarCopia();
            msg('ok', '✅ Copia guardada como una versión en el servidor.');
        }));
        on('svSnapList', (b) => run(b, 'Consultando…', async () => {
            const props = await B.snapshotProperties();
            const box = document.getElementById('svSnapVersions');
            const conCopia = props.filter(p => p.updatedAt);
            if (!conCopia.length) { box.innerHTML = '<div class="summary-bar alerta">El servidor no tiene copias guardadas.</div>'; return; }
            const fmt = (d) => { try { return new Date(d).toLocaleString('es-CO'); } catch (e) { return String(d); } };
            box.innerHTML = '<div class="form-group"><label>Conjunto</label><select id="svSnapProp">' + conCopia.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} — última copia ${escapeHtml(fmt(p.updatedAt))}</option>`).join('') + '</select></div><div id="svSnapRows"></div>';
            const pintar = async () => {
                const pid = document.getElementById('svSnapProp').value;
                const h = await B.snapshotHistory(pid);
                document.getElementById('svSnapRows').innerHTML = '<table class="data-table" style="width:100%;"><thead><tr><th>Fecha</th><th>Detalle</th><th>Tamaño</th><th></th></tr></thead><tbody>' + h.items.map(it => `<tr><td>${escapeHtml(fmt(it.savedAt))}</td><td>${escapeHtml(it.label)}</td><td>${Math.round((it.sizeBytes || 0) / 1024)} KB</td><td><button class="btn-warning svRest" data-id="${escapeHtml(it.id)}">⤵ Restaurar</button> ${/^\d+$/.test(String(it.id)) ? `<button class="btn-danger svDel" data-id="${escapeHtml(it.id)}" title="Eliminar esta versión guardada" ${esAdministrador() ? '' : 'disabled'}>🗑 Eliminar</button>` : '<small title="La copia vigente se reemplaza sola al guardar">(vigente)</small>'}</td></tr>`).join('') + '</tbody></table>';
                document.querySelectorAll('.svDel').forEach(btn => btn.addEventListener('click', async () => {
                    if (!confirm('¿Eliminar esta versión guardada?\n\nSe borra solo esta copia del historial; la copia actual y las demás versiones no cambian. No se puede deshacer.')) return;
                    btn.disabled = true;
                    try { await B.snapshotDelete(btn.dataset.id, pid); await pintar(); } catch (e) { alert('No se pudo eliminar: ' + (e.message || e)); btn.disabled = false; }
                }));
                document.querySelectorAll('.svRest').forEach(btn => btn.addEventListener('click', async () => {
                    if (!confirm('Se reemplazarán los datos de ESTE navegador por esta versión y la página se recargará.\n(Lo que hay ahora se guarda antes como una versión más.)\n\n¿Continuar?')) return;
                    btn.disabled = true;
                    try { await B.snapshotRestore(btn.dataset.id, pid); } catch (e) { alert('No se pudo restaurar: ' + (e.message || e)); btn.disabled = false; }
                }));
            };
            document.getElementById('svSnapProp').addEventListener('change', () => pintar().catch(e => alert(e.message)));
            await pintar();
        }));
        on('svSnapFile', (b) => { const n = B.snapshotToFile(); msg('ok', `✅ Se descargó el archivo con ${n} grupos de datos. Guárdelo en un lugar seguro (por ejemplo una USB o su correo).`); });
        on('svSnapLoad', () => document.getElementById('svSnapFileInput').click());
        document.getElementById('svSnapFileInput')?.addEventListener('change', async (ev) => {
            const f = ev.target.files && ev.target.files[0]; if (!f) return;
            if (!confirm('Se reemplazarán los datos de ESTE navegador por los del archivo y la página se recargará.\n\n¿Continuar?')) { ev.target.value = ''; return; }
            try { await B.snapshotFromFile(f); } catch (e) { alert(e.message || e); }
        });

        if (conectado && st.propertyId) {
            B.listAssemblies().then(lista => {
                const sel = document.getElementById('svAsmSel');
                if (!sel) return;
                const nombres = { preparation: 'en preparación', active: 'activa', closed: 'cerrada', cancelled: 'cancelada' };
                sel.innerHTML = lista.length
                    ? lista.map(a => `<option value="${escapeHtml(a.id)}" ${a.id === st.assemblyId ? 'selected' : ''}>${escapeHtml(a.name)} — ${nombres[String(a.status).toLowerCase()] || escapeHtml(a.status)}</option>`).join('')
                    : '<option value="">(aún no hay asambleas: cree una abajo)</option>';
            }).catch(() => { const sel = document.getElementById('svAsmSel'); if (sel) sel.innerHTML = '<option value="">(no se pudo leer la lista)</option>'; });
        }
    }

    // ==================== LOGIN ====================
    // Modo servidor: la página la entrega el backend (Cloudflare, servidor propio). Ahí el acceso se valida
    // SIEMPRE contra el servidor. El acceso local con claves de demostración solo existe con Live Server (desarrollo).
    const MODO_SERVIDOR = !['5500', '5501', '5502'].includes(String(location.port || ''));

    function rolDesdeServidor(u) {
        const roles = (u && u.roles) || [];
        if (roles.includes('superadmin')) return 'superadmin';
        if (roles.includes('admin')) return 'admin';
        if (roles.includes('operador')) return 'operador';
        return 'usuario';
    }

    async function login(user, pass) {
        if (MODO_SERVIDOR) {
            if (!window.AdminPHBridge) throw new Error('No se cargó el módulo de conexión con el servidor.');
            const u = await window.AdminPHBridge.login(String(user || '').trim(), pass);
            const role = rolDesdeServidor(u);
            currentUser = { name: u.fullName || u.username, role, username: u.username };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            return true;
        }
        const users = JSON.parse(localStorage.getItem('ph_users') || JSON.stringify(DEFAULT_USERS));
        if (users[user] && users[user].password === pass) {
            currentUser = { ...users[user], username: user };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            return true;
        }
        return false;
    }

    // ==================== V4.0 MENÚ LATERAL, INICIO Y ÁREA ADMINISTRATIVA ====================
    const TITULOS_FASE = { 1: 'Fase 1 · Preparación', 2: 'Fase 2 · Inicio de asamblea', 3: 'Fase 3 · Desarrollo', 4: 'Fase 4 · Acta y trazabilidad' };
    const TITULOS_AREA = { inicio: 'Inicio', reuniones: 'Reuniones virtuales', documentos: 'Gestor documental', reportes: 'Reportes y estadísticas', agenda: 'Agenda', admin: 'Administrar usuarios' };
    const AREAS_INFO = {
        reuniones: { ic: '🎥', titulo: 'Reuniones virtuales', texto: 'Asambleas no presenciales o mixtas (arts. 41 a 44 de la Ley 675).', items: ['Programar la reunión y enviar el enlace a los copropietarios', 'Registrar la asistencia virtual junto con la presencial', 'Dejar evidencia (grabación y listado) para el acta'] },
        documentos: { ic: '🗄️', titulo: 'Gestor documental', texto: 'Archivo ordenado de los documentos de cada asamblea y del conjunto.', items: ['Convocatorias, poderes, informes y estados financieros', 'Actas firmadas y soportes de votaciones', 'Búsqueda por fecha, tipo de documento y asamblea'] },
        reportes: { ic: '📊', titulo: 'Reportes y estadísticas', texto: 'Indicadores de participación y resultados entre asambleas.', items: ['Asistencia y quórum por asamblea', 'Resultados de votaciones por punto', 'Comparativo entre asambleas y exportación a Excel/PDF'] },
        agenda: { ic: '📅', titulo: 'Agenda', texto: 'Calendario de reuniones y vencimientos de la administración.', items: ['Fechas de asamblea, consejo y comités', 'Plazo de envío del acta (art. 47 de la Ley 675)', 'Recordatorios por correo o WhatsApp'] }
    };

    function ubicarSubmenu() {
        const nav = document.getElementById('navMenu'), sel = document.getElementById('faseSelector');
        if (!nav || !sel) return;
        const act = sel.querySelector('.fase-btn.activo');
        if (act) act.insertAdjacentElement('afterend', nav); else sel.appendChild(nav);
        nav.style.display = act ? '' : 'none';
        const g = document.querySelector('.sb-group[data-group="asamblea"]'); if (g && act) g.classList.add('open');
        setTitulo(TITULOS_FASE[faseActual] || 'AdminPH');
        document.querySelectorAll('.sb-item.on').forEach(x => x.classList.remove('on'));
    }
    function setTitulo(t) { const el = document.getElementById('pageTitle'); if (el) el.textContent = t; }

    function marcarSidebar(module) {
        const esArea = ['inicio', 'reuniones', 'documentos', 'reportes', 'agenda', 'admin'].includes(module);
        document.querySelectorAll('.sb-item.on').forEach(x => x.classList.remove('on'));
        if (!esArea) { const nav = document.getElementById('navMenu'); if (nav) nav.style.display = ''; setTitulo(TITULOS_FASE[faseActual] || 'AdminPH'); return; }
        document.querySelectorAll('.fase-btn').forEach(b => b.classList.remove('activo'));
        const nav = document.getElementById('navMenu'); if (nav) nav.style.display = 'none';
        const it = module === 'inicio' ? document.querySelector('.sb-home') : document.querySelector(`.sb-item[data-go="area:${module}"]`);
        if (it) { it.classList.add('on'); const g = it.closest('.sb-group'); if (g) g.classList.add('open'); }
        setTitulo(TITULOS_AREA[module] || 'AdminPH');
    }

    function navegarA(dest) {
        if (dest === 'home') { loadModule('inicio'); return; }
        if (String(dest).startsWith('area:')) { loadModule(dest.slice(5)); return; }
        const m = /^(\d):(\w+)$/.exec(dest);
        if (m) { cambiarFase(parseInt(m[1])); loadModule(m[2]); return; }
        if (String(dest).startsWith('ext:')) window.open(new URL(dest.slice(4), location.href).href, '_blank', 'noopener');
    }
    function urlDestino(dest) {
        const base = location.origin + location.pathname;
        if (dest === 'home') return base + '?modulo=inicio';
        if (String(dest).startsWith('area:')) return base + '?modulo=' + dest.slice(5);
        const m = /^(\d):(\w+)$/.exec(dest);
        if (m) return base + `?fase=${m[1]}&modulo=${m[2]}`;
        if (String(dest).startsWith('ext:')) return new URL(dest.slice(4), location.href).href;
        return base;
    }

    function renderInicioModule() {
        const nombre = (currentUser && (currentUser.name || currentUser.username)) || '';
        const tarjeta = (ic, t, d, dest, soon) => `<div class="tool-card"><div class="tool-icon">${ic}</div><h3>${t}</h3><p>${d}</p>${soon ? '<span class="tag">En desarrollo</span>' : ''}<button type="button" data-go="${dest}">${soon ? 'Ver detalle' : 'Abrir'}</button></div>`;
        document.getElementById('mainContent').innerHTML = `
            <div class="home-banner"><h2>Bienvenido${nombre ? ', ' + escapeHtml(nombre) : ''}</h2><p>Seleccione una herramienta para comenzar. Las cuatro fases de la asamblea están en el menú de la izquierda.</p></div>
            <div class="tools-grid">
                ${tarjeta('🔗', 'Servidor y asamblea', 'Conexión con el servidor, creación e inicio de la asamblea, copias de seguridad.', '1:servidor')}
                ${tarjeta('✅', 'Registro y control de quórum', 'Toma de asistencia, apoderados y verificación del quórum.', '2:asistencia')}
                ${tarjeta('🗳️', 'Votación electrónica', 'Orden del día y votaciones por QR, nominal o por coeficiente.', '3:asamblea')}
                ${tarjeta('📨', 'Envío de QR', 'Correo y WhatsApp a copropietarios y apoderados.', '2:enviarQR')}
                ${tarjeta('📋', 'Acta y trazabilidad', 'Acta de la asamblea, resultados y cierre definitivo.', '4:acta')}
                ${tarjeta('🎥', 'Reuniones virtuales', 'Programe y abra reuniones en línea, con enlace para compartir.', 'area:reuniones')}
                ${tarjeta('📅', 'Agenda', 'Calendario mensual de asambleas, reuniones y envíos de evidencias.', 'area:agenda')}
                ${tarjeta('🗄️', 'Gestor documental', 'Archivo de convocatorias, poderes y actas.', 'area:documentos', true)}
                ${tarjeta('📊', 'Reportes y estadísticas', 'Indicadores de participación y resultados.', 'area:reportes', true)}
            </div>
            <div class="quick-actions card"><h3>Acciones rápidas</h3><div class="action-buttons">
                <button type="button" class="btn-secondary" data-go="2:votoManual">📥 Votación manual (Excel)</button>
                <button type="button" class="btn-secondary" data-go="2:participacion">📐 Coef. de participación</button>
                <button type="button" class="btn-secondary" data-go="ext:panel-votacion.html">🗳️ Panel de votación en vivo</button>
                <button type="button" class="btn-secondary" data-go="ext:manual.html">📘 Manual de usuario</button>
                <button type="button" class="btn-secondary" data-go="ext:diccionario.html">📖 Diccionario PH</button>
                <button type="button" class="btn-secondary" data-go="ext:simulador-cuotas.html">🧮 Simulador de cuotas</button>
                <button type="button" class="btn-secondary" data-go="area:agenda">📅 Agenda</button>
            </div></div>
            <div class="card"><h3>📅 Próximos eventos</h3><div id="inicioAgenda"></div></div>`;
        try {
            const prox = window.AdminPHAgenda ? window.AdminPHAgenda.proximos(4) : [];
            const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
            document.getElementById('inicioAgenda').innerHTML = prox.length
                ? prox.map(o => { const f = o.fecha.split('-'); return `<div class="summary-bar" style="margin:6px 0;display:flex;gap:10px;align-items:center;"><strong>${f[2]} ${meses[+f[1] - 1]}</strong><span>${o.ev.virtual ? '🎥 ' : ''}${escapeHtml(o.ev.titulo)}${o.ev.horaIni ? ' · ' + escapeHtml(o.ev.horaIni) : ''}</span></div>`; }).join('') + '<button type="button" class="btn-secondary" data-go="area:agenda" style="margin-top:6px;">Ver la agenda</button>'
                : '<p style="color:#6c7a6c;">No hay eventos próximos. <a href="?modulo=agenda" data-go="area:agenda">Programar en la agenda</a></p>';
        } catch (_) { /* agenda opcional */ }
    }

    function renderAreaProximamente(modulo) {
        const i = AREAS_INFO[modulo]; if (!i) return;
        document.getElementById('mainContent').innerHTML = `<div class="card soon-card"><div class="big">${i.ic}</div><h2>${i.titulo}</h2><p>${i.texto}</p>
            <span class="tag" style="margin:10px 0;display:inline-block">En desarrollo — todavía no disponible</span>
            <div><ul class="soon-list">${i.items.map(x => `<li>${x}</li>`).join('')}</ul></div>
            <p style="margin-top:14px;color:var(--muted);font-size:13px">Este botón ya quedó reservado en el menú; se activará en una próxima versión.</p></div>`;
    }

    // Los botones (no enlaces) también se pueden abrir en pestaña o ventana nueva con clic derecho.
    function destinoDeElemento(el) {
        const ap = el.closest('.abrir-punto'); if (ap) return `${location.origin + location.pathname}?fase=3&modulo=asamblea&punto=${ap.dataset.id}`;
        const go = el.closest('[data-go]'); if (go) return urlDestino(go.dataset.go);
        const fb = el.closest('.fase-btn'); if (fb) return `${location.origin + location.pathname}?fase=${fb.dataset.fase}`;
        const md = el.closest('[data-module]'); if (md) return `${location.origin + location.pathname}?fase=${faseActual}&modulo=${md.dataset.module}`;
        return null;
    }
    function cerrarMenuContextual() { const m = document.getElementById('ctxMenu'); if (m) m.remove(); }
    function iniciarSidebar() {
        const sb = document.getElementById('sidebar'); if (!sb || sb.dataset.listo) return; sb.dataset.listo = '1';
        // grupos desplegables
        sb.querySelectorAll('.sb-group-title').forEach(t => t.addEventListener('click', () => t.parentElement.classList.toggle('open')));
        // enlaces internos: clic normal navega dentro de la misma página; clic derecho / Ctrl+clic usan el comportamiento del navegador
        sb.addEventListener('click', (e) => {
            const a = e.target.closest('a[data-go]'); if (!a) return;
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault(); navegarA(a.dataset.go); cerrarSidebarMovil();
        });
        // botones de la página de inicio
        document.getElementById('mainContent').addEventListener('click', (e) => {
            const b = e.target.closest('[data-go]'); if (!b || b.tagName === 'A') return;
            navegarA(b.dataset.go);
        });
        // abrir/ocultar menú
        const colapsado = (() => { try { return localStorage.getItem('adminph_sb') === 'c'; } catch (_) { return false; } })();
        if (colapsado && window.innerWidth > 960) document.body.classList.add('sb-collapsed');
        document.getElementById('sbToggle').addEventListener('click', () => {
            if (window.innerWidth <= 960) document.body.classList.toggle('sb-open');
            else { document.body.classList.toggle('sb-collapsed'); try { localStorage.setItem('adminph_sb', document.body.classList.contains('sb-collapsed') ? 'c' : 'o'); } catch (_) { /* nada */ } }
        });
        document.getElementById('sbBackdrop').addEventListener('click', cerrarSidebarMovil);
        // la fase elegida cierra el cajón en pantallas pequeñas
        sb.addEventListener('click', (e) => { if (e.target.closest('.fase-btn,.nav-menu button')) setTimeout(cerrarSidebarMovil, 50); });
        // clic derecho en botones
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('a[href]')) return;
            const url = destinoDeElemento(e.target); if (!url) return;
            e.preventDefault(); cerrarMenuContextual();
            const m = document.createElement('div'); m.id = 'ctxMenu'; m.className = 'ctx-menu';
            m.innerHTML = '<button type="button" data-a="tab">↗ Abrir en pestaña nueva</button><button type="button" data-a="win">🗗 Abrir en ventana nueva</button><button type="button" data-a="copy">🔗 Copiar enlace</button>';
            m.style.left = Math.min(e.clientX, window.innerWidth - 250) + 'px'; m.style.top = Math.min(e.clientY, window.innerHeight - 140) + 'px';
            m.addEventListener('click', (ev) => {
                const a = ev.target.closest('button'); if (!a) return;
                if (a.dataset.a === 'tab') window.open(url, '_blank');
                else if (a.dataset.a === 'win') window.open(url, '_blank', 'popup=yes,width=1366,height=820');
                else { try { navigator.clipboard.writeText(url); } catch (_) { /* nada */ } }
                cerrarMenuContextual();
            });
            document.body.appendChild(m);
        });
        document.addEventListener('click', cerrarMenuContextual);
        document.addEventListener('scroll', cerrarMenuContextual, true);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMenuContextual(); });
        // clic con la rueda (botón central)
        document.addEventListener('auxclick', (e) => {
            if (e.button !== 1 || e.target.closest('a[href]')) return;
            const url = destinoDeElemento(e.target); if (!url) return;
            e.preventDefault(); window.open(url, '_blank');
        });
    }
    function cerrarSidebarMovil() { document.body.classList.remove('sb-open'); }
    function actualizarSidebarPermisos() {
        const a = document.getElementById('sbAdminUsers'); if (a) a.style.display = puedeGestionarUsuarios() ? '' : 'none';
    }
    // Parámetros de la dirección: ?fase=3&modulo=asamblea&punto=5 (para abrir en pestaña o ventana nueva)
    function aplicarParametrosUrl() {
        let q; try { q = new URLSearchParams(location.search); } catch (_) { return; }
        const f = parseInt(q.get('fase')), mod = q.get('modulo'), pt = parseInt(q.get('punto'));
        if (!currentUser || !(f >= 1 && f <= 4 || mod)) return;
        if (f >= 1 && f <= 4) cambiarFase(f);
        if (mod) loadModule(mod);
        if (pt) setTimeout(() => { const p = puntosOrdenDia.find(x => x.id === pt); if (p && p.modulo && document.getElementById('actividadContainer')) abrirActividad(p.modulo, p.texto); }, 120);
        try { history.replaceState(null, '', location.pathname); } catch (_) { /* nada */ }
    }

    function logout() {
        if (MODO_SERVIDOR && window.AdminPHBridge) { try { window.AdminPHBridge.logout(); } catch (e) {} }
        currentUser = null;
        asambleaEdicionAutorizada = false;
        localStorage.removeItem('currentUser');
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('dashboardContainer').style.display = 'none';
        if (intervaloQuorum) clearInterval(intervaloQuorum);
    }

    function showDashboard() {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('dashboardContainer').style.display = 'flex';
        const roleInfo = ROLES[currentUser.role];
        document.getElementById('userNameDisplay').innerHTML = `${currentUser.name}`;
        document.getElementById('userRoleBadge').innerHTML = roleInfo?.name || currentUser.role;
        iniciarSidebar(); actualizarSidebarPermisos();
        cambiarFase(1);
        loadModule('inicio');
    }
// ==================== PÁGINA PÚBLICA DE VOTACIÓN POR QR ====================
function renderPaginaVotacionQR(unidadId, unidadNumero) {
    const unidad = unidades.find(u => u.id === unidadId);
    if (!unidad) {
        document.body.innerHTML = '<div style="padding:50px;text-align:center;"><h2>⚠️ Unidad no encontrada</h2><button onclick="location.reload()">Volver</button></div>';
        return;
    }

    const asistenciaUnidad = asistencia.find(a => a.unidadId === unidadId && a.presente === true);
    const unidadPresente = !!asistenciaUnidad;
    const votacionesAbiertas = [];
    ['presidente', 'secretario', 'comite', 'consejo', 'convivencia'].forEach(cargo => {
        const est = votacionEstado[cargo];
        if (est.abierta) votacionesAbiertas.push({ cargo, est });
    });

    // Verificar si ya votó en cada cargo
    const yaVoto = {};
    votacionesAbiertas.forEach(({cargo}) => {
        yaVoto[cargo] = votosQR[cargo].some(v => v.unidadId === unidadId);
    });

    let html = `
        <div style="max-width:600px;margin:50px auto;padding:20px;">
            <div class="card" style="text-align:center;">
                <h2 style="color:#2d6a4f;">🏢 ${escapeHtml(configConjunto.nombreConjunto)}</h2>
                <h3>🗳️ Votación Electrónica</h3>
                <div style="background:#e8f5e9;padding:15px;border-radius:12px;margin:15px 0;">
                    <p style="font-size:18px;"><strong>${escapeHtml(unidad.concatenado)}</strong></p>
                    <p style="font-size:16px;">${escapeHtml(unidad.propietario || 'Sin propietario registrado')}</p>
                    <p style="font-size:14px;color:#666;">Coeficiente: ${(unidad.coeficienteTotal || unidad.coeficiente || 0).toFixed(4)}%</p>
                </div>
    `;

    if (!unidadPresente) {
        html += `<div class="summary-bar alerta" style="margin-top:20px;">🚫 <strong>VOTACIÓN NO AUTORIZADA</strong><br>Esta unidad figura como <strong>ausente</strong> en la toma de asistencia. Por código QR únicamente pueden votar las unidades registradas como presentes.</div><button onclick="location.reload()" class="btn-secondary" style="margin-top:15px;">🔄 Actualizar</button>`;
    } else if (votacionesAbiertas.length === 0) {
        html += `
            <div class="summary-bar alerta" style="margin-top:20px;">
                ⏳ No hay votaciones abiertas en este momento.
            </div>
            <button onclick="location.reload()" class="btn-primary" style="margin-top:15px;">🔄 Actualizar</button>
        `;
    } else {
        votacionesAbiertas.forEach(({cargo, est}) => {
            const titulo = cargo === 'presidente' ? 'Presidente de Asamblea' : cargo === 'secretario' ? 'Secretario de Asamblea' : cargo === 'comite' ? 'Comisión Verificadora del Acta' : cargo === 'consejo' ? 'Consejo de Administración' : 'Comité de Convivencia';
            html += `<div style="border-top:2px solid #e0e8e0;margin:20px 0;padding-top:15px;">
                <h4 style="color:#2d6a4f;">🗳️ ${titulo}</h4>
                <p style="font-size:12px;color:#666;">Modalidad: <strong>${est.tipoVoto === 'coeficiente' ? 'Por Coeficiente' : est.tipoVoto === 'manoAlzada' ? 'Mano Alzada (no aplica QR)' : 'Nominal'}</strong></p>
            `;

            if (est.tipoVoto === 'manoAlzada') {
                html += `<p style="color:#e65100;">✋ Esta votación es a mano alzada. No se vota por QR.</p>`;
            } else if (yaVoto[cargo]) {
                html += `<div class="summary-bar ok">✅ Ya votó en esta elección. ¡Gracias!</div>`;
            } else if (est.candidatos.length === 0) {
                html += `<p style="color:#6c7a6c;">⏳ Aún no hay candidatos registrados.</p>`;
            } else {
                html += `<div style="margin-top:10px;">`;
                est.candidatos.forEach((c, i) => {
                    html += `
                        <label style="display:block;padding:12px;margin:8px 0;border:2px solid #d0e0d0;border-radius:10px;cursor:pointer;text-align:left;">
                            <input type="radio" name="voto_${cargo}" value="${i}" style="margin-right:10px;transform:scale(1.3);">
                            <strong>${escapeHtml(c.nombre)}</strong>
                            <br><small style="margin-left:25px;">Unidad: ${escapeHtml(c.unidadNombre)}</small>
                        </label>
                    `;
                });
                html += `</div>
                    <button class="btn-primary votar-qr-btn" data-cargo="${cargo}" style="margin-top:10px;font-size:16px;padding:12px 24px;">🗳️ ENVIAR VOTO</button>
                `;
            }
            html += `</div>`;
        });
        html += `<button onclick="location.reload()" class="btn-secondary" style="margin-top:20px;">🔄 Actualizar</button>`;
    }

    html += `</div></div>`;
    document.body.innerHTML = html;

    // Eventos de voto
    document.querySelectorAll('.votar-qr-btn').forEach(btn => {
        btn.onclick = () => {
            const cargo = btn.dataset.cargo;
            const sel = document.querySelector(`input[name="voto_${cargo}"]:checked`);
            if (!sel) { alert("Seleccione un candidato"); return; }
            const candIdx = parseInt(sel.value);
            const est = votacionEstado[cargo];
            const asistenciaActual = asistencia.find(a => a.unidadId === unidadId && a.presente === true);
            if (!asistenciaActual) { alert('🚫 VOTO NO AUTORIZADO\n\nLa unidad figura como ausente en la toma de asistencia. Solo las unidades presentes pueden votar por QR.'); location.reload(); return; }

            // Verificar de nuevo (por si votó en otra pestaña)
            if (votosQR[cargo].some(v => v.unidadId === unidadId)) {
                alert("Ya votó en esta elección");
                location.reload();
                return;
            }

            // Registrar voto
            votosQR[cargo].push({
                unidadId: unidadId,
                unidadNombre: unidad.concatenado,
                coeficiente: unidad.coeficienteTotal || unidad.coeficiente || 1,
                candidatoIdx: candIdx,
                candidatoNombre: est.candidatos[candIdx].nombre,
                timestamp: Date.now(),
                contado: false
            });

            // Guardar en localStorage (simula envío al backend)
            localStorage.setItem('votosQR', JSON.stringify(votosQR));

            alert(`✅ Voto registrado para ${est.candidatos[candIdx].nombre}`);
            location.reload();
        };
    });
}
    function checkUrlLogin() {
    const params = new URLSearchParams(location.search);
    const user = MODO_SERVIDOR ? null : params.get('user');
    if (user) {
        const users = JSON.parse(localStorage.getItem('ph_users') || JSON.stringify(DEFAULT_USERS));
        if (users[user]) {
            currentUser = { ...users[user], username: user };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            history.replaceState({}, '', location.pathname);
            showDashboard();
            return true;
        }
    }

    // ✅ ESTE BLOQUE VA DENTRO DE LA FUNCIÓN
    if (params.get('votacion')) {
        renderPaginaVotacionQR(params.get('votacion'), params.get('unidad'));
        return true;
    }

    return false;
}

    window.addEventListener('storage', (e) => {
        if (faseActual === 2 && (e.key === 'asistencia' || e.key === 'unidades') && document.getElementById('qrAsistentesGrid')) {
            renderQRAasistentesModule();
        }
    });

    // ==================== EVENTOS GLOBALES ====================
    const intentarLogin = async () => {
        const btn = document.getElementById('loginBtn');
        const msg = document.getElementById('loginMsg');
        if (msg) msg.textContent = '';
        if (btn) btn.disabled = true;
        try {
            if (await login(document.getElementById('loginUser').value, document.getElementById('loginPass').value)) showDashboard();
            else if (msg) msg.textContent = 'Credenciales incorrectas'; else alert('Credenciales incorrectas');
        } catch (e) {
            const texto = e && e.status === 401 ? 'Usuario o contraseña incorrectos' : (e && e.status ? (e.message || 'Error del servidor') : 'No se pudo conectar con el servidor.');
            if (msg) msg.textContent = texto; else alert(texto);
        } finally { if (btn) btn.disabled = false; }
    };
    document.getElementById('loginBtn').onclick = intentarLogin;
    ['loginUser', 'loginPass'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') intentarLogin(); }); });
    document.getElementById('logoutBtn').onclick = logout;
    document.querySelectorAll('.fase-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const f = parseInt(btn.dataset.fase), nav = document.getElementById('navMenu');
            // V4.2: un segundo clic sobre la fase activa pliega / despliega sus módulos.
            if (btn.classList.contains('activo') && nav && nav.style.display !== 'none' && f === faseActual) {
                const plegar = !nav.classList.contains('plegado');
                nav.classList.toggle('plegado', plegar); btn.classList.toggle('plegada', plegar);
                return;
            }
            document.querySelectorAll('.fase-btn.plegada').forEach(b => b.classList.remove('plegada'));
            if (nav) nav.classList.remove('plegado');
            cambiarFase(f);
        });
    });

    // ==================== INIT ====================
    // En la pantalla pública del propietario (?voteToken=) esta aplicación no debe arrancar
    // ni tocar los datos guardados del administrador.
    if (!new URLSearchParams(location.search).get('voteToken')) {
        cargarDatos();
        puenteRegistrar();
        setInterval(vigilarVotaciones, 1000);
        if (!checkUrlLogin()) {
            const stored = localStorage.getItem('currentUser');
            if (stored && (!MODO_SERVIDOR || localStorage.getItem('accessToken'))) { currentUser = JSON.parse(stored); if (currentUser) showDashboard(); }
        }
        // V3.9/V4.0: ?fase=3 (vuelta desde el panel en vivo) y ?fase=&modulo=&punto= (abrir en pestaña o ventana nueva)
        aplicarParametrosUrl();
    }

// ==================== MÓDULO ACTA Y TRAZABILIDAD ====================
// ==================== V4.2 ANEXOS DEL ACTA (cada uno se incluye o no) ====================
const ANEXOS_ACTA = [
    { key: 'asistentes', titulo: 'Listado de asistentes', desc: 'Unidades presentes con nombre, documento, condición y coeficiente.' },
    { key: 'totales', titulo: 'Totales y quórum', desc: 'Unidades y coeficiente presentes, quórum y coeficiente de participación.' },
    { key: 'qr', titulo: 'Constancia de códigos QR', desc: 'Qué unidades tuvieron QR de votación. No se imprime el código (es una credencial de voto).' },
    { key: 'excel', titulo: 'Votación manual en Excel', desc: 'Archivos descargados y cargados y resultados registrados desde Excel.' },
    { key: 'panel', titulo: 'Panel de votación en vivo', desc: 'Resumen de las votaciones y si fueron monitoreadas en el panel en vivo.' },
    { key: 'simulador', titulo: 'Simulador de cuotas', desc: 'Última simulación de cuotas de administración (anexo pedagógico).' },
    { key: 'archivos', titulo: 'Documentos adjuntos', desc: 'Archivos cargados en la Fase 3 para los puntos del orden del día.' }
];
function configAnexosActa() {
    let c = {}; try { c = JSON.parse(localStorage.getItem('anexosActa') || '{}') || {}; } catch (_) { c = {}; }
    if (!('asistentes' in c)) c.asistentes = true;   // el listado de asistentes siempre fue parte del acta
    return c;
}
function anexoActivo(k) { return !!configAnexosActa()[k]; }
function setAnexoActa(k, v) { const c = configAnexosActa(); c[k] = !!v; localStorage.setItem('anexosActa', JSON.stringify(c)); }

function construirAnexosActa() {
    const th = (arr) => `<thead><tr>${arr.map(x => `<th>${x}</th>`).join('')}</tr></thead>`;
    const tabla = (cab, filas) => `<table>${th(cab)}<tbody>${filas.map(f => `<tr>${f.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const fh = (iso) => { try { return new Date(iso).toLocaleString('es-CO'); } catch (_) { return iso || ''; } };
    const out = [];
    const nomUnidad = (u) => escapeHtml((u.concatenado || ('Unidad ' + u.numeroFila)).trim());
    if (anexoActivo('totales')) {
        const r = calcularQuorum(), p = calcularParticipacion();
        out.push({ key: 'totales', titulo: 'Totales y quórum', sub: 'Resumen de asistencia, quórum y coeficiente de participación',
            cuerpo: tabla(['Concepto', 'Valor'], [
                ['Unidades del conjunto', unidades.length], ['Unidades presentes', p.filas.length],
                ['Coeficiente total del conjunto', p.totalConjunto.toFixed(4) + '%'], ['Coeficiente presente', p.suma.toFixed(4) + '%'],
                ['Quórum', r.quorumOk ? 'Alcanzado' : 'No alcanzado'], ['Factor de participación (100 ÷ coeficiente presente)', p.factor.toFixed(6)]]) +
                '<h3 style="margin-top:16px;">Coeficiente de participación</h3>' +
                tabla(['Unidad', 'Asistente / Propietario', 'Coef. original', 'Coef. de participación'], p.filas.map(f => [escapeHtml(f.fila), escapeHtml(f.propietario) + (f.condicion === 'apoderado' ? ' (apoderado)' : ''), f.coef.toFixed(4) + '%', f.coefNuevo.toFixed(4) + '%'])) +
                '<div class="anexo-nota">Informativo: la Ley 675 de 2001 mide el quórum y las mayorías sobre los coeficientes de copropiedad.</div>' });
    }
    if (anexoActivo('qr')) {
        let qr = {}; try { qr = (window.AdminPHBridge && window.AdminPHBridge.state().qr) || {}; } catch (_) { qr = {}; }
        const repres = new Set(); leerApoderados().forEach(g => (g.unidadIds || []).forEach(id => { if (String(id) !== String(g.principalId)) repres.add(String(id)); }));
        let envios = 0; try { envios = (JSON.parse(localStorage.getItem('qrEnvios') || '[]') || []).length; } catch (_) { envios = 0; }
        const pres = asistencia.filter(a => a.presente === true).map(a => unidades.find(x => x.id === a.unidadId)).filter(Boolean);
        out.push({ key: 'qr', titulo: 'Constancia de códigos QR', sub: 'Unidades presentes y medio de votación habilitado',
            cuerpo: `<div class="asistencia-total">Unidades presentes: ${pres.length} · QR emitidos: ${pres.filter(u => qr[u.id]).length} · Envíos registrados (correo/WhatsApp): ${envios}</div>` +
                tabla(['#', 'Unidad', 'Medio de votación'], pres.map((u, i) => [i + 1, nomUnidad(u), repres.has(String(u.id)) ? 'Vota con el QR de su apoderado' : (qr[u.id] ? 'QR emitido' : 'Sin QR activo (voto manual o sin conexión)')])) +
                '<div class="anexo-nota">Por seguridad el acta no reproduce la imagen ni el enlace de los QR: son credenciales de voto de un solo uso por unidad.</div>' });
    }
    if (anexoActivo('excel')) {
        let lg = []; try { lg = JSON.parse(localStorage.getItem('excelManualLog') || '[]') || []; } catch (_) { lg = []; }
        const nombreTipo = { descarga: 'Archivo descargado', carga: 'Archivo cargado', registro: 'Resultado registrado' };
        const reg = listarVotacionesManual().filter(v => v.est && v.est.registroManual);
        out.push({ key: 'excel', titulo: 'Votación manual en Excel', sub: 'Archivos usados como respaldo de la votación por QR',
            cuerpo: (lg.length ? tabla(['Fecha y hora', 'Evento', 'Archivo', 'Puntos'], lg.map(e => [escapeHtml(fh(e.t)), nombreTipo[e.tipo] || escapeHtml(e.tipo), escapeHtml(e.archivo || ''), escapeHtml((e.puntos || []).join('; '))])) : '<p>No se descargaron ni cargaron archivos de votación manual en Excel.</p>') +
                (reg.length ? '<h3 style="margin-top:16px;">Resultados registrados desde Excel</h3>' + tabla(['Votación', 'Fecha de registro', 'Sin votar (coeficiente)'], reg.map(v => [escapeHtml(v.label), escapeHtml(fh(v.est.registroManual.fecha)), Number(v.est.registroManual.sinVotar || 0).toFixed(4)])) : '') });
    }
    if (anexoActivo('panel')) {
        let ses = {}; try { ses = (window.AdminPHBridge && window.AdminPHBridge.state().sessions) || {}; } catch (_) { ses = {}; }
        const lista = listarVotacionesManual().filter(v => !v.pendiente);
        const total = (v) => { const e = v.est, ops = (Array.isArray(e.opciones) && e.opciones.length) ? e.opciones : (e.candidatos || []); return ops.reduce((t, o) => t + (e.tipoVoto === 'coeficiente' ? (o.votosCoeficiente || 0) : e.tipoVoto === 'manoAlzada' ? (o.votosManoAlzada || 0) : (o.votosNominal || 0)), 0); };
        out.push({ key: 'panel', titulo: 'Panel de votación en vivo', sub: 'Votaciones realizadas y monitoreadas durante la asamblea',
            cuerpo: lista.length ? tabla(['Votación', 'Modalidad', 'Estado', 'Total', 'Monitoreada en el panel'], lista.map(v => [escapeHtml(v.label), v.est.tipoVoto === 'coeficiente' ? 'Por coeficiente' : v.est.tipoVoto === 'manoAlzada' ? 'Mano alzada' : 'Nominal / QR', v.est.abierta ? 'Abierta' : (v.est.votacionCerradaEn ? 'Cerrada' : 'Sin abrir'), v.est.tipoVoto === 'coeficiente' ? total(v).toFixed(4) : total(v), ses[v.key] ? 'Sí' : 'No'])) : '<p>No hay votaciones con opciones registradas.</p>' });
    }
    if (anexoActivo('simulador')) {
        let S = null; try { S = JSON.parse(localStorage.getItem('adminph_simulador_cuotas_v1') || 'null'); } catch (_) { S = null; }
        if (!S || !Array.isArray(S.unidades) || !S.unidades.length) out.push({ key: 'simulador', titulo: 'Simulador de cuotas', sub: 'Anexo pedagógico', cuerpo: '<p>No se registró ninguna simulación de cuotas.</p>' });
        else {
            const M = S.periodo === 'anual' ? (S.total || 0) / 12 : (S.total || 0), sumA = S.unidades.reduce((t, u) => t + (u.area || 0), 0);
            const rd = (x) => S.redondeo > 0 ? Math.round(x / S.redondeo) * S.redondeo : Math.round(x);
            const money = (n) => '$' + Math.round(n).toLocaleString('es-CO');
            const filas = S.unidades.map(u => { const c = S.fuente === 'area' ? (sumA > 0 ? (u.area || 0) / sumA : 0) : (u.coef || 0); return { n: u.nombre, c, cc: rd(c * M), cn: rd(M / S.unidades.length) }; });
            out.push({ key: 'simulador', titulo: 'Simulador de cuotas', sub: 'Anexo pedagógico: ejercicio de reparto, no reemplaza el presupuesto aprobado',
                cuerpo: `<div class="asistencia-total">Valor mensual a repartir: ${money(M)} · Unidades: ${filas.length} · Redondeo: ${S.redondeo ? money(S.redondeo) : 'pesos'}</div>` +
                    tabla(['#', 'Unidad', 'Coeficiente', 'Cuota por coeficiente', 'Cuota nominal'], filas.map((f, i) => [i + 1, escapeHtml(f.n), (f.c * 100).toFixed(4) + '%', money(f.cc), money(f.cn)])) +
                    '<div class="anexo-nota">La cuota real la aprueba la asamblea conforme al reglamento de propiedad horizontal (Ley 675 de 2001).</div>' });
        }
    }
    if (anexoActivo('archivos')) {
        out.push({ key: 'archivos', titulo: 'Documentos adjuntos', sub: 'Archivos usados en los puntos del orden del día',
            cuerpo: archivosAsamblea.length ? tabla(['#', 'Archivo', 'Punto'], archivosAsamblea.map((a, i) => [i + 1, escapeHtml(a.nombre), escapeHtml(a.punto)])) : '<p>No se registraron archivos adjuntos.</p>' });
    }
    return out;
}

function htmlTarjetaAnexosActa() {
    return `<div class="card" id="anexosActaCard"><h3>📎 Anexos del acta</h3>
        <p style="color:#6c7a6c;margin:4px 0 10px;">Elija qué anexos se agregan al final del acta en PDF. Cada anexo se incluye solo si usted lo activa.</p>
        ${ANEXOS_ACTA.map(a => { const on = anexoActivo(a.key); return `<div class="summary-bar ${on ? 'ok' : ''}" style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:6px 0;"><span><strong>${a.titulo}</strong><br><small>${a.desc}</small></span><button type="button" class="${on ? 'btn-primary' : 'btn-secondary'} anexo-toggle" data-k="${a.key}">${on ? '✅ Incluido en el acta' : '➕ No incluido · Incluir'}</button></div>`; }).join('')}
    </div>`;
}
function enlazarAnexosActa(root) {
    (root || document).querySelectorAll('.anexo-toggle').forEach(b => b.addEventListener('click', () => {
        setAnexoActa(b.dataset.k, !anexoActivo(b.dataset.k));
        const card = document.getElementById('anexosActaCard');
        if (card) { card.outerHTML = htmlTarjetaAnexosActa(); enlazarAnexosActa(document.getElementById('anexosActaCard').parentElement); }
    }));
}

function renderActaModule() {
    const content = document.getElementById('mainContent');
    const r = calcularQuorum();
    const asistentes = asistencia.filter(a => a.presente === true);
    const obtenerElegidoSimple = (key) => {
        const e=votacionEstado[key];
        if(!e || !Array.isArray(e.candidatos) || !e.candidatos.length) return null;
        if(Array.isArray(e.designadosFinales) && e.designadosFinales.length) return e.candidatos[e.designadosFinales[0]] || null;
        return [...e.candidatos].sort((a,b)=>{
            const va=e.tipoVoto==='coeficiente'?(e.candidatos.indexOf(a)>=0?(a.votosCoeficiente||0):0):e.tipoVoto==='manoAlzada'?(a.votosManoAlzada||0):(a.votosNominal||0);
            const vb=e.tipoVoto==='coeficiente'?(b.votosCoeficiente||0):e.tipoVoto==='manoAlzada'?(b.votosManoAlzada||0):(b.votosNominal||0);
            return vb-va;
        })[0] || null;
    };
    const presidenteElegido=obtenerElegidoSimple('presidente');
    const secretarioElegido=obtenerElegidoSimple('secretario');

    const decisiones = [
        {key:'ordenDia', label:'Aprobación del orden del día'},
        {key:'actaAnterior', label:'Aprobación del acta anterior'},
        {key:'financieros', label:'Aprobación de estados financieros'},
        {key:'presupuesto', label:'Aprobación de presupuesto y cuota'}
    ].map(d=>{
        const e=votacionEstado[d.key];
        if(!e || !Array.isArray(e.opciones) || !e.opciones.length) return null;
        const esMano=e.tipoVoto==='manoAlzada', esCoef=e.tipoVoto==='coeficiente';
        const opciones=e.opciones.map(o=>({nombre:o.nombre, votos:esMano?(o.votosManoAlzada||0):esCoef?(o.votosCoeficiente||0):(o.votosNominal||0)}));
        const q=resumenQuorumVotacion(e);
        return {...d, modalidad:esMano?'Mano Alzada':esCoef?'Por Coeficiente':'Nominal / QR', opciones, cerrada:!e.abierta, grafico:e.graficoResultado||null, quorum:q};
    }).filter(Boolean);
    const proposicionesPDF = (()=>{try{return JSON.parse(localStorage.getItem('proposicionesAsamblea')||'[]')}catch(e){return []}})();
    const variosInformativosPDF = (()=>{try{return JSON.parse(localStorage.getItem('variosInformativosAsamblea')||'[]')}catch(e){return []}})();

    // Preparar datos de elecciones desde votacionEstado
    const resumenElecciones = [];
    const cargos = [
        { key: 'presidente', label: 'Presidente de Asamblea' },
        { key: 'secretario', label: 'Secretario(a) de Asamblea' },
        { key: 'comite', label: 'Comisión Verificadora del Acta' },
        { key: 'consejo', label: 'Consejo de Administración' },
        { key: 'convivencia', label: 'Comité de Convivencia' },
        { key: 'revisorFiscal', label: 'Revisor Fiscal' }
    ];
    cargos.forEach(c => {
        const est = votacionEstado[c.key];
        if (!est || est.candidatos.length === 0) return;
        const esCoef = est.tipoVoto === 'coeficiente';
        const esMano = est.tipoVoto === 'manoAlzada';
        let maxV = -1, ganador = null;
        est.candidatos.forEach(cand => {
            const v = esMano ? (cand.votosManoAlzada||0) : esCoef ? (cand.votosCoeficiente||0) : (cand.votosNominal||0);
            if (v > maxV) { maxV = v; ganador = { ...cand, votos: v }; }
        });
        if (ganador) {
            const seleccionados = (c.key==='consejo' || c.key==='convivencia') && Array.isArray(est.designadosFinales) && est.designadosFinales.length ? est.designadosFinales.map(i=>est.candidatos[i]).filter(Boolean) : [ganador];
            resumenElecciones.push({
                cargo: c.label,
                ganador: seleccionados.map(x=>x.nombre).join(', '),
                unidad: seleccionados.map(x=>x.unidadNombre||'').filter(Boolean).join(', '),
                votos: seleccionados[0]?.[esMano?'votosManoAlzada':esCoef?'votosCoeficiente':'votosNominal'] || 0,
                modalidad: esMano ? 'Mano Alzada' : esCoef ? 'Por Coeficiente' : 'Nominal',
                grafico: est.graficoResultado || null,
                quorum: resumenQuorumVotacion(est)
            });
        }
    });

    content.innerHTML = `
        <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                <div>
                    <h2>📋 Acta y Trazabilidad de la Asamblea</h2>
                    <p>Vista en vivo. Se actualiza automáticamente con cada votación registrada.</p>
                </div>
                ${puedeExportarActa() ? '<button id="exportarActaBtn" class="btn-primary" style="background:#9c27b0;">📄 Exportar Acta a PDF</button>' : '<span class="summary-bar alerta" style="margin:0;">🔒 Exportación reservada a Administración</span>'}
            </div>
        </div>

        <div class="card">
            <h3>🏛️ Datos de la Copropiedad</h3>
            <div class="summary-bar">
                <div><strong>Conjunto:</strong> ${escapeHtml(configConjunto.nombreConjunto)}</div>
                <div><strong>NIT:</strong> ${escapeHtml(configConjunto.nit || 'No registrado')}</div>
                <div><strong>Ciudad:</strong> ${escapeHtml(configConjunto.ciudad || '-')}</div>
                <div><strong>Dirección:</strong> ${escapeHtml(configConjunto.direccion || '-')}</div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Administrador(a)</label><input type="text" value="${escapeHtml(configConjunto.administradorNombre||'No registrado')}" readonly></div>
                <div class="form-group"><label>Documento</label><input type="text" value="${escapeHtml(configConjunto.administradorDocumento||'-')}" readonly></div>
                <div class="form-group"><label>Fecha</label><input type="text" value="${configConjunto.fechaReunion||'-'}" readonly></div>
                <div class="form-group"><label>Hora Inicio</label><input type="text" value="${configConjunto.horaReunion||'-'}" readonly></div>
                <div class="form-group"><label>Tipo</label><input type="text" value="${configConjunto.tipoReunion}" readonly></div>
            </div>
        </div>

        <div class="card">
            <h3>🏁 Cierre de la Asamblea</h3>
            ${cierreAsamblea.registrado ? `<div class="summary-bar ok"><strong>✅ ASAMBLEA CERRADA</strong><br>Fecha de cierre: ${escapeHtml(cierreAsamblea.fecha)} · Hora de cierre: ${escapeHtml(cierreAsamblea.hora)}<br><small>Registrado por: ${escapeHtml(cierreAsamblea.cerradoPor||'-')}</small></div>` : '<div class="summary-bar alerta"><strong>⏳ Asamblea aún no cerrada</strong><br>El cierre definitivo se registra en el último punto del orden del día.</div>'}
        </div>

        <div class="card">
            <h3>📊 Quórum Actual</h3>
            <div class="summary-bar ${r.quorumOk ? 'ok' : 'alerta'}">
                <strong>${r.quorumOk ? '✅ QUÓRUM ALCANZADO' : '❌ SIN QUÓRUM — ASAMBLEA INFORMATIVA'}</strong>
                <span>Coef. presentes: ${r.coeficientesPresentes.toFixed(4)}% de ${r.totalCoeficientes.toFixed(4)}%</span>
                <span>Requerido: ${r.requerido}% + 1</span>
                <span>Unidades presentes: ${r.asistentes} de ${r.total}</span>
            </div>
        </div>

        <div class="card">
            <h3>👥 Asistentes Registrados (${asistentes.length})</h3>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>#</th><th>Unidad</th><th>Propietario / Apoderado</th><th>N° Documento</th><th>Condición</th><th>Coeficiente</th></tr></thead>
                    <tbody>
                        ${asistentes.map((a, i) => {
                            const u = unidades.find(x => x.id === a.unidadId);
                            if (!u) return '';
                            const esAp = a.condicion === 'apoderado';
                            const nombre = esAp ? (a.nombreAsistente || '-') : (u.propietario || '-');
                            const doc = esAp ? (a.numeroDocumentoAsistente || '-') : (u.numeroDocumento || '-');
                            return `<tr>
                                <td>${i+1}</td>
                                <td>${escapeHtml(u.concatenado)}</td>
                                <td>${escapeHtml(nombre)}</td>
                                <td>${escapeHtml(doc)}</td>
                                <td>${esAp ? '📄 Apoderado' : '🏠 Propietario'}</td>
                                <td>${(u.coeficienteTotal || 0).toFixed(4)}%</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="card">
            <h3>📋 Orden del Día</h3>
            <ol>${puntosOrdenDia.filter(p=>p.activo).map((p,i)=>`<li style="margin:6px 0;"><strong>${i+1}. ${escapeHtml(p.texto)}</strong> — ${p.completado?'✅ Completado':'⏳ Pendiente'}</li>`).join('')}</ol>
        </div>

        <div class="card">
            <h3>🗳️ Votaciones de aprobación</h3>
            ${decisiones.map(d=>`<div style="margin:12px 0;"><div class="summary-bar"><strong>${escapeHtml(d.label)}</strong> — ${d.modalidad} — ${d.cerrada?'🔒 Cerrada':'🟢 Abierta'}<br>${d.opciones.map(o=>`${escapeHtml(o.nombre)}: <strong style="font-size:22px;">${d.modalidad==='Por Coeficiente'?o.votos.toFixed(4):o.votos}</strong>`).join(' · ')}<br><small>⚖️ Quórum ${d.quorum.tipo}: ${d.quorum.porcentaje}% de ${d.quorum.esCoef?Number(d.quorum.base).toFixed(4)+' coeficientes presentes':d.quorum.asistentes+' asistentes presentes'} · Requeridos: ${d.quorum.esCoef?Number(d.quorum.votosRequeridos).toFixed(4):d.quorum.votosRequeridos} · ${d.quorum.aprobado?'✅ Aprobada':'❌ No aprobada'}</small></div>${d.grafico ? generarGraficoVotacionHTML(d.grafico,'Resultado final — '+d.label) : ''}</div>`).join('') || '<p>No se registraron votaciones de aprobación.</p>'}
        </div>

        ${htmlTarjetaAnexosActa()}
        <div class="card">
            <h3>📝 Proposiciones y varios</h3>
            ${proposicionesPDF.length ? proposicionesPDF.map(x=>`<div class="summary-bar" style="margin:8px 0;"><strong>${escapeHtml(x.titulo)}</strong><br>${escapeHtml(x.detalle)}<br><small>Unidad: ${escapeHtml(x.unidad||'-')} · Propietario: ${escapeHtml(x.propietario||'-')}</small></div>`).join('') : '<p>No se registraron proposiciones.</p>'}${variosInformativosPDF.length ? `<h4>📌 Varios registrados en asamblea informativa</h4>`+variosInformativosPDF.map(x=>`<div class="summary-bar alerta"><strong>${escapeHtml(x.titulo)}</strong><br>${escapeHtml(x.detalle)}<br><small>Unidad: ${escapeHtml(x.unidad||'-')} · Copropietario / solicitante: ${escapeHtml(x.propietario||'-')} · Destino: ${escapeHtml(x.destino||'Siguiente Asamblea')}</small></div>`).join('') : ''}
        </div>

        <div class="card">
            <h3>🗳️ Elecciones Realizadas</h3>
            ${resumenElecciones.length === 0 ? '<p style="color:#6c7a6c;">Aún no se han realizado elecciones con votación.</p>' : `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>Cargo</th><th>Elegidos / Resultado</th><th>Unidad</th><th>Votos</th><th>Modalidad</th><th>Quórum</th></tr></thead>
                    <tbody>
                        ${resumenElecciones.map(e => `<tr>
                            <td><strong>${escapeHtml(e.cargo)}</strong></td>
                            <td>${escapeHtml(e.ganador)}</td>
                            <td>${escapeHtml(e.unidad)}</td>
                            <td><strong style="font-size:22px;">${e.modalidad === 'Por Coeficiente' ? e.votos.toFixed(4) : e.votos}</strong></td>
                            <td>${e.modalidad}</td>
                            <td>${e.quorum.tipo} · ${e.quorum.porcentaje}% · ${e.quorum.aprobado?'✅':'❌'}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            ${resumenElecciones.map(e=>e.grafico ? generarGraficoVotacionHTML(e.grafico,'Resultado final — '+e.cargo) : '').join('')}
            `}
        </div>

        <div class="card">
            <h3>📎 Documentos y anexos utilizados en la Asamblea</h3>
            ${archivosAsamblea.length ? `<ul>${archivosAsamblea.map(a=>`<li><a href="#" class="abrir-arch-acta" data-id="${a.id}" style="font-weight:700;color:#2d6a4f;">${escapeHtml(a.nombre)}</a> — punto: ${escapeHtml(a.punto)}</li>`).join('')}</ul>` : '<p>No se registraron archivos adjuntos.</p>'}
        </div>
        <div class="card">
            <h3>📝 Proposiciones y varios</h3>
            ${(()=>{try{const ps=JSON.parse(localStorage.getItem('proposicionesAsamblea')||'[]');return ps.length?ps.map(x=>`<div class="summary-bar"><strong>${escapeHtml(x.titulo)}</strong><br>${escapeHtml(x.detalle)}<br><small>Unidad: ${escapeHtml(x.unidad||'-')} — Propietario: ${escapeHtml(x.propietario||'-')}</small></div>`).join(''):'<p>No se registraron proposiciones.</p>'}catch(e){return '<p>No se pudieron leer las proposiciones.</p>'}})()}
        </div>
        <div class="card">
            <h3>➕ Puntos agregados a la asamblea</h3>
            ${(()=>{const cs=puntosOrdenDia.filter(p=>p.activo&&String(p.modulo).startsWith('custom_'));if(!cs.length)return '<p style="color:#6c7a6c;">No se agregaron puntos adicionales.</p>';return cs.map(p=>{const ex=(votacionesExtra||[]).find(v=>v.puntoId===p.id);const e=ex&&votacionEstado[ex.key];const esMano=e&&e.tipoVoto==='manoAlzada',esCoef=e&&e.tipoVoto==='coeficiente';const res=e?(e.opciones||[]).map(o=>escapeHtml(o.nombre)+': <strong>'+(esMano?(o.votosManoAlzada||0):esCoef?Number(o.votosCoeficiente||0).toFixed(4):(o.votosNominal||0))+'</strong>').join(' · ')+' — '+(e.abierta?'🟢 Abierta':'🔒 Cerrada'):'';return `<div class="summary-bar" style="margin:8px 0;"><strong>${escapeHtml(p.texto)}</strong>${res?'<br>'+res:''}${p.notas?'<br>'+escapeHtml(p.notas).replace(/\n/g,'<br>'):''}</div>`;}).join('');})()}
        </div>
        <div class="card">
            <h3>✍️ Firmas</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:40px;">
                <div style="text-align:center;">
                    <div style="border-top:1px solid #333;padding-top:8px;">
                        <strong>${escapeHtml(presidenteElegido?.nombre || 'No seleccionado')}</strong><br>
                        <small>${escapeHtml(presidenteElegido?.unidadNombre || '')}</small><br>
                        <span>Presidente(a) de Asamblea</span>
                    </div>
                </div>
                <div style="text-align:center;">
                    <div style="border-top:1px solid #333;padding-top:8px;">
                        <strong>${escapeHtml(secretarioElegido?.nombre || 'No seleccionado')}</strong><br>
                        <small>${escapeHtml(secretarioElegido?.unidadNombre || '')}</small><br>
                        <span>Secretario(a) de Asamblea</span>
                    </div>
                </div>
                <div style="text-align:center;">
                    <div style="border-top:1px solid #333;padding-top:8px;">
                        <strong>${escapeHtml(configConjunto.administradorNombre || '-')}</strong><br>
                        <span>Administrador(a)</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    enlazarAnexosActa(content);
    content.querySelectorAll('.abrir-arch-acta').forEach(b => b.addEventListener('click', (ev) => { ev.preventDefault(); const a = archivosAsamblea.find(x => x.id === b.dataset.id); if (a) AdminPHVisor.abrir(a); }));
    document.getElementById('exportarActaBtn')?.addEventListener('click', () => { if (!puedeExportarActa()) { alert('🔒 La exportación del PDF está reservada a Administración.'); return; } exportarActaPDF(); });
}

// ==================== EXPORTAR ACTA Y ANEXOS A PDF ====================
function exportarActaPDF() {
    const r = calcularQuorum();
    const asistentes = asistencia.filter(a => a.presente === true);
    const fecha = new Date().toLocaleString('es-CO');

    const eleccionesDetalle = [];
    const cargos = [
        { key: 'presidente', label: 'Presidente de Asamblea' },
        { key: 'secretario', label: 'Secretario(a) de Asamblea' },
        { key: 'comite', label: 'Comisión Verificadora del Acta' },
        { key: 'consejo', label: 'Consejo de Administración' },
        { key: 'convivencia', label: 'Comité de Convivencia' },
        { key: 'revisorFiscal', label: 'Revisor Fiscal' }
    ];
    cargos.forEach(c => {
        const est = votacionEstado[c.key];
        if (!est || !Array.isArray(est.candidatos) || est.candidatos.length === 0) return;
        const esCoef = est.tipoVoto === 'coeficiente';
        const esMano = est.tipoVoto === 'manoAlzada';
        const candidatosOrdenados = [...est.candidatos]
            .map(cand => ({ ...cand, votos: esMano ? (cand.votosManoAlzada||0) : esCoef ? (cand.votosCoeficiente||0) : (cand.votosNominal||0) }))
            .sort((a,b)=>b.votos-a.votos);
        const indices = (c.key==='consejo' || c.key==='convivencia') && Array.isArray(est.designadosFinales) ? est.designadosFinales : null;
        const seleccionados = indices ? indices.map(i=>est.candidatos[i]).filter(Boolean) : (c.key==='comite' ? candidatosOrdenados.slice(0,3) : candidatosOrdenados.slice(0,1));
        eleccionesDetalle.push({
            cargo:c.label, key:c.key,
            modalidad:esMano?'Mano Alzada':esCoef?'Por Coeficiente':'Nominal',
            candidatos:candidatosOrdenados, seleccionados,
            ganador:seleccionados[0] || candidatosOrdenados[0],
            grafico:est.graficoResultado||null,
            quorum:resumenQuorumEleccion(est,c.key)
        });
    });

    const decisiones = [
        {key:'ordenDia', label:'Aprobación del orden del día'},
        {key:'actaAnterior', label:'Aprobación del acta anterior'},
        {key:'financieros', label:'Aprobación de estados financieros'},
        {key:'presupuesto', label:'Aprobación de presupuesto y cuota'}
    ].map(d=>{
        const e=votacionEstado[d.key];
        if(!e || !Array.isArray(e.opciones) || !e.opciones.length) return null;
        const esMano=e.tipoVoto==='manoAlzada', esCoef=e.tipoVoto==='coeficiente';
        const opciones=e.opciones.map(o=>({nombre:o.nombre, votos:esMano?(o.votosManoAlzada||0):esCoef?(o.votosCoeficiente||0):(o.votosNominal||0)}));
        const total=opciones.reduce((a,o)=>a+o.votos,0);
        const q=resumenQuorumVotacion(e);
        return {...d, modalidad:esMano?'Mano Alzada':esCoef?'Por Coeficiente':'Nominal / QR', opciones,total,cerrada:!e.abierta,grafico:e.graficoResultado||null,quorum:q};
    }).filter(Boolean);

    const proposicionesPDF = (()=>{try{return JSON.parse(localStorage.getItem('proposicionesAsamblea')||'[]')}catch(e){return []}})();
    const variosInformativosPDF = (()=>{try{return JSON.parse(localStorage.getItem('variosInformativosAsamblea')||'[]')}catch(e){return []}})();
    const ordenPDF = puntosOrdenDia.filter(p=>p.activo && !p.fueraOrdenDia);
    const nombreConjunto = escapeHtml(configConjunto.nombreConjunto);
    const orgNombre = escapeHtml(configConjunto.organizacionNombre||'AdminPH');
    const orgDatos = [configConjunto.organizacionContacto, configConjunto.organizacionTelefono, configConjunto.organizacionCorreo, configConjunto.organizacionWeb].filter(Boolean).map(escapeHtml).join(' · ');

    const pieOrganizacion = `<div class="pie-organizacion"><strong>${orgNombre}</strong>${orgDatos ? ' · '+orgDatos : ''}<br><span>Documento de trazabilidad de Asamblea · ${cierreAsamblea.registrado ? 'Cierre: '+escapeHtml(cierreAsamblea.fecha)+' '+escapeHtml(cierreAsamblea.hora) : 'Asamblea no cerrada'}</span></div>`;
    const encabezado = (titulo, subtitulo='') => `<div class="encabezado"><h1>${nombreConjunto}</h1><h2>NIT: ${escapeHtml(configConjunto.nit || 'No registrado')}</h2><div class="nit">${escapeHtml(configConjunto.ciudad || '')}${configConjunto.direccion ? ' · ' + escapeHtml(configConjunto.direccion) : ''}</div><h2 style="margin-top:8px;font-weight:bold;color:#2d6a4f;">${titulo}</h2>${subtitulo ? `<div style="font-size:10px;color:#666;margin-top:7px;">${subtitulo}</div>`:''}</div>`;

    const bloqueVotacion = (d, indice) => `<div class="votacion-bloque">
        <div class="votacion-cabecera"><span class="votacion-numero">${indice}</span><div><strong>${escapeHtml(d.label || d.cargo)}</strong><div class="votacion-meta">Modalidad: ${escapeHtml(d.modalidad)} · Estado: ${d.cerrada===false?'Abierta':'Cerrada'}</div><div class="votacion-meta">⚖️ Quórum ${escapeHtml(d.quorum?.tipo||'deliberatorio')} · ${Number(d.quorum?.porcentaje||50)}% de ${d.quorum?.esCoef ? Number(d.quorum.base||0).toFixed(4)+' coeficientes presentes' : (d.quorum?.asistentes||0)+' asistentes presentes'} · Requeridos: ${d.quorum?.esCoef ? Number(d.quorum.votosRequeridos||0).toFixed(4) : (d.quorum?.votosRequeridos||0)}</div></div></div>
        ${d.opciones ? `<div class="resultado-linea">${d.opciones.map(o=>`<span><strong>${escapeHtml(o.nombre)}:</strong> <b class="numero-voto">${d.modalidad==='Por Coeficiente'?Number(o.votos).toFixed(4):Number(o.votos).toLocaleString('es-CO')}</b></span>`).join('')}</div>` : ''}
        ${d.grafico ? generarGraficoVotacionHTML(d.grafico,'Resultado final — '+(d.label||d.cargo)) : '<div class="caja-info">No se generó gráfico porque no existen votos registrados.</div>'}
        <div class="caja-info"><strong>⚖️ Resultado frente al quórum ${escapeHtml(d.quorum?.tipo||'deliberatorio')}:</strong> ${Number(d.quorum?.porcentaje||50)}% de ${d.quorum?.esCoef ? Number(d.quorum.base||0).toFixed(4)+' coeficientes presentes' : (d.quorum?.asistentes||0)+' asistentes presentes'} · Se requerían <strong>${d.quorum?.esCoef ? Number(d.quorum.votosRequeridos||0).toFixed(4) : (d.quorum?.votosRequeridos||0)}</strong> ${d.quorum?.esCoef?'de coeficiente favorable':'votos favorables'} · ${d.quorum?.sumatoria ? `Sumatoria total: <strong>${d.quorum.esCoef?Number(d.quorum.totalVotos||0).toFixed(4):Number(d.quorum.totalVotos||0)}</strong> · ${d.quorum.aprobado?'✅ QUÓRUM ALCANZADO':'⚠️ QUÓRUM PENDIENTE'}` : (d.quorum?.aprobado?'✅ UMBRAL ALCANZADO':'❌ UMBRAL NO ALCANZADO')}</div>
        ${d.candidatos ? `<table><thead><tr><th>#</th><th>Candidato / Elegible</th><th>Unidad</th><th>Condición</th><th>Votos</th><th>Resultado</th></tr></thead><tbody>${d.candidatos.map((c,i)=>{
            const sel = Array.isArray(d.seleccionados) && d.seleccionados.some(x=>x && x.nombre===c.nombre && x.unidadNombre===c.unidadNombre);
            return `<tr><td>${i+1}</td><td><strong>${escapeHtml(c.nombre)}</strong></td><td>${escapeHtml(c.unidadNombre||'-')}</td><td>${c.condicion==='apoderado'?'Apoderado':c.condicion==='propietario'?'Propietario':'Manual'}</td><td><strong class="numero-tabla">${d.modalidad==='Por Coeficiente'?Number(c.votos).toFixed(4):Number(c.votos).toLocaleString('es-CO')}</strong></td><td>${sel?'🏆 Seleccionado':'-'}</td></tr>`;
        }).join('')}</tbody></table>` : ''}
    </div>`;

    const decisionPorKey = Object.fromEntries(decisiones.map(d=>[d.key,d]));
    const eleccionPorKey = Object.fromEntries(eleccionesDetalle.map(e=>[e.key,e]));

    const bloquePuntoOrdenPDF = (p, indice) => {
        const titulo = escapeHtml(p.texto || `Punto ${indice}`);
        let contenido = '';

        if (p.modulo === 'quorum') {
            contenido = `<div class="caja-info"><strong>Verificación de asistencia y quórum</strong><table><tr><td><strong>Total coeficientes de copropiedad:</strong></td><td>${r.totalCoeficientes.toFixed(4)}%</td></tr><tr><td><strong>Coeficientes presentes:</strong></td><td>${r.coeficientesPresentes.toFixed(4)}%</td></tr><tr><td><strong>Coeficientes ausentes:</strong></td><td>${(r.totalCoeficientes-r.coeficientesPresentes).toFixed(4)}%</td></tr><tr><td><strong>Unidades presentes:</strong></td><td>${r.asistentes} de ${r.total}</td></tr><tr><td><strong>Quórum requerido:</strong></td><td>${r.requerido}% + 1</td></tr><tr><td><strong>Estado:</strong></td><td><span class="${r.quorumOk?'badge-quorum-ok':'badge-quorum-no'}">${r.quorumOk?'✅ QUÓRUM ALCANZADO':'❌ QUÓRUM NO ALCANZADO'}</span></td></tr></table></div>`;
        } else if (p.modulo === 'presidente' || p.modulo === 'secretario' || p.modulo === 'comite' || p.modulo === 'consejo' || p.modulo === 'convivencia' || p.modulo === 'revisorFiscal') {
            const e=eleccionPorKey[p.modulo];
            contenido=e ? bloqueVotacion(e, indice) : `<div class="caja-info">No se registró una votación para este punto.</div>`;
        } else if (p.modulo === 'personalizado' || p.modulo === 'acta' || p.modulo === 'financieros' || p.modulo === 'presupuesto') {
            const keyMap={personalizado:'ordenDia',acta:'actaAnterior',financieros:'financieros',presupuesto:'presupuesto'};
            const d=decisionPorKey[keyMap[p.modulo]];
            contenido=d ? bloqueVotacion(d, indice) : `<div class="caja-info">No se registró una votación para este punto.</div>`;
        } else if (p.modulo === 'proposiciones') {
            contenido = proposicionesPDF.length
                ? proposicionesPDF.map((x,i)=>`<div class="votacion-bloque"><div class="votacion-cabecera"><span class="votacion-numero">${i+1}</span><div><strong>${escapeHtml(x.titulo)}</strong><div class="votacion-meta">Unidad: ${escapeHtml(x.unidad||'-')} · Propietario: ${escapeHtml(x.propietario||'-')}</div></div></div><div>${escapeHtml(x.detalle)}</div></div>`).join('')
                : '<div class="caja-info">No se registraron proposiciones.</div>';
        } else if (String(p.modulo).startsWith('custom_')) {
            const ex = (votacionesExtra || []).find(v => v.puntoId === p.id);
            const e = ex && votacionEstado[ex.key];
            let vot = '';
            if (e) {
                const esMano = e.tipoVoto === 'manoAlzada', esCoef = e.tipoVoto === 'coeficiente';
                const ops = (e.opciones || []).map(o => ({ nombre: o.nombre, votos: esMano ? (o.votosManoAlzada || 0) : esCoef ? (o.votosCoeficiente || 0) : (o.votosNominal || 0) }));
                vot = bloqueVotacion({ label: ex.titulo, modalidad: esMano ? 'Mano Alzada' : esCoef ? 'Por Coeficiente' : 'Nominal / QR', opciones: ops, total: ops.reduce((a, o) => a + o.votos, 0), cerrada: !e.abierta, grafico: e.graficoResultado || null, quorum: resumenQuorumVotacion(e) }, indice);
            }
            const archs = archivosAsamblea.filter(a => a.punto === p.modulo);
            contenido = vot + (p.notas ? `<div class="caja-info"><strong>Constancias:</strong><br>${escapeHtml(p.notas).replace(/\n/g, '<br>')}</div>` : '') + (archs.length ? `<div class="caja-info"><strong>Anexos:</strong> ${archs.map(a => escapeHtml(a.nombre)).join(', ')}</div>` : '') + (!vot && !p.notas && !archs.length ? `<div class="caja-info"><strong>Estado del punto:</strong> ${p.completado ? 'Completado' : 'Pendiente'}.</div>` : '');
        } else if (p.modulo === 'cierre') {
            contenido = cierreAsamblea.registrado
                ? `<div class="caja-info"><strong>ASAMBLEA CERRADA DEFINITIVAMENTE</strong><br>Fecha de cierre: ${escapeHtml(cierreAsamblea.fecha)}<br>Hora de cierre: ${escapeHtml(cierreAsamblea.hora)}<br>Registrado por: ${escapeHtml(cierreAsamblea.cerradoPor||'-')}</div>`
                : '<div class="caja-info">La asamblea no registra cierre definitivo al momento de generar este documento.</div>';
        } else {
            contenido = `<div class="caja-info"><strong>Estado del punto:</strong> ${p.completado?'Completado':'Pendiente'}.</div>`;
        }

        return `<section class="punto-pdf"><div class="punto-titulo"><span>${indice}</span><h3>${titulo}</h3></div>${contenido}</section>`;
    };

    const votacionesExtraPropias = votacionesExtra.filter(v => !v.puntoId);
    const bloqueExtraPDF = votacionesExtraPropias.length ? `<section class="punto-pdf punto-extra"><div class="punto-titulo"><span>+</span><h3>Votaciones adicionales (fuera del orden del día)</h3></div>${votacionesExtraPropias.map((v,i)=>{const e=votacionEstado[v.key];if(!e)return '';const esMano=e.tipoVoto==='manoAlzada',esCoef=e.tipoVoto==='coeficiente';const opciones=(e.opciones||[]).map(o=>({nombre:o.nombre,votos:esMano?(o.votosManoAlzada||0):esCoef?(o.votosCoeficiente||0):(o.votosNominal||0)}));const total=opciones.reduce((a,o)=>a+o.votos,0);const d={label:v.titulo,modalidad:esMano?'Mano Alzada':esCoef?'Por Coeficiente':'Nominal / QR',opciones,total,cerrada:!e.abierta,grafico:e.graficoResultado||null,quorum:resumenQuorumVotacion(e)};return bloqueVotacion(d,i+1);}).join('')}</section>` : '';

    const desarrolloOrdenPDF = ordenPDF.map((p,i)=>bloquePuntoOrdenPDF(p,i+1)).join('');
    const bloqueVariosInformativosPDF = variosInformativosPDF.length ? `<section class="punto-pdf"><div class="punto-titulo"><span>i</span><h3>Varios de la asamblea informativa</h3></div>${variosInformativosPDF.map((x,i)=>`<div class="votacion-bloque"><strong>${i+1}. ${escapeHtml(x.titulo)}</strong><div>${escapeHtml(x.detalle)}</div><div class="votacion-meta">Unidad: ${escapeHtml(x.unidad||'-')} · Copropietario / solicitante: ${escapeHtml(x.propietario||'-')} · Destino: ${escapeHtml(x.destino||'Siguiente Asamblea')}</div></div>`).join('')}</section>` : '';
    const tituloDocumentoPDF = r.quorumOk ? 'ACTA DE ASAMBLEA' : 'PDF INFORMATIVO — PRIMERA ASAMBLEA SIN QUÓRUM';
    const firmasPDF = `<section class="firmas-seccion"><h3>FIRMAS</h3><div class="firmas">
        <div class="firma-item"><div class="firma-nombre">${escapeHtml(eleccionesDetalle.find(e=>e.key==='presidente')?.seleccionados?.[0]?.nombre || 'No seleccionado')}<br><small>${escapeHtml(eleccionesDetalle.find(e=>e.key==='presidente')?.seleccionados?.[0]?.unidadNombre || '')}</small></div><div class="firma-linea"><div class="firma-cargo">Presidente(a) de Asamblea</div></div></div>
        <div class="firma-item"><div class="firma-nombre">${escapeHtml(eleccionesDetalle.find(e=>e.key==='secretario')?.seleccionados?.[0]?.nombre || 'No seleccionado')}<br><small>${escapeHtml(eleccionesDetalle.find(e=>e.key==='secretario')?.seleccionados?.[0]?.unidadNombre || '')}</small></div><div class="firma-linea"><div class="firma-cargo">Secretario(a) de Asamblea</div></div></div>
        <div class="firma-item"><div class="firma-nombre">${escapeHtml(configConjunto.administradorNombre || '-')}</div><div class="firma-linea"><div class="firma-cargo">Administrador(a)</div></div></div>
    </div></section>`;

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Acta ${nombreConjunto}</title>
    <style>
        @page { size: letter; margin: 15mm; }
        * { box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; color:#222; line-height:1.45; margin:0; padding:0; background:#fff; }
        .pagina { page-break-after:always; padding:5mm 0; min-height:240mm; }
        .pagina:last-child { page-break-after:auto; }
        .encabezado { text-align:center; border-bottom:3px double #2d6a4f; padding-bottom:12px; margin-bottom:20px; }
        .encabezado h1 { color:#2d6a4f; font-size:22px; margin:0 0 5px; }
        .encabezado h2 { font-size:14px; color:#444; margin:0; font-weight:normal; }
        .encabezado .nit { font-size:12px; color:#666; margin-top:5px; }
        .seccion { margin-bottom:18px; }
        .seccion h3, .firmas-seccion h3 { background:#e8f5e9; color:#2d6a4f; padding:9px 12px; border-radius:6px; font-size:14px; margin:0 0 12px; border-left:5px solid #2d6a4f; }
        table { width:100%; border-collapse:collapse; margin-bottom:15px; font-size:10.5px; }
        th { background:#2d6a4f; color:white; padding:7px; text-align:left; }
        td { padding:6px 7px; border-bottom:1px solid #ddd; vertical-align:top; }
        tr:nth-child(even) td { background:#f9fdf9; }
        .caja-info { background:#f8faf8; border-left:4px solid #2d6a4f; padding:10px 15px; border-radius:6px; margin-bottom:15px; font-size:12px; }
        .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .firmas { display:grid; grid-template-columns:1fr 1fr 1fr; gap:35px; margin-top:45px; }
        .firma-item { text-align:center; padding-top:4px; font-size:12px; }
        .firma-nombre { font-weight:800; min-height:20px; margin-bottom:22px; }
        .firma-linea { border-top:1px solid #333; padding-top:7px; }
        .firma-cargo { font-weight:700; }
        .badge-quorum-ok { background:#c8e6c9; color:#1b5e20; padding:4px 10px; border-radius:12px; font-weight:bold; font-size:11px; }
        .badge-quorum-no { background:#ffcdd2; color:#b71c1c; padding:4px 10px; border-radius:12px; font-weight:bold; font-size:11px; }
        .fecha-emision { font-size:10px; color:#888; text-align:right; margin-top:8px; }
        .no-print { position:fixed; top:15px; right:15px; background:#9c27b0; color:white; padding:12px 20px; border:none; border-radius:8px; cursor:pointer; font-size:14px; font-weight:bold; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,.2); }
        @media print { .no-print { display:none !important; } }
        .votacion-bloque { border:1px solid #dfe7df; border-radius:8px; padding:12px; margin:12px 0; page-break-inside:avoid; break-inside:avoid; }
        .votacion-cabecera { display:flex; align-items:flex-start; gap:10px; margin-bottom:8px; }
        .votacion-numero { width:28px; height:28px; border-radius:50%; background:#2d6a4f; color:#fff; font-weight:800; display:inline-flex; align-items:center; justify-content:center; flex:0 0 28px; }
        .votacion-meta { font-size:10px; color:#666; margin-top:2px; }
        .resultado-linea { display:flex; flex-wrap:wrap; gap:12px; padding:8px 0 10px; border-bottom:1px solid #e5e5e5; margin-bottom:10px; }
        .numero-voto, .numero-tabla { font-size:18px; font-weight:900; color:#2d6a4f; }
        .grafico-votacion { margin:12px 0 18px; padding:13px; border:1px solid #dfe7df; border-radius:10px; background:#fff; page-break-inside:avoid; break-inside:avoid; }
        .grafico-titulo { font-weight:900; font-size:14px; margin-bottom:3px; color:#2d6a4f; }
        .grafico-subtitulo { font-size:10px; color:#666; margin-bottom:8px; }
        .grafico-cuerpo { display:flex; align-items:center; gap:18px; }
        .grafico-svg { flex:0 0 220px; width:220px; }
        .grafico-leyenda { flex:1; min-width:230px; }
        .grafico-leyenda-item { display:flex; align-items:center; gap:6px; margin:6px 0; padding-bottom:5px; border-bottom:1px dotted #ddd; font-size:11px; }
        .grafico-numero { width:20px; height:20px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; background:#f0f4f0; font-size:10px; font-weight:800; }
        .grafico-color { width:12px; height:12px; border-radius:3px; flex:0 0 12px; }
        .grafico-votos { font-size:17px; color:#2d6a4f; margin-left:auto; white-space:nowrap; }
        .grafico-mayor { margin-top:9px; padding:8px 10px; background:#f0f7f1; border-left:4px solid #2d6a4f; font-size:11px; }
        .punto-pdf { margin:0 0 22px; page-break-inside:avoid; break-inside:avoid; }
        .punto-titulo { display:flex; align-items:center; gap:10px; margin-bottom:10px; page-break-after:avoid; }
        .punto-titulo > span { width:30px; height:30px; border-radius:50%; background:#2d6a4f; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:800; flex:0 0 30px; }
        .punto-titulo h3 { margin:0; flex:1; background:#e8f5e9; color:#2d6a4f; padding:9px 12px; border-radius:6px; border-left:5px solid #2d6a4f; font-size:14px; }
        .punto-extra .punto-titulo > span { background:#9c27b0; }
        .punto-extra .punto-titulo h3 { color:#7b1fa2; border-left-color:#9c27b0; background:#f3e5f5; }
        .anexo-nota { font-size:10px; color:#666; margin-bottom:12px; }
        .asistencia-total { font-size:12px; font-weight:700; margin-bottom:10px; }
        .pie-organizacion { margin-top:25px; padding-top:10px; border-top:1px solid #ddd; text-align:center; font-size:9px; color:#666; }
    </style></head><body>
    <button class="no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>

    <!-- PÁGINA INICIAL: IDENTIFICACIÓN Y ORDEN -->
    <div class="pagina">
        ${encabezado(`ACTA DE ASAMBLEA ${configConjunto.tipoReunion.toUpperCase()}`, cierreAsamblea.registrado ? `Cierre registrado: ${escapeHtml(cierreAsamblea.fecha)} · ${escapeHtml(cierreAsamblea.hora)} · Documento generado: ${escapeHtml(fecha)}` : `Documento generado: ${escapeHtml(fecha)}`)}
        <div class="caja-info"><div class="grid-2"><div><strong>Fecha:</strong> ${configConjunto.fechaReunion || '-'}</div><div><strong>Hora de inicio:</strong> ${configConjunto.horaReunion || '-'}</div><div><strong>Administrador(a):</strong> ${escapeHtml(configConjunto.administradorNombre || 'No registrado')}</div><div><strong>Documento:</strong> ${escapeHtml(configConjunto.administradorDocumento || '-')}</div></div></div>
        <div class="seccion"><h3>ORDEN DEL DÍA</h3><ol style="font-size:13px;line-height:1.8;">${ordenPDF.map((p,i)=>`<li style="padding:5px 0;border-bottom:1px solid #e2e8e2;"><strong>${i+1}. ${escapeHtml(p.texto)}</strong> — ${p.completado?'Completado':'Pendiente'}</li>`).join('')}</ol></div>
        <div class="caja-info"><strong>Documento de trazabilidad:</strong> Los resultados y actuaciones se presentan a continuación siguiendo exactamente el orden de los puntos de la asamblea. Las votaciones adicionales, por no pertenecer al orden del día original, se incorporan después de los puntos ordinarios y antes del cierre. El listado de asistentes se incorpora exclusivamente al final como anexo.</div>
    </div>

    <!-- DESARROLLO EN EL MISMO ORDEN DEL DÍA -->
    <div class="pagina">
        ${encabezado('DESARROLLO DE LA ASAMBLEA','Resultados y actuaciones organizados según el orden de los puntos tratados')}
        ${desarrolloOrdenPDF}
        ${bloqueVariosInformativosPDF}
        ${r.quorumOk ? bloqueExtraPDF : ''}
        ${firmasPDF}
        <div class="fecha-emision">Documento generado el ${fecha} · AdminPH</div>
    </div>

    <!-- ANEXO DE ASISTENTES (opcional) -->
    ${!anexoActivo('asistentes') ? '' : `<div class="pagina">
        ${encabezado('ANEXO 1 · LISTADO DE ASISTENTES','El listado de asistentes se incorpora al final del acta como anexo de trazabilidad')}
        <div class="asistencia-total">Total de unidades presentes: ${asistentes.length} · Coeficiente presente: ${r.coeficientesPresentes.toFixed(4)}%</div>
        <table><thead><tr><th>#</th><th>Unidad</th><th>Nombre</th><th>Documento</th><th>Condición</th><th>Coeficiente</th></tr></thead><tbody>
        ${asistentes.map((a,i)=>{const u=unidades.find(x=>x.id===a.unidadId);if(!u)return '';const esAp=a.condicion==='apoderado';const nombre=esAp?(a.nombreAsistente||'-'):(u.propietario||'-');const doc=esAp?(a.numeroDocumentoAsistente||'-'):(u.numeroDocumento||'-');return `<tr><td>${i+1}</td><td>${escapeHtml(u.concatenado)}</td><td>${escapeHtml(nombre)}</td><td>${escapeHtml(doc)}</td><td>${esAp?'Apoderado':'Propietario'}</td><td>${(u.coeficienteTotal||0).toFixed(4)}%</td></tr>`;}).join('')}
        </tbody></table>
        <div class="anexo-nota">Este listado corresponde exclusivamente a las unidades registradas como presentes en la toma de asistencia de la asamblea.</div>
        <div class="fecha-emision">Anexo generado el ${fecha} · AdminPH</div>
        ${pieOrganizacion}
    </div>`}

    <!-- OTROS ANEXOS ELEGIDOS -->
    ${construirAnexosActa().map((a, i) => `<div class="pagina">${encabezado('ANEXO ' + ((anexoActivo('asistentes') ? 2 : 1) + i) + ' · ' + a.titulo.toUpperCase(), a.sub)}${a.cuerpo}<div class="fecha-emision">Anexo generado el ${fecha} · AdminPH</div>${pieOrganizacion}</div>`).join('')}

    </body></html>`;

    const ventana = window.open('', '_blank');
    ventana.document.write(html);
    ventana.document.close();
}



    // ==================== NUEVA ASAMBLEA ====================
    // Ver también Fase 1 → 🔗 Servidor y Asamblea (misma lógica, con formulario).
    async function crearNuevaAsamblea() {
        if (!confirm("Se creará una nueva asamblea independiente. La anterior permanecerá como histórico.\n\n¿Continuar?")) return;
        const nombre = prompt("Nombre de la nueva asamblea:", "Asamblea Ordinaria 2027");
        if (!nombre) return;
        const fecha = prompt("Fecha (AAAA-MM-DD):", "2027-03-15");
        if (!fecha) return;
        try {
            await puenteCrearAsamblea(nombre.trim(), fecha.trim());
        } catch (error) {
            console.error(error);
            alert("❌ No fue posible crear la nueva asamblea\n" + error.message);
        }
    }

    function limpiarEstadoNuevaAsamblea() {

    console.log("🧹 Limpiando estado de asamblea anterior");


    // Memoria RAM
    if (typeof asistencia !== "undefined") asistencia = [];

    if (typeof votaciones !== "undefined") votaciones = [];

    if (typeof votacionesExtra !== "undefined") votacionesExtra = [];

    if (typeof votosQR !== "undefined") votosQR = {};

    if (typeof cierreAsamblea !== "undefined") {
        cierreAsamblea = {
            registrado:false,
            fecha:"",
            hora:"",
            cerradoPor:""
        };
    }

    if (typeof asambleaEdicionAutorizada !== "undefined") {
        asambleaEdicionAutorizada = false;
    }


    // LocalStorage
    const clavesAsamblea = [

        "asistencia",
        "votaciones",
        "votacionesExtra",
        "votosQR",
        "qrEnvios",
        "apoderadosAsamblea",

        "votacionApertura",
        "votacionEstado",

        "puntosOrdenDia",

        "archivoAsamblea",
        "archivosAsamblea",
        "proposicionesAsamblea",
        "variosInformativosAsamblea",

        "contadorPuntos",

        "cierreAsamblea",
        "excelManualLog"

    ];


    clavesAsamblea.forEach(k => {

        localStorage.removeItem(k);

    });


    console.log("✅ Estado limpio");
}


})();