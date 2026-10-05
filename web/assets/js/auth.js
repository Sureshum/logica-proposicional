"use strict";

(function (global) {
  const STORAGE_KEY = "lp_usuario";
  const STORAGE_ROLES = "lp_roles";

  function cargarUsuario() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function cargarRoles() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_ROLES) || "{}");
    } catch (e) {
      return {};
    }
  }

  function guardarUsuario(u) {
    if (!u) { localStorage.removeItem(STORAGE_KEY); return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  }

  function guardarRoles(r) {
    localStorage.setItem(STORAGE_ROLES, JSON.stringify(r));
  }

  const Auth = {
    usuario: null,

    init: function () {
      this.usuario = cargarUsuario();
      const roles = cargarRoles();
      if (this.usuario) {
        if (roles[this.usuario.nombre]) this.usuario.rol = roles[this.usuario.nombre];
        else {
          const todos = Object.keys(roles);
          if (todos.length === 0) this.usuario.rol = "admin";
          else this.usuario.rol = roles[this.usuario.nombre] || "participante";
        }
      }
      this.actualizarUI();
    },

    actualizarUI: function () {
      const slots = document.querySelectorAll("[data-slot='usuario']");
      const salir = document.querySelectorAll("[data-slot='salir']");
      if (slots.length) {
        slots.forEach(function (el) {
          el.textContent = this.usuario ? (this.usuario.nombre + " (" + (this.usuario.rol||"participante") + ")") : "invitado";
        }.bind(this));
      }
      if (salir.length) {
        salir.forEach(function (el) {
          el.hidden = !this.usuario;
          el.onclick = function () { Auth.cerrarSesion(); };
        }.bind(this));
      }
    },

    protegerPagina: function () {
      this.init();
      const paginasProtegidas = ["directo", "inverso", "ml"];
      const pag = document.body ? document.body.getAttribute("data-pagina") : null;
      if (!this.usuario && paginasProtegidas.indexOf(pag) !== -1) {
        window.location.href = "login.html";
      }
      this.mostrarPanelAdmin();
    },

    login: function (nombre, pass) {
      if (!nombre || !pass) return { ok: false, msg: "Rellena usuario y contraseña" };
      const lista = JSON.parse(localStorage.getItem("lp_usuarios") || "[]");
      const u = lista.find(function (x) { return x.nombre === nombre && x.pass === pass; });
      if (!u) return { ok: false, msg: "Usuario o contraseña incorrectos" };
      this.usuario = { nombre: u.nombre };
      const roles = cargarRoles();
      if (roles[u.nombre]) this.usuario.rol = roles[u.nombre];
      else {
        const todosRoles = Object.keys(roles);
        const todosUsuarios = lista.map(function(x){return x.nombre;});
        const tieneAdmin = todosRoles.some(function(k){return roles[k]==="admin";});
        if (!tieneAdmin && todosUsuarios.length >=1) {
          this.usuario.rol = "admin";
        } else this.usuario.rol = "participante";
      }
      guardarUsuario(this.usuario);
      roles[this.usuario.nombre] = this.usuario.rol;
      guardarRoles(roles);
      return { ok: true };
    },

    registrar: function (nombre, pass) {
      if (!nombre || !pass) return { ok: false, msg: "Rellena usuario y contraseña" };
      const lista = JSON.parse(localStorage.getItem("lp_usuarios") || "[]");
      if (lista.find(function (x) { return x.nombre === nombre; })) return { ok: false, msg: "Ya existe ese usuario" };
      lista.push({ nombre: nombre, pass: pass });
      localStorage.setItem("lp_usuarios", JSON.stringify(lista));
      const roles = cargarRoles();
      const tieneAdmin = Object.keys(roles).some(function(k){return roles[k]==="admin";});
      let rolAsignado = "participante";
      if (!tieneAdmin) rolAsignado = "admin";
      roles[nombre] = rolAsignado;
      guardarRoles(roles);
      this.usuario = { nombre: nombre, rol: rolAsignado };
      guardarUsuario(this.usuario);
      return { ok: true, rol: rolAsignado };
    },

    cerrarSesion: function () {
      guardarUsuario(null);
      this.usuario = null;
      window.location.href = "login.html";
    },

    esAdmin: function () {
      return this.usuario && this.usuario.rol === "admin";
    },

    forzarRolAdmin: function (nombre) {
      const roles = cargarRoles();
      roles[nombre] = "admin";
      guardarRoles(roles);
      if (this.usuario && this.usuario.nombre === nombre) this.usuario.rol = "admin";
      this.actualizarUI();
      this.mostrarPanelAdmin();
    },

    mostrarPanelAdmin: function () {
      const panel = document.getElementById("panel-admin");
      if (!panel) return;
      if (this.esAdmin()) panel.classList.remove("hidden");
      else panel.classList.add("hidden");
    },

    getUsuario: function () {
      return this.usuario;
    }
  };

  global.Auth = Auth;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ Auth.init(); });
  else Auth.init();
})(window);
