/* ============================================================================
 * portal.js · Controlador de las páginas de acceso y registro
 * ----------------------------------------------------------------------------
 * Se apoya por completo en la API de auth.js:
 *   Auth.sesionValida(), Auth.entrar(u, c), Auth.registrar(datos).
 * Su trabajo aquí es puramente de interfaz: validar la Experiencia de
 * registro (mostrar/ocultar la clave de administrator según el rol elegido),
 * validar formularios, mostrar avisos y redirigir.
 * ========================================================================== */
(function () {
  "use strict";

  var aviso = document.getElementById("portal-aviso");

  function mostrar(texto, tipo) {
    if (!aviso) return;
    aviso.textContent = texto;
    aviso.className = "portal-aviso " + (tipo || "mal");
  }

  function limpiar() {
    if (aviso) {
      aviso.textContent = "";
      aviso.className = "portal-aviso";
    }
  }

  /* Destino tras entrar: la página que el usuario intentaba abrir o la portada. */
  function destino() {
    var volver = new URLSearchParams(window.location.search).get("volver") || "";
    if (/^[\w.-]+\.html$/.test(volver) && volver !== "login.html" && volver !== "registro.html") {
      return volver;
    }
    return "index.html";
  }

  function valor(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  function rolElegido() {
    var marcado = document.querySelector("input[name='rol']:checked");
    return marcado ? marcado.value : "participante";
  }

  function mirarError(res) {
    var campo = res && res.campo ? document.getElementById(res.campo) : null;
    if (!campo) return;
    if (res.limpiar) campo.value = "";
    campo.focus();
    if (typeof campo.select === "function") campo.select();
  }

  function bloquear(boton, texto) {
    if (!boton) return;
    boton.dataset.texto = boton.textContent;
    boton.textContent = texto;
    boton.disabled = true;
  }

  function desbloquear(boton) {
    if (!boton) return;
    boton.textContent = boton.dataset.texto || boton.textContent;
    boton.disabled = false;
  }

  /* ------------------------------------------------------------------ */
  /* Registro: la clave de administrador solo aparece si se elige Admin */
  /* ------------------------------------------------------------------ */
  function prepararSelectorRol() {
    var radios = document.querySelectorAll("input[name='rol']");
    var campo = document.getElementById("campo-clave-admin");
    if (!radios.length || !campo) return;

    function sincronizar() {
      var esAdmin = rolElegido() === "admin";
      campo.classList.toggle("hidden", !esAdmin);
      var input = document.getElementById("clave-admin");
      if (input) {
        input.disabled = !esAdmin;
        if (!esAdmin) input.value = "";
      }
    }
    radios.forEach(function (r) { r.addEventListener("change", sincronizar); });
    sincronizar();
  }

  /* ------------------------------------------------------------------ */
  /* Acceso                                                              */
  /* ------------------------------------------------------------------ */
  var formLogin = document.getElementById("form-login");
  if (formLogin) {
    /* Si ya hay sesión abierta no tiene sentido quedarse aquí. */
    if (Auth.sesionValida()) {
      window.location.replace(destino());
      return;
    }
    formLogin.addEventListener("submit", function (evento) {
      evento.preventDefault();
      limpiar();
      var boton = formLogin.querySelector("button[type=submit]");
      bloquear(boton, "Entrando...");
      Auth.entrar(valor("usuario"), valor("clave")).then(function (res) {
        if (res.ok) {
          mostrar("¡Bienvenido, " + res.usuario + "! Rol: " + Auth.etiquetaRol(res.rol) + ". Abriendo…", "bien");
          window.location.replace(destino());
          return;
        }
        desbloquear(boton);
        mostrar(res.error, "mal");
        mirarError(res);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Registro                                                            */
  /* ------------------------------------------------------------------ */
  var formRegistro = document.getElementById("form-registro");
  if (formRegistro) {
    prepararSelectorRol();
    formRegistro.addEventListener("submit", function (evento) {
      evento.preventDefault();
      limpiar();
      var boton = formRegistro.querySelector("button[type=submit]");
      bloquear(boton, "Creando cuenta...");
      Auth.registrar({
        nombre: valor("nombre"),
        usuario: valor("usuario"),
        clave: valor("clave"),
        repetir: valor("repetir"),
        rol: rolElegido(),
        claveAdmin: valor("clave-admin")
      }).then(function (res) {
        if (res.ok) {
          mostrar("¡Cuenta creada! Bienvenido, " + res.usuario + " (" + Auth.etiquetaRol(res.rol) + ").", "bien");
          window.setTimeout(function () {
            window.location.replace(destino());
          }, 700);
          return;
        }
        desbloquear(boton);
        mostrar(res.error, "mal");
        mirarError(res);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Atajos de acceso rápido                                            */
  /* ------------------------------------------------------------------ */
  function rellenar(usuario, clave) {
    document.getElementById("usuario").value = usuario;
    document.getElementById("clave").value = clave;
    limpiar();
    document.getElementById("clave").focus();
  }

  var demo = document.getElementById("usar-demo");
  if (demo) {
    demo.addEventListener("click", function () {
      rellenar(Auth.CUENTA_DEMO.usuario, Auth.CUENTA_DEMO.clave);
    });
  }

  /* Atajo para probar la experiencia de participante sin crear cuenta:
     si no existe la cuenta "participante", la registra con clave 1234. */
  var demoParticipante = document.getElementById("usar-demo-participante");
  if (demoParticipante) {
    demoParticipante.addEventListener("click", function () {
      var usuario = "participante";
      var existe = Auth.cuentas().some(function (c) { return c.usuario === usuario; });
      if (existe) { rellenar(usuario, "1234"); return; }
      demoParticipante.disabled = true;
      Auth.registrar({
        nombre: "Participante de prueba",
        usuario: usuario,
        clave: "1234",
        repetir: "1234",
        rol: "participante"
      }).then(function (res) {
        demoParticipante.disabled = false;
        if (res.ok) {
          window.location.replace(destino());
          return;
        }
        rellenar(usuario, "1234");
      });
    });
  }
})();