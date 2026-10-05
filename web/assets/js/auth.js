/* ============================================================================
 * auth.js · Autenticación local + ROLES del sistema
 * ----------------------------------------------------------------------------
 * Arquitectura (sin servidor, todo en el navegador):
 *
 *   localStorage
 *     ├─ lp_usuarios  → cuentas: [{ usuario, clave, nombre, rol }]
 *     ├─ lp_rol       → roles:   { "<usuario>": "admin" | "participante" }
 *     ├─ lp_sesion    → sesión actual: { usuario, nombre, rol }
 *     └─ lp_clave_admin → clave maestra para registrar cuentas admin
 *
 *   IndexedDB (storage.js → store "ajustes")
 *     └─ claveAdmin → clave maestra (fallback: lp_clave_admin)
 *
 * ROLES
 *   · participante → acceso completo a los módulos, sin panel de administración.
 *   · admin         → acceso completo + panel exclusivo de configuración global.
 *
 * API pública (todas las funciones asíncronas devuelven Promise para poder
 * leer ajustes de IndexedDB sin bloquear la interfaz):
 *   Auth.init()                 carga la sesión y refresca la interfaz.
 *   Auth.sesionValida()         ¿hay sesión activa?
 *   Auth.entrar(usuario, clave) → Promise<{ok, usuario?, rol?, error?, campo?}>
 *   Auth.registrar(datos)       → Promise<{ok, usuario?, rol?, error?, campo?}>
 *   Auth.salir()                cierra sesión y vuelve al acceso.
 *   Auth.esAdmin() / esParticipante()
 *   Auth.setRol(usuario, rol)   managing de roles (solo admin).
 *   Auth.cuentas()              listado de cuentas del dispositivo.
 *   Auth.claveAdmin()           clave maestra vigente.
 *   Auth.actualizarUI()         nombre + insignia de rol en la barra de navegación.
 *   Auth.protegerPagina()       redirección + gating del panel admin.
 *   Auth.mostrarPanelAdmin()    muestra/oculta #panel-admin según el rol.
 *
 * Extensibilidad: para añadir un rol nuevo basta con registrarlo en ROLES y
 * en Auth.etiquetaRol(); el resto de la lógica (insignias, gating) ya es
 * genérica y consulta siempre el rol de la sesión.
 * ========================================================================== */
"use strict";

