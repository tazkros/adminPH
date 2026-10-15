// AdminPH - configuración del entorno del frontend.
//
// Dónde busca la página a la API (backend):
//  1) Si abrió la página con Live Server (puerto 5500/5501/5502): la API está en el mismo equipo, puerto 3000.
//  2) Si el propio backend entrega la página (modo "un solo enlace", con Cloudflare Tunnel o en un servidor):
//     la API está en el MISMO origen, ruta /api.
//  3) Si publica el frontend en otro sitio (por ejemplo su hosting) y el backend en otro, escriba aquí la
//     dirección fija:  API_URL: "https://api.sudominio.com/api"
(function () {
    var manual = "";   // <- ejemplo: "https://api.sudominio.com/api"
    var port = String(location.port || "");
    var liveServer = port === "5500" || port === "5501" || port === "5502";
    var api;
    if (manual) api = manual;
    else if (liveServer) api = (location.protocol === "https:" ? "https:" : "http:") + "//" + (location.hostname || "localhost") + ":3000/api";
    else api = location.origin + "/api";
    window.ADMINPH_CONFIG = { API_URL: api };
})();
