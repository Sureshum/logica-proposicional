const CACHE = "lp-cache-v1";
const FILES = [
  "index.html",
  "login.html",
  "registro.html",
  "directo.html",
  "inverso.html",
  "ml.html",
  "assets/css/estilos.css",
  "assets/js/app.js",
  "assets/js/auth.js",
  "assets/js/asistente.js",
  "assets/js/builder-multi.js",
  "assets/js/generador.js",
  "assets/js/ml.js",
  "assets/js/nlp.js",
  "assets/js/parser.js",
  "assets/js/portal.js",
  "assets/js/semantica.js",
  "assets/js/storage.js",
  "assets/js/ui-admin.js",
  "assets/js/sortable.min.js",
  "assets/favicon.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(()=>{}));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
});
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(()=>r))
  );
});
