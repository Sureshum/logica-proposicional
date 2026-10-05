/* ==========================================================================
 * Service worker de «Lógica Proposicional».
 *
 * Objetivo: que la app siga siendo utilizable sin conexión sin dejar nunca
 * una versión vieja pegada en el navegador.
 *
 * Estrategias:
 *   · Páginas (navegaciones) → red primero, caché de reserva. Así una
 *     versión desplegada nueva se ve al instante y, sin red, se sirve la
 *     última copia guardada.
 *   · Recursos con hash de versión → caché primero y revalidación en
 *     segundo plano (rápido y sin esperas).
 *   · Lo que sea de otro origen (Tailwind CDN, Google Fonts) → red directa,
 *     sin caché: son recursos de terceros y pueden cambiar.
 *
 * IMPORTANTE: al publicar cambios hay que subir VERSION. Es el mecanismo que
 * invalida la caché anterior: si no se sube, los visitors que ya visited el
 * sitio siguen viendo la versión vieja.
 * ========================================================================== */

const VERSION = "v3";
const CACHE = `lp-cache-${VERSION}`;

/* Solo los archivos propios y estables del sitio. */
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
  "assets/js/workbench.js",
  "assets/js/sortable.min.js",
  "assets/favicon.svg",
];

/* --------------------------------------------------------------------------
 * Instalación: se precachea todo el esqueleto.
 * addAll() es atómico: si un solo archivo falla, no se cachea ninguno. Por eso
 * se avisa en consola en lugar de tragarse el error con un catch vacío.
 * ----------------------------------------------------------------------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const fallos = [];
      await Promise.all(
        FILES.map(async (ruta) => {
          try {
            const res = await fetch(new Request(ruta, { cache: "reload" }));
            if (!res || !res.ok) throw new Error(`HTTP ${res && res.status}`);
            await cache.put(ruta, res);
          } catch (err) {
            fallos.push(`${ruta} (${err.message})`);
          }
        })
      );
      if (fallos.length) console.warn("[sw] no se pudieron precachear:", fallos);
      await self.skipWaiting();
    })()
  );
});

/* --------------------------------------------------------------------------
 * Activación: se borran las cachés antiguas y se toma el control de las
 * pestañas abiertas, para que la versión nueva entre sin esperar a que se
 * cierren.
 * ----------------------------------------------------------------------- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

/* --------------------------------------------------------------------------
 * Peticiones.
 * ----------------------------------------------------------------------- */
const esPropio = (url) => url.origin === self.location.origin;
const esPagina = (request) => request.mode === "navigate" ||
  (esPropio(request.url) && new URL(request.url).pathname.endsWith(".html"));

async function redPrimero(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok && esPropio(request.url)) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const guardada = await cache.match(request, { ignoreSearch: true });
    if (guardada) return guardada;
    /* Sin red y sin copia: si es una página, la portada sirve de refugio. */
    if (esPagina(request)) {
      const portada = await cache.match("index.html");
      if (portada) return portada;
    }
    throw err;
  }
}

async function cachePrimeroRevalidando(request) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(request, { ignoreSearch: false });
  const red = fetch(request)
    .then((res) => {
      if (res && res.ok && esPropio(request.url)) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  /* Se devuelve la copia guardada si la hay; si no, se espera a la red. */
  return guardada || red.then((res) => res || Response.error());
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  /* Recursos de terceros: siempre directo a la red, sin caché ni Service Worker. */
  if (!esPropio(url)) return;

  event.respondWith(esPagina(request) ? redPrimero(request) : cachePrimeroRevalidando(request));
});

/* Permite a la página forzar la actualización (se usa tras publicar). */
self.addEventListener("message", (event) => {
  if (event.data === "lp-actualizar") self.skipWaiting();
});
