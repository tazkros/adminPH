// AdminPH · Service Worker (PWA). Solo guarda archivos estáticos de la interfaz.
// Los datos (API, votaciones, asistencia) NUNCA se guardan: siempre van a la red.
const CACHE = "adminph-v4-2";
const BASE = ["./", "index.html", "manifest.json", "css/style.css", "css/pwa.css", "js/pwa.js", "simulador-cuotas.html", "js/simulador-cuotas.js", "js/agenda.js", "js/visor-archivos.js",
  "js/app.js", "js/api.js", "js/puente-backend.js", "js/xlsxmini.js", "icons/icon-192.png", "icons/icon-512.png"];
const ESTATICO = /\.(?:html|css|js|png|jpg|jpeg|svg|ico|json|woff2?)$/i;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(BASE.map(a => c.add(a).catch(() => null)))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (!(req.mode === "navigate" || ESTATICO.test(url.pathname))) return; // API y datos: directo a la red
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.status === 200) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
