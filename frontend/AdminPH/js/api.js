console.info("AdminPH api.js V0.8 (Patch V1) cargado");
const API_URL = (window.ADMINPH_CONFIG?.API_URL || `http://${location.hostname || "localhost"}:3000/api`).replace(/\/$/, "");

async function apiLogin(username, password) {
    const response = await fetch(
        `${API_URL}/auth/login`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        }
    );

    const data = await leerRespuestaApi(response);

    if (!response.ok) {
        const mensaje = obtenerMensajeApi(data) || "Error de autenticación";
        const error = new Error(mensaje);
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}

async function leerRespuestaApi(response) {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (error) {
        return text;
    }
}

function obtenerMensajeApi(data) {
    if (!data) return "";
    if (typeof data === "string") return data;
    if (Array.isArray(data.message)) return data.message.join(" · ");
    return data.message || data.error || "";
}

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem("accessToken");
    const isFormData = options.body instanceof FormData;

    const headers = {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
        `${API_URL}${endpoint}`,
        {
            ...options,
            headers
        }
    );

    const data = await leerRespuestaApi(response);

    if (!response.ok) {
        const mensaje = obtenerMensajeApi(data) || `Error HTTP ${response.status}`;
        const error = new Error(mensaje);
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}

// ==================== PROPIEDADES / CONFIGURACIÓN ====================
async function apiListProperties() {
    return apiRequest("/properties");
}

async function apiGetPropertyConfig(propertyId) {
    return apiRequest(`/properties/${encodeURIComponent(propertyId)}/config`);
}

async function apiSavePropertyConfig(propertyId, config) {
    return apiRequest(`/properties/${encodeURIComponent(propertyId)}/config`, {
        method: "PUT",
        body: JSON.stringify({ config })
    });
}

// ==================== UNIDADES / COEFICIENTES ====================
async function apiListPropertyUnits(propertyId) {
    return apiRequest(`/properties/${encodeURIComponent(propertyId)}/units`);
}

async function apiSyncPropertyUnits(propertyId, units, replaceMissing = true) {
    return apiRequest(`/properties/${encodeURIComponent(propertyId)}/units/sync`, {
        method: "PUT",
        body: JSON.stringify({ units, replaceMissing })
    });
}

async function apiUpdatePropertyUnit(propertyId, unitId, unit) {
    // El endpoint individual usa unitId en la URL.
    // No debemos reenviar "id" en el body ni enviar "coeficienteTotal",
    // porque el backend lo calcula a partir de coeficiente + coeficienteParqueadero.
    const payload = {
        numeroFila: unit.numeroFila,
        concatenado: unit.concatenado,
        tipo: unit.tipo,
        jerarquia: unit.jerarquia || {},
        propietario: unit.propietario || "",
        numeroDocumento: unit.numeroDocumento || "",
        correo: unit.correo || "",
        telefono: unit.telefono || "",
        coeficiente: Number(unit.coeficiente) || 0,
        coeficienteParqueadero: Number(unit.coeficienteParqueadero) || 0,
        sextoNivelValor: unit.sextoNivelValor || ""
    };

    return apiRequest(`/properties/${encodeURIComponent(propertyId)}/units/${encodeURIComponent(unitId)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
    });
}

async function apiDeactivatePropertyUnit(propertyId, unitId) {
    return apiRequest(`/properties/${encodeURIComponent(propertyId)}/units/${encodeURIComponent(unitId)}`, {
        method: "DELETE"
    });
}

// ==================== ASAMBLEA / ASISTENCIA ====================
async function apiListPropertyAssemblies(propertyId) {
    return apiRequest(`/assemblies/property/${encodeURIComponent(propertyId)}`);
}

async function apiGetCurrentPropertyAssembly(propertyId) {
    return apiRequest(`/assemblies/property/${encodeURIComponent(propertyId)}/current`);
}

async function apiCreateAssembly(payload) {

    return apiRequest("/assemblies", {

        method: "POST",

        body: JSON.stringify(payload)

    });

}

async function apiGetAssemblyAttendance(assemblyId) {
    return apiRequest(`/assemblies/${encodeURIComponent(assemblyId)}/attendance`);
}

async function apiUpsertAssemblyAttendance(assemblyId, unitId, payload) {
    return apiRequest(`/assemblies/${encodeURIComponent(assemblyId)}/attendance/${encodeURIComponent(unitId)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
    });
}

