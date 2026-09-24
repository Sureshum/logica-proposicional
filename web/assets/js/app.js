/* =========================================================================
   Utilidades compartidas de la versión 100% navegador (GitHub Pages).
   - esc():  escapa HTML para prevenir inyección al renderizar contenido.
   La lógica de dominio (parser, semántica, generador, NLP y ML) vive en
   los módulos parser.js, semantica.js, generador.js, nlp.js y ml.js,
   cargados antes que este archivo en cada página.
   ========================================================================= */
"use strict";

function esc(texto) {
  return String(texto).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}