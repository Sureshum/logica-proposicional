"use strict";

function esc(texto) {
  return String(texto).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

(function (global) {
  const App = {
    abrirModal: function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove("hidden");
      el.setAttribute("aria-hidden", "false");
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
        cont.className = "fixed bottom-4 right-4 z-50 flex flex-col gap-2";
        document.body.appendChild(cont);
      }
      const t = document.createElement("div");
      t.className = "px-3 py-2 border-2 border-black shadow-[4px_4px_0_#000] text-sm " +
        (tipo === "error" ? "bg-red-100 text-red-800" : tipo === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800");
      t.textContent = msg;
      cont.appendChild(t);
      setTimeout(function(){ t.remove(); }, 2500);
    },
    aplicarTema: function (tema) {
      const root = document.documentElement;
      const presets = {
        claro: { "--bg": "#f8fafc", "--panel": "#ffffff", "--texto": "#0f172a", "--borde": "#000000", "--acento": "#6366f1" },
        oscuro: { "--bg": "#0f172a", "--panel": "#1e293b", "--texto": "#e2e8f0", "--borde": "#94a3b8", "--acento": "#38bdf8" },
        neon: { "--bg": "#050510", "--panel": "#0b1026", "--texto": "#d1faff", "--borde": "#22d3ee", "--acento": "#f472b6" },
        retro: { "--bg": "#e6e7dc", "--panel": "#f5f3eb", "--texto": "#2b1d0e", "--borde": "#3b2f2f", "--acento": "#7c3aed" },
        contraste: { "--bg": "#ffffff", "--panel": "#ffffff", "--texto": "#000000", "--borde": "#000000", "--acento": "#0051ff" }
      };
      const p = presets[tema] || presets.claro;
      Object.keys(p).forEach(function(k){ root.style.setProperty(k, p[k]); });
      try { Storage.ajustesSet("tema", tema); } catch(e){}
    }
  };
  global.App = App;
})(window);
