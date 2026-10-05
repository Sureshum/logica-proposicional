/* ============================================================================
 * ui-admin.js · Panel exclusivo del administrador
 * ----------------------------------------------------------------------------
 * El panel SOLO se renderiza y se muestra si la sesión tiene rol `admin`
 * (comprobado en Auth.mostrarPanelAdmin() y aquí, antes de pintar nada).
 *
 * Qué permite configurar:
 *   1. LÍMITES   → maxGenerar  (propuestas por lote de "Generar todas")
 *                 maxTarjetas  (tarjetas de construcción totales)
 *   2. PALETAS   → tema visual global del sitio (App.TEMAS)
 *   3. SEGURIDAD → clave maestra para registrar cuentas de administrador
 *   4. CUENTAS   → rol de cada cuenta del dispositivo (Auth.setRol)
 *   5. HISTORIAL → consulta y limpieza (si el ajuste lo permite)
 *
 * Todos los ajustes se guardan con App.guardarAjuste → Storage (IndexedDB) y,
 * en el caso del tema, también en el espejo local que permite repintar la
 * página sin parpadeo.
 * ========================================================================== */
"use strict";

(function (global) {
  const el = function (id) { return document.getElementById(id); };

  /* Muestra de color de una paleta: fondo, panel, acento y texto. */
  function muestras(tema) {
    return '<span class="paleta-muestras" aria-hidden="true">' +
      '<span style="background:' + tema["--bg"] + '"></span>' +
      '<span style="background:' + tema["--panel"] + '"></span>' +
      '<span style="background:' + tema["--acento"] + '"></span>' +
      '<span style="background:' + tema["--t-ambar"] + '"></span>' +
      '<span style="background:' + tema["--t-verde"] + '"></span>' +
      '<span style="background:' + tema["--t-rosa"] + '"></span>' +
      "</span>";
  }

  const AdminUI = {
    /* ------------------------------------------------------------------ */
    /* Arranque                                                          */
    /* ------------------------------------------------------------------ */
    async init() {
      const root = el("panel-admin");
      if (!root) return;
      if (!this.tienePermiso()) return this.ocultar();

      const ajustes = await App.cargarAjustes();
      const claveAdmin = await Auth.claveAdmin();
      this.render(Object.assign({}, ajustes, { claveAdmin: claveAdmin }));
      this.bind();
      /* Si esta página no trae App aplicado (p.ej. portada), se sincroniza. */
      App.aplicarTema(ajustes.tema);
    },

    /* Doble comprobación de rol: nada se renderiza para un participante. */
    tienePermiso() {
      return !!(global.Auth && Auth.esAdmin());
    },

    ocultar() {
      const root = el("panel-admin");
      if (!root) return;
      root.innerHTML = "";
      root.classList.add("hidden");
      root.hidden = true;
    },

    /* ------------------------------------------------------------------ */
    /* Render                                                             */
    /* ------------------------------------------------------------------ */
    render(a) {
      const root = el("panel-admin");
      if (!root || !this.tienePermiso()) return;

      const paletas = App.TEMAS.map((t) => {
        const activo = t.id === a.tema;
        return '<button type="button" class="paleta-opcion" data-tema="' + t.id + '"' +
          ' aria-pressed="' + (activo ? "true" : "false") + '"' +
          ' title="' + esc(t.descripcion) + '">' +
          muestras(t) +
          "<span>" + esc(t.nombre) + "</span>" +
          '<span class="paleta-desc">' + esc(t.descripcion) + "</span>" +
          "</button>";
      }).join("");

      root.className = "caja admin-panel p-5 mt-6";
      root.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 class="pixel-titulo text-amber-700">Panel del Administrador</h2>
          <span class="rol-aviso">Sesión con privilegios ${Auth.insigniaHTML("admin")}</span>
        </div>

        <div class="grid md:grid-cols-2 gap-4">

          <!-- 1 · Límites -->
          <section class="admin-seccion">
            <h3>1 · Límites del sistema</h3>
            <div class="admin-campo">
              <label for="admin-max-generar">Máx. proposiciones por lote ("Generar todas")</label>
              <input id="admin-max-generar" type="number" min="0" max="99" value="${a.maxGenerar || 0}">
              <p class="ayuda">0 = sin límite. Si un participante pide más, se abre el modal de límite.</p>
            </div>
            <div class="admin-campo">
              <label for="admin-max-tarjetas">Máx. tarjetas de construcción</label>
              <input id="admin-max-tarjetas" type="number" min="0" max="200" value="${a.maxTarjetas || 0}">
              <p class="ayuda">0 = sin límite. Cuenta las tarjetas de la lista, incluidas las creadas
                con el workbench, negaciones y combinaciones.</p>
            </div>
            <p id="admin-resumen-limites" class="ayuda"></p>
          </section>

          <!-- 2 · Paletas -->
          <section class="admin-seccion md:col-span-2">
            <h3>2 · Paleta de colores del sitio</h3>
            <p class="ayuda mb-2">El cambio se aplica al instante a todas las páginas y queda
              guardado para la próxima sesión.</p>
            <div class="paleta-grid" id="admin-paletas">${paletas}</div>
          </section>

          <!-- 3 · Seguridad -->
          <section class="admin-seccion">
            <h3>3 · Clave de administrador</h3>
            <div class="admin-campo">
              <label for="admin-clave-admin">Clave maestra para crear cuentas admin</label>
              <input id="admin-clave-admin" type="text" autocomplete="off"
                     value="${esc(a.claveAdmin || "")}">
              <p class="ayuda">Se pide al elegir el rol Admin en el registro.</p>
            </div>
            <button type="button" id="admin-guardar-clave" class="btn-pixel btn-ambar">Guardar clave</button>
          </section>

          <!-- 4 · Cuentas y roles -->
          <section class="admin-seccion">
            <h3>4 · Cuentas y roles</h3>
            <div id="admin-cuentas"></div>
          </section>

          <!-- 5 · Historial -->
          <section class="admin-seccion md:col-span-2">
            <h3>5 · Historial del dispositivo</h3>
            <div class="admin-campo">
              <label class="flex items-center gap-2 text-[0.55rem]">
                <input type="checkbox" id="admin-permitir-borrar" ${a.permitirBorrarHistorial !== false ? "checked" : ""}>
                Permitir que un participante borre el historial
              </label>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" id="admin-ver-historial" class="btn-pixel btn-azul">Ver historial</button>
              <button type="button" id="admin-limpiar-historial" class="btn-pixel btn-rojo">Limpiar historial</button>
            </div>
          </section>
        </div>

        <p class="text-xs text-slate-400 mt-3">
          Ajustes guardados en este dispositivo (IndexedDB). El rol de la sesión se comprueba
          antes de aplicar cualquier cambio.
        </p>
      `;

      root.hidden = false;
      root.classList.remove("hidden");
      root.setAttribute("aria-hidden", "false");
      this.renderCuentas();
      this.renderResumen();
    },

    /* Lista de cuentas con su rol y botones para cambiarlo. */
    renderCuentas() {
      const cont = el("admin-cuentas");
      if (!cont) return;
      const lista = Auth.cuentas();
      if (!lista.length) {
        cont.innerHTML = '<p class="text-sm text-slate-400">Sin cuentas en este dispositivo.</p>';
        return;
      }
      const yo = Auth.nombreUsuario();
      cont.innerHTML = lista.map((c) => {
        const esAdmin = c.rol === "admin";
        const yoMismo = c.usuario === yo;
        return `<div class="admin-cuenta" data-usuario="${esc(c.usuario)}">
          <span class="nombre-cuenta">${esc(c.nombre)}</span>
          <span class="usuario-cuenta">@${esc(c.usuario)}</span>
          ${Auth.insigniaHTML(c.rol)}
          <span class="acciones-cuenta">
            ${esAdmin
              ? '<button type="button" class="btn-pixel btn-gris" data-rol="participante"' +
                (yoMismo ? " disabled title='No puedes quitarte el rol a ti mismo'" : "") + ">Quitar admin</button>"
              : '<button type="button" class="btn-pixel btn-ambar" data-rol="admin">Dar admin</button>'}
          </span>
        </div>`;
      }).join("");

      cont.querySelectorAll("[data-rol]").forEach((btn) => {
        btn.onclick = async function () {
          const fila = btn.closest("[data-usuario]");
          const usuario = fila ? fila.getAttribute("data-usuario") : null;
          const res = await Auth.setRol(usuario, btn.getAttribute("data-rol"));
          if (!res.ok) { App.toast(res.error, "error"); return; }
          App.toast("Rol de " + usuario + ": " + Auth.etiquetaRol(res.rol), "ok");
          AdminUI.renderCuentas();
        };
      });
    },

    /* Resumen de los límites con el estado actual del sistema. */
    renderResumen() {
      const dest = el("admin-resumen-limites");
      if (!dest) return;
      const lim = App.limites();
      const tarjetas = App.contarTarjetas();
      dest.innerHTML = lim.maxTarjetas
        ? `Estado: <strong>${tarjetas}</strong> de <strong>${lim.maxTarjetas}</strong> tarjetas en uso.`
        : `Estado: <strong>${tarjetas}</strong> tarjetas · sin límite configurado.`;
    },

    /* ------------------------------------------------------------------ */
    /* Eventos                                                            */
    /* ------------------------------------------------------------------ */
    bind() {
      const root = el("panel-admin");
      if (!root || !this.tienePermiso()) return;
      const q = function (sel) { return root.querySelector(sel); };

      /* --- paletas --- */
      root.querySelectorAll("#admin-paletas .paleta-opcion").forEach((btn) => {
        btn.onclick = async function () {
          const id = btn.getAttribute("data-tema");
          const tema = App.temaPorId(id);
          if (!tema) return;
          await App.guardarAjuste("tema", id);
          App.aplicarTema(id);
          root.querySelectorAll(".paleta-opcion").forEach((o) => {
            o.setAttribute("aria-pressed", o === btn ? "true" : "false");
          });
          App.toast("Paleta aplicada: " + tema.nombre, "ok");
        };
      });

      /* --- límites --- */
      q("#admin-max-generar").onchange = async function () {
        const v = Math.max(0, parseInt(this.value, 10) || 0);
        this.value = v;
        await App.guardarAjuste("maxGenerar", v);
        AdminUI.renderResumen();
        App.toast("Límite de generación: " + (v || "sin límite"), "ok");
      };

      q("#admin-max-tarjetas").onchange = async function () {
        const v = Math.max(0, parseInt(this.value, 10) || 0);
        this.value = v;
        await App.guardarAjuste("maxTarjetas", v);
        AdminUI.renderResumen();
        App.toast("Límite de tarjetas: " + (v || "sin límite"), "ok");
      };

      /* --- clave maestra --- */
      q("#admin-guardar-clave").onclick = async function () {
        const campo = q("#admin-clave-admin");
        const valor = (campo.value || "").trim();
        if (valor.length < 4) { App.toast("La clave necesita al menos 4 caracteres", "error"); return; }
        await Auth.guardarClaveAdmin(valor);
        campo.value = valor;
        App.toast("Clave de administrador actualizada", "ok");
      };

      /* --- historial --- */
      q("#admin-permitir-borrar").onchange = async function () {
        await App.guardarAjuste("permitirBorrarHistorial", this.checked);
        App.toast(this.checked ? "Participantes pueden borrar el historial" : "Solo admin puede borrarlo", "ok");
      };

      q("#admin-ver-historial").onclick = () => this.verHistorial();

      q("#admin-limpiar-historial").onclick = async function () {
        /* Doble comprobación de rol: aunque el panel se mostrara por error,
           la operación sigue exigiendo una sesión de administrador. */
        if (!AdminUI.tienePermiso()) return App.toast("Solo un administrador puede hacer esto", "error");
        if (!confirm("¿Limpiar todo el historial de este dispositivo?")) return;
        await Storage.historialLimpiar();
        App.toast("Historial limpiado", "ok");
      };
    },

    /* Tabla de historial reutilizando el modal de la página (#modal-historial). */
    async verHistorial() {
      const destino = el("modal-historial-contenido");
      if (!destino) return App.toast("Esta página no tiene visor de historial", "error");
      const lista = await Storage.historialListar(100);
      let html = '<table class="tabla-verdad w-full"><thead><tr><th>Fecha</th><th>Tipo</th>' +
        "<th>Fórmula</th><th>Lectura</th></tr></thead><tbody>";
      if (!lista.length) {
        html += '<tr><td colspan="4">Sin historial todavía.</td></tr>';
      }
      lista.forEach((h) => {
        html += "<tr><td>" + esc(new Date(h.fecha).toLocaleString()) + "</td><td>" + esc(h.tipo) +
          '</td><td class="texto-fbf">' + esc(h.formula) + "</td><td>" + esc(h.lectura) + "</td></tr>";
      });
      html += "</tbody></table>";
      destino.innerHTML = html;
      App.abrirModal("modal-historial");
    },

    /* Refresco cuando cambia la sesión o el rol (login/logout en otra pestaña). */
    refrescar() {
      if (!this.tienePermiso()) return this.ocultar();
      this.init();
    }
  };

  global.AdminUI = AdminUI;

  document.addEventListener("DOMContentLoaded", function () { AdminUI.init(); });
  document.addEventListener("auth:cambio", function () { AdminUI.refrescar(); });
})(window);