(function (global) {
  /* ------------------------------------------------------------------ */
  /* Claves de almacenamiento                                            */
  /* ------------------------------------------------------------------ */
  const K_CUENTAS = "lp_usuarios";
  const K_ROLES = "lp_rol";
  const K_SESION = "lp_sesion";
  const K_CLAVE_ADMIN = "lp_clave_admin";

  /* ------------------------------------------------------------------ */
  /* Roles                                                               */
  /* ------------------------------------------------------------------ */
  const ROL_ADMIN = "admin";
  const ROL_PARTICIPANTE = "participante";

  const ROLES = {
    admin: { etiqueta: "Admin", clase: "rol-admin", descripcion: "Acceso total + panel de configuración" },
    participante: { etiqueta: "Participante", clase: "rol-participante", descripcion: "Acceso a los tres módulos" }
  };

  /* Cuenta preconfigurada: siempre disponible para entrar como administrador. */
  const CUENTA_DEMO = { usuario: "admin", clave: "1234", nombre: "Administrador", rol: ROL_ADMIN };

  const CLAVE_ADMIN_POR_DEFECTO = "1234";

  /* ------------------------------------------------------------------ */
  /* Utilidades de almacenamiento (tolerantes a fallos / JSON inválido)  */
  /* ------------------------------------------------------------------ */
  function leerJson(clave, defecto) {
    try {
      const crudo = localStorage.getItem(clave);
      return crudo === null ? defecto : JSON.parse(crudo);
    } catch (e) {
      return defecto;
    }
  }

  function escribirJson(clave, valor) {
    try {
      if (valor === null || valor === undefined) localStorage.removeItem(clave);
      else localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (e) {
      return false;
    }
  }

  function escapar(texto) {
    return String(texto === undefined || texto === null ? "" : texto)
      .replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
  }

  function normalizarRol(rol) {
    return rol === ROL_ADMIN ? ROL_ADMIN : ROL_PARTICIPANTE;
  }

  /* ------------------------------------------------------------------ */
  /* Cuentas                                                             */
  /* ------------------------------------------------------------------ */

  /* Lee las cuentas migrando el formato antiguo {nombre, pass} → {usuario, clave}. */
  function leerCuentas() {
    const crudas = leerJson(K_CUENTAS, []);
    if (!Array.isArray(crudas)) return [];
    return crudas
      .map(function (c) {
        if (!c) return null;
        const usuario = c.usuario || c.nombre;
        if (!usuario) return null;
        return {
          usuario: String(usuario),
          clave: String(c.clave !== undefined ? c.clave : (c.pass || "")),
          nombre: c.nombre || String(usuario),
          rol: normalizarRol(c.rol)
        };
      })
      .filter(Boolean);
  }

  function guardarCuentas(lista) {
    return escribirJson(K_CUENTAS, lista);
  }

  function leerRoles() {
    const roles = leerJson(K_ROLES, {});
    return (roles && typeof roles === "object") ? roles : {};
  }

  function guardarRoles(roles) {
    return escribirJson(K_ROLES, roles);
  }

  /* Guarda el rol en la cuenta y en el mapa de roles (fuente de verdad por usuario). */
  function fijarRol(usuario, rol) {
    const limpio = normalizarRol(rol);
    const lista = leerCuentas();
    let cambiado = false;
    lista.forEach(function (c) {
      if (c.usuario === usuario) { c.rol = limpio; cambiado = true; }
    });
    if (cambiado) guardarCuentas(lista);
    const roles = leerRoles();
    roles[usuario] = limpio;
    guardarRoles(roles);
    return limpio;
  }

  /* Garantiza la cuenta demo admin/1234 y reparta el rol de cuentas antiguas
     que no tengan rol asignado (la primera cuenta creada será admin). */
  function sembrarDemo() {
    const lista = leerCuentas();
    let cambios = false;

    if (!lista.some(function (c) { return c.usuario === CUENTA_DEMO.usuario; })) {
      lista.push({
        usuario: CUENTA_DEMO.usuario,
        clave: CUENTA_DEMO.clave,
        nombre: CUENTA_DEMO.nombre,
        rol: ROL_ADMIN
      });
      cambios = true;
    }

    const hayAdmin = lista.some(function (c) { return c.rol === ROL_ADMIN; });
    if (!hayAdmin) {
      /* Nadie es admin todavía (solo puede pasar con cuentas migradas sin rol):
         la cuenta más antigua hereda el panel de configuración. */
      lista[0].rol = ROL_ADMIN;
      cambios = true;
    }

    lista.forEach(function (c) {
      if (!c.rol) { c.rol = ROL_PARTICIPANTE; cambios = true; }
    });

    if (cambios) {
      guardarCuentas(lista);
      const roles = {};
      lista.forEach(function (c) { roles[c.usuario] = c.rol; });
      guardarRoles(roles);
    }
    return lista;
  }

  /* ------------------------------------------------------------------ */
  /* Clave maestra de administración                                     */
  /* ------------------------------------------------------------------ */
  function claveAdminLocal() {
    try {
      return localStorage.getItem(K_CLAVE_ADMIN) || CLAVE_ADMIN_POR_DEFECTO;
    } catch (e) {
      return CLAVE_ADMIN_POR_DEFECTO;
    }
  }

  /* Lee la clave maestra: primero el ajuste persistido por el administrador,
     y si no existe todavía la de localStorage. */
  function leerClaveAdmin() {
    if (!global.Storage || typeof Storage.ajustesGet !== "function") {
      return Promise.resolve(claveAdminLocal());
    }
    return Storage.ajustesGet("claveAdmin", null)
      .then(function (valor) { return valor || claveAdminLocal(); })
      .catch(function () { return claveAdminLocal(); });
  }

  function guardarClaveAdmin(clave) {
    const limpio = String(clave || "").trim() || CLAVE_ADMIN_POR_DEFECTO;
    localStorage.setItem(K_CLAVE_ADMIN, limpio);
    if (global.Storage && typeof Storage.ajustesSet === "function") {
      return Promise.resolve(Storage.ajustesSet("claveAdmin", limpio)).catch(function () { return false; });
    }
    return Promise.resolve(true);
  }

  /* ------------------------------------------------------------------ */
  /* Objeto Auth                                                         */
  /* ------------------------------------------------------------------ */
  const Auth = {
    usuario: null,
    ROLES: ROLES,
    ROL_ADMIN: ROL_ADMIN,
    ROL_PARTICIPANTE: ROL_PARTICIPANTE,
    CUENTA_DEMO: CUENTA_DEMO,

    /* ---------------- ciclo de vida ---------------- */

    /* El campo interno se llama _cuentas para no tapar el método Auth.cuentas(),
       que usan el panel de administración y la página de acceso. */
    init: function () {
      this._cuentas = sembrarDemo();
      const sesion = leerJson(K_SESION, null);
      if (sesion && sesion.usuario) {
        const cuenta = this._cuentas.find(function (c) { return c.usuario === sesion.usuario; });
        /* El rol se resuelve siempre desde la cuenta vigente: si el administrador
           cambió un rol, el cambio se refleja en la sesión actual. */
        this.usuario = cuenta
          ? { usuario: cuenta.usuario, nombre: cuenta.nombre, rol: normalizarRol(cuenta.rol) }
          : { usuario: sesion.usuario, nombre: sesion.nombre || sesion.usuario, rol: normalizarRol(sesion.rol) };
      } else {
        this.usuario = null;
      }
      this.actualizarUI();
      return this.usuario;
    },

    sesionValida: function () {
      if (!this.usuario) this.init();
      return !!(this.usuario && this.usuario.usuario);
    },

    /* ---------------- entrada / registro ---------------- */

    entrar: function (usuario, clave) {
      const nombreUsuario = String(usuario || "").trim();
      const claveUsuario = String(clave || "");
      if (!nombreUsuario || !claveUsuario) {
        return Promise.resolve({
          ok: false,
          error: "Rellena usuario y contraseña.",
          campo: nombreUsuario ? "clave" : "usuario"
        });
      }
      return Promise.resolve().then(function () {
        this._cuentas = sembrarDemo();
        const cuenta = this._cuentas.find(function (c) { return c.usuario === nombreUsuario; });
        if (!cuenta || cuenta.clave !== claveUsuario) {
          return { ok: false, error: "Usuario o contraseña incorrectos.", campo: "clave", limpiar: true };
        }
        fijarRol(cuenta.usuario, cuenta.rol);
        this.usuario = { usuario: cuenta.usuario, nombre: cuenta.nombre, rol: normalizarRol(cuenta.rol) };
        escribirJson(K_SESION, this.usuario);
        this.actualizarUI();
        return { ok: true, usuario: cuenta.nombre, rol: this.usuario.rol };
      }.bind(this));
    },

    /* datos: { nombre, usuario, clave, repetir, rol, claveAdmin } */
    registrar: function (datos) {
      const d = datos || {};
      const nombreUsuario = String(d.usuario || "").trim();
      const clave = String(d.clave || "");
      const repetir = String(d.repetir === undefined ? "" : d.repetir);
      const nombre = String(d.nombre || "").trim() || nombreUsuario;
      const rolPedido = normalizarRol(d.rol);

      if (nombreUsuario.length < 3) {
        return Promise.resolve({ ok: false, error: "El usuario necesita al menos 3 caracteres.", campo: "usuario" });
      }
      if (clave.length < 4) {
        return Promise.resolve({ ok: false, error: "La clave necesita al menos 4 caracteres.", campo: "clave" });
      }
      if (clave !== repetir) {
        return Promise.resolve({ ok: false, error: "Las claves no coinciden.", campo: "repetir", limpiar: true });
      }

      return leerClaveAdmin().then(function (claveAdmin) {
        /* Elegir "admin" en el registro exige la clave maestra: sin ella,
           cualquier visitante podría tomar el control del sistema. */
        if (rolPedido === ROL_ADMIN && String(d.claveAdmin || "") !== claveAdmin) {
          return { ok: false, error: "Clave de administrador incorrecta.", campo: "clave-admin", limpiar: true };
        }
        this._cuentas = sembrarDemo();
        if (this._cuentas.some(function (c) { return c.usuario === nombreUsuario; })) {
          return { ok: false, error: "Ese usuario ya existe en este dispositivo.", campo: "usuario" };
        }
        const cuenta = { usuario: nombreUsuario, clave: clave, nombre: nombre, rol: rolPedido };
        this._cuentas = this._cuentas.concat([cuenta]);
        guardarCuentas(this._cuentas);
        fijarRol(nombreUsuario, rolPedido);
        this.usuario = { usuario: cuenta.usuario, nombre: cuenta.nombre, rol: cuenta.rol };
        escribirJson(K_SESION, this.usuario);
        this.actualizarUI();
        return { ok: true, usuario: cuenta.nombre, rol: cuenta.rol };
      }.bind(this));
    },

    salir: function () {
      escribirJson(K_SESION, null);
      this.usuario = null;
      this.actualizarUI();
      if (!/login\.html$/.test(window.location.pathname)) {
        window.location.href = "login.html";
      }
    },

    /* Alias heredado: mantiene compatibilidad con el código anterior. */
    cerrarSesion: function () { this.salir(); },

    /* ---------------- roles ---------------- */

    esAdmin: function () {
      return !!(this.usuario && this.usuario.rol === ROL_ADMIN);
    },

    esParticipante: function () {
      return !!this.usuario && this.usuario.rol === ROL_PARTICIPANTE;
    },

    getUsuario: function () { return this.usuario; },
    nombreUsuario: function () { return this.usuario ? this.usuario.usuario : null; },
    nombreMostrado: function () { return this.usuario ? this.usuario.nombre : null; },
    etiquetaRol: function (rol) {
      const r = ROLES[normalizarRol(rol || (this.usuario && this.usuario.rol))];
      return r ? r.etiqueta : ROLES[ROL_PARTICIPANTE].etiqueta;
    },

    /* Gestiona el rol de una cuenta. Solo el administrador puede hacerlo. */
    setRol: function (usuario, rol) {
      if (!this.esAdmin()) return Promise.resolve({ ok: false, error: "Solo un administrador puede cambiar roles." });
      const lista = leerCuentas();
      if (!lista.some(function (c) { return c.usuario === usuario; })) {
        return Promise.resolve({ ok: false, error: "Ese usuario no existe." });
      }
      if (usuario === this.usuario.usuario && normalizarRol(rol) !== ROL_ADMIN) {
        return Promise.resolve({ ok: false, error: "No puedes quitarte a ti mismo el rol de administrador." });
      }
      fijarRol(usuario, rol);
      if (this.usuario && this.usuario.usuario === usuario) {
        this.usuario.rol = normalizarRol(rol);
        escribirJson(K_SESION, this.usuario);
      }
      this.actualizarUI();
      this.emitirCambio();
      return Promise.resolve({ ok: true, rol: normalizarRol(rol) });
    },

    cuentas: function () { return leerCuentas(); },
    claveAdmin: function () { return leerClaveAdmin(); },
    guardarClaveAdmin: function (clave) { return guardarClaveAdmin(clave); },

    /* Alias heredado usado por el código anterior. */
    forzarRolAdmin: function (nombre) {
      if (!nombre) return Promise.resolve({ ok: false });
      fijarRol(nombre, ROL_ADMIN);
      if (this.usuario && this.usuario.usuario === nombre) {
        this.usuario.rol = ROL_ADMIN;
        escribirJson(K_SESION, this.usuario);
        this.actualizarUI();
        this.mostrarPanelAdmin();
      }
      return Promise.resolve({ ok: true });
    },

    /* ---------------- interfaz ---------------- */

    /* Insignia de rol reutilizable (navegación, panel admin, perfil). */
    insigniaHTML: function (rol) {
      const r = ROLES[normalizarRol(rol || (this.usuario && this.usuario.rol))];
      if (!r) return "";
      return '<span class="insignia-rol ' + r.clase + '" title="' + escapar(r.descripcion) + '">' +
        escapar(r.etiqueta) + "</span>";
    },

    actualizarUI: function () {
      const conSesion = !!this.usuario;

      /* Nombre + insignia de rol en la barra de navegación. */
      document.querySelectorAll("[data-slot='usuario']").forEach(function (el) {
        if (!conSesion) {
          el.textContent = "invitado";
          el.classList.remove("con-rol");
          return;
        }
        el.innerHTML = '<span class="nav-usuario-nombre">' + escapar(this.usuario.nombre) + "</span>" +
          this.insigniaHTML(this.usuario.rol);
        el.classList.add("con-rol");
        el.title = "Sesión: " + this.usuario.usuario + " · " + this.etiquetaRol(this.usuario.rol);
      }.bind(this));

      /* Saludo de la portada. */
      document.querySelectorAll("[data-slot='nombre']").forEach(function (el) {
        el.textContent = conSesion ? this.usuario.nombre : "amante de la lógica";
      }.bind(this));

      /* Botón salir. */
      document.querySelectorAll("[data-slot='salir']").forEach(function (el) {
        el.hidden = !conSesion;
        el.onclick = function () { Auth.salir(); };
      });

      /* Enlace de entrada: la portada es pública, así que sin sesión hace
         falta una vía visible para entrar (con sesión se oculta). */
      document.querySelectorAll("[data-slot='entrar']").forEach(function (el) {
        el.hidden = conSesion;
      });

      /* Enlaces y contenedores exclusivos del administrador. */
      document.querySelectorAll("[data-slot='admin']").forEach(function (el) {
        el.hidden = !this.esAdmin();
      }.bind(this));

      if (document.body) {
        document.body.setAttribute("data-rol", conSesion ? this.usuario.rol : "invitado");
      }
      this.mostrarPanelAdmin();
    },

    /* El panel de administración solo se renderiza / muestra para rol admin. */
    mostrarPanelAdmin: function () {
      const panel = document.getElementById("panel-admin");
      const esAdmin = this.esAdmin();
      if (panel) {
        panel.hidden = !esAdmin;
        panel.classList.toggle("hidden", !esAdmin);
        panel.setAttribute("aria-hidden", esAdmin ? "false" : "true");
      }
      return esAdmin;
    },

    emitirCambio: function () {
      try {
        document.dispatchEvent(new CustomEvent("auth:cambio", {
          detail: { usuario: this.usuario, esAdmin: this.esAdmin() }
        }));
      } catch (e) { /* navegadores sin CustomEvent: se ignora */ }
    },

    /* ---------------- protección de páginas ---------------- */

    protegerPagina: function () {
      this.init();
      /* Si se invoca desde <head>, document.body todavía no existe: se difiere
         la comprobación hasta que el DOM esté listo (evita fugas de contenido). */
      if (!document.body) {
        if (!this._proteccionDiferida) {
          this._proteccionDiferida = true;
          document.addEventListener("DOMContentLoaded", function () {
            Auth._proteccionDiferida = false;
            Auth.protegerPagina();
          });
        }
        return false;
      }
      const paginasProtegidas = ["directo", "inverso", "ml", "admin"];
      const pag = document.body.getAttribute("data-pagina");
      if (!this.sesionValida() && paginasProtegidas.indexOf(pag) !== -1) {
        window.location.href = "login.html?volver=" + encodeURIComponent(pag + ".html");
        return;
      }
      this.mostrarPanelAdmin();
      /* Avisa a los módulos dependientes (panel admin, workbench…) del rol actual. */
      if (document.readyState !== "loading") this.emitirCambio();
    }
  };

  global.Auth = Auth;

  /* Arranque automático: si el DOM aún no existe, esperar a que exista. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { Auth.init(); });
  } else {
    Auth.init();
  }
})(window);