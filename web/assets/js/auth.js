
(function () {
  "use strict";

  var CLAVE_USUARIOS = "logica.usuarios";
  var CLAVE_SESION = "logica.sesion";
  var CUENTA_POR_DEFECTO = { usuario: "admin", clave: "1234", nombre: "Administrador" };
  var RUTA_LOGIN = "login.html";

  function leerJSON(clave, porDefecto) {
    try {
      var crudo = window.localStorage.getItem(clave);
      return crudo ? JSON.parse(crudo) : porDefecto;
    } catch (e) {
      return porDefecto;
    }
  }

  function escribirJSON(clave, valor) {
    try {
      window.localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (e) {
      return false;
    }
  }

  function hashSimple(texto) {
    var h = 5381;
    for (var i = 0; i < texto.length; i += 1) {
      h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
    }
    return h.toString(16);
  }

  function tieneCrypto() {
    return !!(window.crypto && window.crypto.subtle && window.TextEncoder);
  }

  function bytesAHex(buffer) {
    return Array.prototype.map
      .call(new Uint8Array(buffer), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      })
      .join("");
  }

  function hashClave(clave) {
    var sal = "logica-proposicional::";
    if (tieneCrypto()) {
      return window.crypto.subtle
        .digest("SHA-256", new window.TextEncoder().encode(sal + clave))
        .then(bytesAHex)
        .catch(function () {
          return "f" + hashSimple(sal + clave);
        });
    }
    return Promise.resolve("f" + hashSimple(sal + clave));
  }

  function normalizar(texto) {
    return String(texto || "").trim().toLowerCase();
  }

  function listaUsuarios() {
    var lista = leerJSON(CLAVE_USUARIOS, null);
    if (!Array.isArray(lista)) return [];
    return lista;
  }

  function guardarUsuarios(lista) {
    return escribirJSON(CLAVE_USUARIOS, lista);
  }

  function sembrarCuentaPorDefecto() {
    if (leerJSON(CLAVE_USUARIOS, null)) return Promise.resolve();
    return hashClave(CUENTA_POR_DEFECTO.clave).then(function (hash) {
      guardarUsuarios([
        {
          usuario: CUENTA_POR_DEFECTO.usuario,
          nombre: CUENTA_POR_DEFECTO.nombre,
          hash: hash,
          creado: new Date().toISOString(),
        },
      ]);
    });
  }

  function buscarUsuario(usuario) {
    var clave = normalizar(usuario);
    var lista = listaUsuarios();
    for (var i = 0; i < lista.length; i += 1) {
      if (normalizar(lista[i].usuario) === clave) return lista[i];
    }
    return null;
  }

  function abrirSesion(registro) {
    escribirJSON(CLAVE_SESION, {
      usuario: registro.usuario,
      nombre: registro.nombre || registro.usuario,
      desde: new Date().toISOString(),
    });
  }

  var Auth = {
    rutaLogin: function () {
      return RUTA_LOGIN;
    },

    sembrar: sembrarCuentaPorDefecto,

    sesion: function () {
      var s = leerJSON(CLAVE_SESION, null);
      if (!s || !s.usuario) return null;
      return s;
    },

    usuarioActual: function () {
      var s = Auth.sesion();
      return s ? s.usuario : null;
    },

    sesionValida: function () {
      var s = Auth.sesion();
      return !!(s && buscarUsuario(s.usuario));
    },

    registrar: function (datos) {
      var usuario = String(datos.usuario || "").trim();
      var nombre = String(datos.nombre || "").trim();
      var clave = String(datos.clave || "");
      var repetir = String(datos.repetir || "");

      if (usuario.length < 3) {
        return Promise.resolve({ ok: false, error: "El usuario necesita al menos 3 caracteres.", campo: "usuario" });
      }
      if (!/^[A-Za-z0-9_.-]+$/.test(usuario)) {
        return Promise.resolve({
          ok: false,
          error: "Usa solo letras, numeros, punto, guion o guion bajo.",
          campo: "usuario",
        });
      }
      if (clave.length < 4) {
        return Promise.resolve({ ok: false, error: "La clave necesita al menos 4 caracteres.", campo: "clave" });
      }
      if (clave !== repetir) {
        return Promise.resolve({
          ok: false,
          error: "Las dos claves no coinciden.",
          campo: "repetir",
          limpiar: true,
        });
      }
      if (buscarUsuario(usuario)) {
        return Promise.resolve({
          ok: false,
          error: "Ese usuario ya existe. Prueba con otro.",
          campo: "usuario",
        });
      }

      return hashClave(clave).then(function (hash) {
        var lista = listaUsuarios();
        var registro = {
          usuario: usuario,
          nombre: nombre || usuario,
          hash: hash,
          creado: new Date().toISOString(),
        };
        lista.push(registro);
        if (!guardarUsuarios(lista)) {
          return { ok: false, error: "No se pudo guardar la cuenta en este navegador." };
        }
        abrirSesion(registro);
        return { ok: true, usuario: registro.usuario };
      });
    },

    entrar: function (usuario, clave) {
      if (!String(usuario || "").trim()) {
        return Promise.resolve({ ok: false, error: "Escribe tu usuario.", campo: "usuario" });
      }
      if (!String(clave || "")) {
        return Promise.resolve({ ok: false, error: "Escribe tu clave.", campo: "clave" });
      }
      var registro = buscarUsuario(usuario);
      if (!registro) {
        return Promise.resolve({
          ok: false,
          error: "Usuario no encontrado. Crea una cuenta en REGISTRO.",
          campo: "usuario",
        });
      }
      return hashClave(clave).then(function (hash) {
        if (hash !== registro.hash) {
          return { ok: false, error: "Clave incorrecta. Intentalo de nuevo.", campo: "clave", limpiar: true };
        }
        abrirSesion(registro);
        return { ok: true, usuario: registro.usuario };
      });
    },

    salir: function () {
      try {
        window.localStorage.removeItem(CLAVE_SESION);
      } catch (e) {
        /* sin almacenamiento: la sesion ya no existe */
      }
    },

    proteger: function () {
      return Auth.sesionValida();
    },

    protegerPagina: function () {
      if (Auth.sesionValida()) return true;
      document.documentElement.style.opacity = "0";
      var volver = window.location.pathname.split("/").pop() || "index.html";
      window.location.replace(RUTA_LOGIN + "?volver=" + encodeURIComponent(volver));
      return false;
    },

    montarNav: function () {
      var hueco = document.querySelector('[data-slot="usuario"]');
      var boton = document.querySelector('[data-slot="salir"]');
      var saludo = document.querySelector('[data-slot="nombre"]');
      var s = Auth.sesion();
      if (hueco) {
        hueco.textContent = s ? "@" + s.nombre : "invitado";
        hueco.title = s ? "Sesion iniciada como " + s.usuario : "Sin sesion";
      }
      if (saludo && s) saludo.textContent = s.nombre;
      if (boton) {
        boton.hidden = !s;
        boton.addEventListener("click", function () {
          Auth.salir();
          window.location.href = RUTA_LOGIN;
        });
      }
    },
  };

  window.Auth = Auth;

  Auth.sembrar();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", Auth.montarNav);
  } else {
    Auth.montarNav();
  }
})();
