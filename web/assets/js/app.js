/* ============================================================================
 * app.js · Núcleo de interfaz: paletas de color, modales, avisos y ajustes
 * ----------------------------------------------------------------------------
 * SISTEMA DE PALETAS
 * Cada tema define un conjunto de variables CSS. Al aplicar un tema se
 * escriben sobre el elemento <html> (variables CSS raíz), de modo que TODO el
 * sitio —incluida la estética retro-pixelada— cambia de color a la vez.
 *
 *   --bg, --panel, --texto, --borde, --acento   → variables base (contrato)
 *   --t-*                                       → variables derivadas
 *                                                   (superficies, bordes,
 *                                                   botones, acentos…)
 *
 * Para añadir un tema nuevo: copia un objeto de TEMAS, cambia `id`, `nombre`,
 * `descripcion` y los valores. No hay que tocar nada más: el selector del
 * panel de administrador se genera a partir de esta lista.
 *
 * PERSISTENCIA
 *   · Settings (IndexedDB, store "ajustes") → fuente de verdad.
 *   · localStorage "lp_tema"                → espejo síncrono que permite
 *     aplicar el tema antes del primer pintado y así evitar parpadeos.
 *
 * AJUSTES GLOBALES (los consume el panel del administrador)
 *   maxGenerar, maxTarjetas, permitirBorrarHistorial, tema, claveAdmin.
 * ========================================================================== */
"use strict";

