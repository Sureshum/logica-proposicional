
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

  function mirarError(res) {
    var campo = res.campo ? document.getElementById(res.campo) : null;
    if (!campo) return;
    if (res.limpiar) campo.value = "";
    campo.focus();
    campo.select();
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

  var formLogin = document.getElementById("form-login");
  if (formLogin && Auth.sesionValida()) {
    window.location.replace(destino());
    return;
  }
  if (formLogin) {
    formLogin.addEventListener("submit", function (evento) {
      evento.preventDefault();
      limpiar();
      var boton = formLogin.querySelector("button[type=submit]");
      bloquear(boton, "Entrando...");
      Auth.entrar(valor("usuario"), valor("clave")).then(function (res) {
        if (res.ok) {
          mostrar("¡Bienvenido, " + res.usuario + "! Abriendo el panel...", "bien");
          window.location.replace(destino());
          return;
        }
        desbloquear(boton);
        mostrar(res.error, "mal");
        mirarError(res);
      });
    });
  }

  var formRegistro = document.getElementById("form-registro");
  if (formRegistro) {
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
      }).then(function (res) {
        if (res.ok) {
          mostrar("¡Cuenta creada! Bienvenido, " + res.usuario + ".", "bien");
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

  var demo = document.getElementById("usar-demo");
  if (demo) {
    demo.addEventListener("click", function () {
      document.getElementById("usuario").value = "admin";
      document.getElementById("clave").value = "1234";
      limpiar();
      document.getElementById("clave").focus();
    });
  }
})();
