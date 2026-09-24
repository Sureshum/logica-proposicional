/* =========================================================================
   Utilidades compartidas por todas las páginas del sistema.
   ========================================================================= */

/** Escapa caracteres HTML para prevenir inyección al renderizar contenido. */
function esc(texto) {
  return String(texto).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/**
 * Envía una petición a un endpoint de la API y devuelve la respuesta ya
 * convertida a objeto JavaScript.
 *
 * @param {string} url   dirección del endpoint.
 * @param {Object} datos datos a enviar (para POST; ignorados en GET).
 * @param {string} metodo método HTTP (por defecto "POST").
 */
async function apiFetch(url, datos, metodo) {
  metodo = metodo || "POST";
  try {
    const respuesta = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: metodo === "GET" ? undefined : JSON.stringify(datos || {}),
    });
    return await respuesta.json();
  } catch (err) {
    return { ok: false, error: "No se pudo conectar con el servidor." };
  }
}