async function apiProvisionAssemblyQr(assemblyId) {
    return apiRequest(`/assemblies/${encodeURIComponent(assemblyId)}/qr-tokens/provision`, {
        method: "POST"
    });
}

async function apiListAssemblyQr(assemblyId) {
    return apiRequest(`/assemblies/${encodeURIComponent(assemblyId)}/qr-tokens`);
}

async function apiReissueAssemblyQr(assemblyId, unitId) {
    return apiRequest(`/assemblies/${encodeURIComponent(assemblyId)}/attendance/${encodeURIComponent(unitId)}/qr/reissue`, {
        method: "POST"
    });
}


// ==================== ASAMBLEA: INICIAR / CERRAR (Patch V1) ====================
// El acceso por QR solo funciona con la asamblea en estado "active".
async function apiStartAssembly(assemblyId) {
    return apiRequest(`/assemblies/${encodeURIComponent(assemblyId)}/start`, { method: "POST" });
}

async function apiCloseAssembly(assemblyId) {
    return apiRequest(`/assemblies/${encodeURIComponent(assemblyId)}/close`, { method: "POST" });
}

// ==================== VOTACIONES (ADMINISTRADOR / OPERADOR) ====================
async function apiListVotingSessions(assemblyId) {
    return apiRequest(`/assemblies/${encodeURIComponent(assemblyId)}/voting-sessions`);
}

async function apiCreateVotingSession(assemblyId, payload) {
    return apiRequest(`/assemblies/${encodeURIComponent(assemblyId)}/voting-sessions`, {
        method: "POST",
        body: JSON.stringify(payload)
    });
}

async function apiAddVotingOption(sessionId, label) {
    return apiRequest(`/voting-sessions/${encodeURIComponent(sessionId)}/options`, {
        method: "POST",
        body: JSON.stringify({ label })
    });
}

async function apiOpenVotingSession(sessionId) {
    return apiRequest(`/voting-sessions/${encodeURIComponent(sessionId)}/open`, { method: "POST" });
}

async function apiCloseVotingSession(sessionId) {
    return apiRequest(`/voting-sessions/${encodeURIComponent(sessionId)}/close`, { method: "POST" });
}

async function apiArchiveVotingSession(sessionId) {
    return apiRequest(`/voting-sessions/${encodeURIComponent(sessionId)}/archive`, { method: "POST" });
}

async function apiGetVotingResults(sessionId) {
    return apiRequest(`/voting-sessions/${encodeURIComponent(sessionId)}/results`);
}

// ==================== VOTACIÓN PÚBLICA POR QR FIRMADO ====================
// Estas llamadas NO usan la sesión del administrador: el propietario solo
// presenta el token firmado que trae su QR (?voteToken=...).
async function apiPublicRequest(endpoint, options = {}) {
    const headers = options.body ? { "Content-Type": "application/json" } : {};
    // V3.5: si la conexión se corta un instante (túnel, Wi-Fi, reinicio del servidor) las consultas
    // se reintentan solas hasta 3 veces antes de mostrar un error. El envío del voto no se repite.
    const esConsulta = !options.method || String(options.method).toUpperCase() === "GET";
    let response, intento = 0;
    for (;;) {
        try {
            response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
            if (esConsulta && [502, 503, 504, 520, 521, 522, 523, 524, 530].includes(response.status) && intento < 3) { intento++; await new Promise((r) => setTimeout(r, 700 * intento)); continue; }
            break;
        } catch (err) {
            if (!esConsulta || intento >= 3) throw err;
            intento++;
            await new Promise((r) => setTimeout(r, 700 * intento));
        }
    }
    const data = await leerRespuestaApi(response);

    if (!response.ok) {
        const error = new Error(obtenerMensajeApi(data) || `Error HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

async function apiPublicVotingAccess(token) {
    return apiPublicRequest(`/public/voting/access?token=${encodeURIComponent(token)}`);
}

async function apiPublicCastVote(sessionId, token, optionId) {
    return apiPublicRequest(`/public/voting/sessions/${encodeURIComponent(sessionId)}/vote`, {
        method: "POST",
        body: JSON.stringify({ token, optionId })
    });
}

async function apiGetProxyGroups(assemblyId) {
    return apiRequest(`/assemblies/${encodeURIComponent(assemblyId)}/proxy-groups`);
}