/* Escape de HTML compartido por todos los módulos (nav, tabla de verdad…). */
function esc(texto) {
  return String(texto === undefined || texto === null ? "" : texto).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

(function (global) {
  /* ------------------------------------------------------------------ */
  /* Paletas disponibles                                                 */
  /* ------------------------------------------------------------------ */
  const TEMAS = [
    {
      id: "oscuro",
      nombre: "Modo Oscuro Cyberpunk",
      descripcion: "Nocheigital con acentos magenta y cian.",
      "--bg": "#12162a",
      "--panel": "#1e2440",
      "--texto": "#e6ebff",
      "--borde": "#080a14",
      "--acento": "#7d7bff",
      "--t-nav": "#0d0f1a",
      "--t-panel-2": "#2a2f4d",
      "--t-surface": "#171a2c",
      "--t-surface-2": "#1a1e33",
      "--t-alto": "#333a63",
      "--t-linea": "#3a4062",
      "--t-linea-2": "#444b70",
      "--t-texto-2": "#c3c7dc",
      "--t-texto-3": "#8f96b5",
      "--t-fbf": "#e6e4ff",
      "--t-acento-2": "#5a56d6",
      "--t-acento-3": "#3c3999",
      "--t-acento-luz": "#6d6bff",
      "--t-acento-linea": "#4c5196",
      "--t-acento-linea-2": "#5f66c9",
      "--t-acento-texto": "#c7c4ff",
      "--t-acento-fondo": "rgba(125,123,255,0.16)",
      "--t-verde": "#3eda8b",
      "--t-verde-texto": "#aef2cf",
      "--t-verde-osc": "#173a26",
      "--t-btn-verde": "#23a25f",
      "--t-verde-tenue": "#2b8f60",
      "--t-verde-fondo": "rgba(62,218,139,0.14)",
      "--t-ambar": "#ffb43d",
      "--t-ambar-texto": "#ffd98a",
      "--t-ambar-osc": "#7a531c",
      "--t-ambar-tenue": "#caa14a",
      "--t-ambar-fondo": "rgba(255,180,61,0.16)",
      "--t-btn-ambar": "#59421a",
      "--t-naranja": "#ff9a52",
      "--t-naranja-fondo": "rgba(255,154,82,0.16)",
      "--t-naranja-borde": "#b06a22",
      "--t-btn-naranja": "#e07b34",
      "--t-rosa": "#ff6bd6",
      "--t-rosa-tenue": "#8f3f77",
      "--t-btn-rosa": "#d03f9d",
      "--t-rojo": "#ff5c6e",
      "--t-rojo-tenue": "#8f2f3c",
      "--t-rojo-fondo": "rgba(255,92,110,0.16)",
      "--t-btn-rojo": "#d13a4e",
      "--t-btn-azul": "#5a56d6",
      "--t-btn-gris": "#3a4166",
      "--t-gris": "#7d849f",
      "--t-tabla-fila": "#1d2137",
      "--t-tabla-th": "#333a63",
      "--t-aviso-fondo": "#2a2214",
      "--t-aviso-borde": "#caa14a",
      "--t-foco": "#ffb43d",
      "--t-info-fondo": "#23353f",
      "--t-info-fondo-2": "#2f4a5e",
      "--t-info-texto": "#bfe9ff",
      "--t-portal": "rgba(23,26,44,0.94)",
      "--t-placeholder": "#6d7390"
    },
    {
      id: "neon",
      nombre: "Neón Synthwave",
      descripcion: "Magenta y violeta sobre noche morada.",
      "--bg": "#150030",
      "--panel": "#22094a",
      "--texto": "#ffeaff",
      "--borde": "#080015",
      "--acento": "#ff2bd6",
      "--t-nav": "#0c0022",
      "--t-panel-2": "#2c0d5e",
      "--t-surface": "#180036",
      "--t-surface-2": "#2a0b58",
      "--t-alto": "#3d1177",
      "--t-linea": "#4a1a7d",
      "--t-linea-2": "#64259c",
      "--t-texto-2": "#f0c9ff",
      "--t-texto-3": "#b47fd6",
      "--t-fbf": "#ffd6fb",
      "--t-acento-2": "#c918a8",
      "--t-acento-3": "#8c0f77",
      "--t-acento-luz": "#ff8ce8",
      "--t-acento-linea": "#6b1b57",
      "--t-acento-linea-2": "#93276f",
      "--t-acento-texto": "#ff9cec",
      "--t-acento-fondo": "rgba(255,43,214,0.14)",
      "--t-verde": "#2bf0ff",
      "--t-verde-texto": "#a9f6ff",
      "--t-btn-verde": "#0f8b9c",
      "--t-verde-tenue": "#166a75",

            "--t-verde-osc": "#06382f",
      "--t-ambar-osc": "#6b4d10",
            "--t-verde-fondo": "rgba(43,240,255,0.12)",
      "--t-ambar": "#ffd166",
      "--t-ambar-texto": "#ffe6a8",
      "--t-ambar-tenue": "#7c5f18",
      "--t-ambar-fondo": "rgba(255,209,102,0.14)",
      "--t-btn-ambar": "#8a6410",
      "--t-naranja": "#ff8f5a",
      "--t-naranja-fondo": "rgba(255,143,90,0.14)",
      "--t-naranja-borde": "#a35a2a",
      "--t-btn-naranja": "#b3561f",
      "--t-rosa": "#ff2bd6",
      "--t-rosa-tenue": "#8f1a70",
      "--t-btn-rosa": "#a31a80",
      "--t-rojo": "#ff4f7d",
      "--t-rojo-tenue": "#8f2348",
      "--t-rojo-fondo": "rgba(255,79,125,0.14)",
      "--t-btn-rojo": "#b32552",
      "--t-btn-azul": "#5b3fd4",
      "--t-btn-gris": "#3a1163",
      "--t-gris": "#9a6fbf",
      "--t-tabla-fila": "#1c0343",
      "--t-tabla-th": "#38106c",
      "--t-aviso-fondo": "#3a1c05",
      "--t-aviso-borde": "#ffd166",
      "--t-foco": "#ffd166",
      "--t-info-fondo": "#0d2a3d",
      "--t-info-fondo-2": "#14405c",
      "--t-info-texto": "#9fe4ff",
      "--t-portal": "rgba(30,8,60,0.94)",
      "--t-placeholder": "#8a5fae"
    },
    {
      id: "retro",
      nombre: "Retro Terminal 8-bit",
      descripcion: "Verde fósforo sobre negro, como una máquina de 1986.",
      "--bg": "#04140a",
      "--panel": "#07230f",
      "--texto": "#5cff7a",
      "--borde": "#000000",
      "--acento": "#5cff7a",
      "--t-nav": "#021008",
      "--t-panel-2": "#0b3316",
      "--t-surface": "#03110a",
      "--t-surface-2": "#0a2c14",
      "--t-alto": "#12441f",
      "--t-linea": "#1c5c2e",
      "--t-linea-2": "#2a7a40",
      "--t-texto-2": "#8cffa2",
      "--t-texto-3": "#4fae68",
      "--t-fbf": "#c8ffd4",
      "--t-acento-2": "#2fae4b",
      "--t-acento-3": "#1c7d33",
      "--t-acento-luz": "#a6ffb8",
      "--t-acento-linea": "#1c5c2e",
      "--t-acento-linea-2": "#2a7a40",
      "--t-acento-texto": "#a6ffb8",
      "--t-acento-fondo": "rgba(92,255,122,0.10)",
      "--t-verde": "#5cff7a",
      "--t-verde-texto": "#a6ffb8",
      "--t-btn-verde": "#1c7d33",
      "--t-verde-tenue": "#1c5c2e",

            "--t-verde-osc": "#0a3520",
      "--t-ambar-osc": "#5c4a0f",
            "--t-verde-fondo": "rgba(92,255,122,0.12)",
      "--t-ambar": "#ffd23f",
      "--t-ambar-texto": "#ffe89a",
      "--t-ambar-tenue": "#6f5a12",
      "--t-ambar-fondo": "rgba(255,210,63,0.14)",
      "--t-btn-ambar": "#6f5a12",
      "--t-naranja": "#ff9f43",
      "--t-naranja-fondo": "rgba(255,159,67,0.14)",
      "--t-naranja-borde": "#8a5a1a",
      "--t-btn-naranja": "#8a5a1a",
      "--t-rosa": "#ff7ad9",
      "--t-rosa-tenue": "#7d3567",
      "--t-btn-rosa": "#8a3a72",
      "--t-rojo": "#ff5555",
      "--t-rojo-tenue": "#7d2b2b",
      "--t-rojo-fondo": "rgba(255,85,85,0.14)",
      "--t-btn-rojo": "#9c2b2b",
      "--t-btn-azul": "#1c7d33",
      "--t-btn-gris": "#14522a",
      "--t-gris": "#4fae68",
      "--t-tabla-fila": "#06200f",
      "--t-tabla-th": "#11431d",
      "--t-aviso-fondo": "#2b2405",
      "--t-aviso-borde": "#ffd23f",
      "--t-foco": "#ffd23f",
      "--t-info-fondo": "#06301f",
      "--t-info-fondo-2": "#0b452c",
      "--t-info-texto": "#8cffa2",
      "--t-portal": "rgba(6,32,15,0.94)",
      "--t-placeholder": "#2f7a45"
    },
    {
      id: "claro",
      nombre: "Claro Clásico",
      descripcion: "Papel crema con tinta oscura y bordes nítidos.",
      "--bg": "#efe9dc",
      "--panel": "#fbf7ee",
      "--texto": "#221c14",
      "--borde": "#2b2118",
      "--acento": "#6d3fd4",
      "--t-nav": "#2b2118",
      "--t-panel-2": "#e6dcc9",
      "--t-surface": "#fffdf8",
      "--t-surface-2": "#ece2cd",
      "--t-alto": "#d9ccb0",
      "--t-linea": "#a2937a",
      "--t-linea-2": "#8c7d63",
      "--t-texto-2": "#3d3327",
      "--t-texto-3": "#6b5f4e",
      "--t-fbf": "#3a2c7a",
      "--t-acento-2": "#5a30b8",
      "--t-acento-3": "#45238f",
      "--t-acento-luz": "#8f74ff",
      "--t-acento-linea": "#a08fe0",
      "--t-acento-linea-2": "#8a76d6",
      "--t-acento-texto": "#4a2f9e",
      "--t-acento-fondo": "rgba(109,63,212,0.12)",
      "--t-verde": "#1f7a4d",
      "--t-verde-texto": "#12603c",
      "--t-btn-verde": "#1e7a4b",
      "--t-verde-tenue": "#2f8f60",

            "--t-verde-osc": "#cde9da",
      "--t-ambar-osc": "#f0dcb4",
            "--t-verde-fondo": "rgba(31,122,77,0.12)",
      "--t-ambar": "#b06a12",
      "--t-ambar-texto": "#8a4f0c",
      "--t-ambar-tenue": "#c79a4a",
      "--t-ambar-fondo": "#fdf1d8",
      "--t-btn-ambar": "#7a5510",
      "--t-naranja": "#c2570c",
      "--t-naranja-fondo": "#fbe3d2",
      "--t-naranja-borde": "#b06a22",
      "--t-btn-naranja": "#a8480a",
      "--t-rosa": "#b4308f",
      "--t-rosa-tenue": "#c76fae",
      "--t-btn-rosa": "#9c2a7a",
      "--t-rojo": "#c0334a",
      "--t-rojo-tenue": "#d97d8c",
      "--t-rojo-fondo": "#fbe0e4",
      "--t-btn-rojo": "#a52a3e",
      "--t-btn-azul": "#5a30b8",
      "--t-btn-gris": "#6b5f4e",
      "--t-gris": "#8c7d63",
      "--t-tabla-fila": "#fbf7ee",
      "--t-tabla-th": "#e6dcc9",
      "--t-aviso-fondo": "#fdf1d8",
      "--t-aviso-borde": "#b06a12",
      "--t-foco": "#b06a12",
      "--t-info-fondo": "#dde7f2",
      "--t-info-fondo-2": "#c4d5e8",
      "--t-info-texto": "#1f3f63",
      "--t-portal": "rgba(251,247,238,0.96)",
      "--t-placeholder": "#9a8d77"
    },
    {
      id: "pastel",
      nombre: "Pastel / Academia",
      descripcion: "Tinta azulada y acentos suaves de cuaderno.",
      "--bg": "#f7f4fb",
      "--panel": "#ffffff",
      "--texto": "#3b3852",
      "--borde": "#4a4368",
      "--acento": "#7b6bd6",
      "--t-nav": "#4a4368",
      "--t-panel-2": "#ece7f6",
      "--t-surface": "#fdfcff",
      "--t-surface-2": "#efebf8",
      "--t-alto": "#ddd6ee",
      "--t-linea": "#c3badb",
      "--t-linea-2": "#a79cc4",
      "--t-texto-2": "#565275",
      "--t-texto-3": "#7d7996",
      "--t-fbf": "#3f3a7a",
      "--t-acento-2": "#6355b8",
      "--t-acento-3": "#4c419a",
      "--t-acento-luz": "#9d90ec",
      "--t-acento-linea": "#c4bcf0",
      "--t-acento-linea-2": "#a79bec",
      "--t-acento-texto": "#53489f",
      "--t-acento-fondo": "rgba(123,107,214,0.12)",
      "--t-verde": "#4aa87a",
      "--t-verde-texto": "#2f7a55",
      "--t-btn-verde": "#3d9068",
      "--t-verde-tenue": "#8cc4ab",

            "--t-verde-osc": "#cfe7db",
      "--t-ambar-osc": "#f3e4c4",
            "--t-verde-fondo": "#e4f4ec",
      "--t-ambar": "#c98a2b",
      "--t-ambar-texto": "#8a611c",
      "--t-ambar-tenue": "#e0c48f",
      "--t-ambar-fondo": "#fdf3e0",
      "--t-btn-ambar": "#a5761f",
      "--t-naranja": "#d98248",
      "--t-naranja-fondo": "#fceadd",
      "--t-naranja-borde": "#d9a97f",
      "--t-btn-naranja": "#b96b32",
      "--t-rosa": "#d371a8",
      "--t-rosa-tenue": "#e8b3d1",
      "--t-btn-rosa": "#b35c90",
      "--t-rojo": "#cf5f6e",
      "--t-rojo-tenue": "#eaa9b1",
      "--t-rojo-fondo": "#fbe6e8",
      "--t-btn-rojo": "#b04a58",
      "--t-btn-azul": "#6355b8",
      "--t-btn-gris": "#7d7996",
      "--t-gris": "#a79cc4",
      "--t-tabla-fila": "#ffffff",
      "--t-tabla-th": "#ece7f6",
      "--t-aviso-fondo": "#fdf3e0",
      "--t-aviso-borde": "#c98a2b",
      "--t-foco": "#7b6bd6",
      "--t-info-fondo": "#e6eefb",
      "--t-info-fondo-2": "#d3e0f5",
      "--t-info-texto": "#33507f",
      "--t-portal": "rgba(255,255,255,0.96)",
      "--t-placeholder": "#a79cc4"
    },
    {
      id: "contraste",
      nombre: "Alto Contraste",
      descripcion: "Negro puro, blanco puro y amarillo de aviso.",
      "--bg": "#000000",
      "--panel": "#000000",
      "--texto": "#ffffff",
      "--borde": "#ffffff",
      "--acento": "#ffe600",
      "--t-nav": "#000000",
      "--t-panel-2": "#000000",
      "--t-surface": "#000000",
      "--t-surface-2": "#000000",
      "--t-alto": "#000000",
      "--t-linea": "#ffffff",
      "--t-linea-2": "#ffffff",
      "--t-texto-2": "#ffffff",
      "--t-texto-3": "#e6e6e6",
      "--t-fbf": "#ffffff",
      "--t-acento-2": "#ffe600",
      "--t-acento-3": "#ccb500",
      "--t-acento-luz": "#ffe600",
      "--t-acento-linea": "#ffe600",
      "--t-acento-linea-2": "#ffe600",
      "--t-acento-texto": "#ffe600",
      "--t-acento-fondo": "rgba(255,230,0,0.16)",
      "--t-verde": "#00ff85",
      "--t-verde-texto": "#00ff85",
      "--t-btn-verde": "#004d2a",
      "--t-verde-tenue": "#00ff85",

            "--t-verde-osc": "#003318",
      "--t-ambar-osc": "#3a3300",
            "--t-verde-fondo": "rgba(0,255,133,0.16)",
      "--t-ambar": "#ffe600",
      "--t-ambar-texto": "#ffe600",
      "--t-ambar-tenue": "#ffe600",
      "--t-ambar-fondo": "rgba(255,230,0,0.16)",
      "--t-btn-ambar": "#4d4400",
      "--t-naranja": "#ff9a00",
      "--t-naranja-fondo": "rgba(255,154,0,0.16)",
      "--t-naranja-borde": "#ff9a00",
      "--t-btn-naranja": "#663d00",
      "--t-rosa": "#ff5cc8",
      "--t-rosa-tenue": "#ff5cc8",
      "--t-btn-rosa": "#5c0a44",
      "--t-rojo": "#ff2b2b",
      "--t-rojo-tenue": "#ff2b2b",
      "--t-rojo-fondo": "rgba(255,43,43,0.20)",
      "--t-btn-rojo": "#6e0000",
      "--t-btn-azul": "#0047ab",
      "--t-btn-gris": "#2b2b2b",
      "--t-gris": "#ffffff",
      "--t-tabla-fila": "#000000",
      "--t-tabla-th": "#222222",
      "--t-aviso-fondo": "#1c1c00",
      "--t-aviso-borde": "#ffe600",
      "--t-foco": "#ffe600",
      "--t-info-fondo": "#001a33",
      "--t-info-fondo-2": "#002b52",
      "--t-info-texto": "#8fd3ff",
      "--t-portal": "rgba(0,0,0,0.96)",
      "--t-placeholder": "#9a9a9a"
    }
  ];

  const TEMAS_POR_ID = {};
  TEMAS.forEach(function (t) { TEMAS_POR_ID[t.id] = t; });

  const K_AJUSTES_TEMA = "tema";
  const K_TEMA_RAPIDO = "lp_tema";

  /* Ajustes por defecto: los lee el panel admin y los consulta cada módulo. */
  const AJUSTES_POR_DEFECTO = {
    maxGenerar: 0,
    maxTarjetas: 0,
    permitirBorrarHistorial: true,
    tema: "oscuro",
    claveAdmin: null
  };

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */
  function esNumero(v) { return typeof v === "number" && isFinite(v); }

  function enteros(o) {
    const out = {};
    Object.keys(o || {}).forEach(function (k) {
      if (k.slice(0, 2) === "--") out[k] = o[k];
    });
    return out;
  }

  const App = {
    TEMAS: TEMAS,
    AJUSTES_POR_DEFECTO: AJUSTES_POR_DEFECTO,

    /* Caché de ajustes globales (límites del administrador). */
    ajustes: null,

    /* -------------------------------------------------------------- */
    /* Paletas                                                         */
    /* -------------------------------------------------------------- */

    temaPorId: function (id) { return TEMAS_POR_ID[id] || null; },
    temaActual: function () { return TEMAS_POR_ID[this.temaId] || TEMAS_POR_ID[AJUSTES_POR_DEFECTO.tema]; },
    nombresTemas: function () {
      return TEMAS.map(function (t) { return { id: t.id, nombre: t.nombre, descripcion: t.descripcion }; });
    },

    /* Aplica una paleta escribiendo todas sus variables en <html>. */
    aplicarTema: function (id, opciones) {
      const ajustes = opciones || {};
      const tema = this.temaPorId(id) || this.temaPorId(AJUSTES_POR_DEFECTO.tema);
      const root = document.documentElement;
      const vars = enteros(tema);

      Object.keys(vars).forEach(function (k) { root.style.setProperty(k, vars[k]); });
      root.setAttribute("data-tema", tema.id);
      this.temaId = tema.id;

      /* Espejo síncrono: permite repintar el tema antes del primer dibujado. */
      try { localStorage.setItem(K_TEMA_RAPIDO, tema.id); } catch (e) { /* modo privado */ }

      if (ajustes.persistir !== false && global.Storage && typeof Storage.ajustesSet === "function") {
        try { Storage.ajustesSet(K_AJUSTES_TEMA, tema.id); } catch (e) { /* ignorar */ }
      }
      document.dispatchEvent(new CustomEvent("tema:cambio", { detail: { tema: tema.id } }));
      return tema;
    },

    /* Aplica el tema guardado sin esperar a IndexedDB (evita el parpadeo). */
    aplicarTemaGuardado: function () {
      let id = null;
      try { id = localStorage.getItem(K_TEMA_RAPIDO); } catch (e) { id = null; }
      if (!id || !TEMAS_POR_ID[id]) id = AJUSTES_POR_DEFECTO.tema;
      this.temaId = id;
      return this.aplicarTema(id, { persistir: false });
    },

    /* Sincroniza el tema con el valor persistido en IndexedDB. */
    sincronizarTema: async function () {
      const ajustes = await this.cargarAjustes();
      return this.aplicarTema(ajustes.tema);
    },

    /* -------------------------------------------------------------- */
    /* Ajustes globales y límites del administrador                    */
    /* -------------------------------------------------------------- */

    cargarAjustes: async function () {
      const base = Object.assign({}, AJUSTES_POR_DEFECTO);
      let guardados = {};
      try {
        if (global.Storage && typeof Storage.ajustesGetTodos === "function") {
          guardados = (await Storage.ajustesGetTodos({})) || {};
        }
      } catch (e) { guardados = {}; }

      const ajustes = Object.assign(base, guardados);
      ajustes.maxGenerar = esNumero(ajustes.maxGenerar) && ajustes.maxGenerar > 0 ? Math.floor(ajustes.maxGenerar) : 0;
      ajustes.maxTarjetas = esNumero(ajustes.maxTarjetas) && ajustes.maxTarjetas > 0 ? Math.floor(ajustes.maxTarjetas) : 0;
      ajustes.permitirBorrarHistorial = ajustes.permitirBorrarHistorial !== false;
      if (!TEMAS_POR_ID[ajustes.tema]) ajustes.tema = AJUSTES_POR_DEFECTO.tema;

      this.ajustes = ajustes;
      return ajustes;
    },

    guardarAjuste: async function (clave, valor) {
      if (!this.ajustes) await this.cargarAjustes();
      this.ajustes[clave] = valor;
      try {
        if (global.Storage && typeof Storage.ajustesSet === "function") await Storage.ajustesSet(clave, valor);
      } catch (e) { /* ignorar */ }
      /* Avisa a los módulos que muestran los límites (p. ej. Módulo Directo). */
      try {
        document.dispatchEvent(new CustomEvent("ajustes:cambio", {
          detail: { clave: clave, valor: valor, ajustes: this.ajustes }
        }));
      } catch (e) { /* navegadores sin CustomEvent */ }
      return valor;
    },

    limites: function () {
      const a = this.ajustes || AJUSTES_POR_DEFECTO;
      return { maxGenerar: a.maxGenerar || 0, maxTarjetas: a.maxTarjetas || 0 };
    },

    /* Comprueba si se pueden crear `cantidad` tarjetas más.
       Devuelve { ok, limite, actuales, restantes }. */
    comprobarTarjetas: function (cantidad) {
      const lim = this.limites().maxTarjetas;
      const pedir = Math.max(1, cantidad || 1);
      if (!lim) return { ok: true, limite: 0, restantes: Infinity };
      const actuales = this.contarTarjetas();
      const restantes = lim - actuales;
      return { ok: restantes >= pedir, limite: lim, actuales: actuales, restantes: Math.max(0, restantes) };
    },

    /* El conteo real de tarjetas vive en el módulo Directo; si no está
       disponible se considera 0 para no bloquear por un dato ausente. */
    contarTarjetas: function () {
      return typeof global.contarTarjetasActivas === "function" ? global.contarTarjetasActivas() : 0;
    },

    /* Comprueba el límite de generación por lotes (maxGenerar). */
    comprobarGenerar: function (cantidad) {
      const lim = this.limites().maxGenerar;
      if (!lim) return { ok: true, limite: 0 };
      return { ok: cantidad <= lim, limite: lim };
    },

    /* Muestra el modal de límite (#modal-limite) o, si la página no lo tiene,
       un aviso flotante equivalente. */
    avisoLimite: function (mensaje) {
      const texto = mensaje || "Límite del administrador alcanzado.";
      const modal = document.getElementById("modal-limite");
      if (modal) {
        const destino = document.getElementById("modal-limite-msg");
        if (destino) destino.textContent = texto;
        this.abrirModal("modal-limite");
        return true;
      }
      this.toast(texto, "error");
      return false;
    },

    /* -------------------------------------------------------------- */
    /* Modales y avisos                                               */
    /* -------------------------------------------------------------- */

    abrirModal: function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove("hidden");
      el.setAttribute("aria-hidden", "false");
      const foco = el.querySelector("button, [href], input, select, textarea");
      if (foco) foco.focus();
    },

    cerrarModal: function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add("hidden");
      el.setAttribute("aria-hidden", "true");
    },

    toast: function (msg, tipo) {
      let cont = document.getElementById("toast-container");
      if (!cont) {
        cont = document.createElement("div");
        cont.id = "toast-container";
        cont.className = "toast-contenedor";
        document.body.appendChild(cont);
      }
      const t = document.createElement("div");
      t.className = "toast-pixel toast-" + (tipo === "error" ? "error" : tipo === "ok" ? "ok" : "info");
      t.setAttribute("role", "status");
      t.textContent = msg;
      cont.appendChild(t);
      setTimeout(function () { t.remove(); }, 3000);
    }
  };

  global.App = App;

  /* Aplica el tema guardado en cuanto se analiza el script: si app.js se carga
     en <head> el color correcto está puesto antes del primer pintado. */
  App.aplicarTemaGuardado();

  /* Cuando Storage termine de responder, se aplica el tema definitivo. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { App.sincronizarTema(); });
  } else {
    App.sincronizarTema();
  }
})(window);