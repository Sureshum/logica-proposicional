"use strict";

(function (global) {
  const DB_NAME = "logica-prop-v1";
  const STORE_HIST = "historial";
  const STORE_AJUSTES = "ajustes";

  let db = null;
  let readyPromise = null;

  function abrirDB() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = function (e) {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_HIST)) {
          const s = d.createObjectStore(STORE_HIST, { keyPath: "id", autoIncrement: true });
          s.createIndex("fecha", "fecha", { unique: false });
          s.createIndex("tipo", "tipo", { unique: false });
        }
        if (!d.objectStoreNames.contains(STORE_AJUSTES)) {
          d.createObjectStore(STORE_AJUSTES, { keyPath: "clave" });
        }
      };
      req.onsuccess = function (e) {
        db = e.target.result;
        resolve(db);
      };
      req.onerror = function (e) {
        console.warn("IndexedDB no disponible, usando localStorage:", e);
        db = "ls";
        resolve(db);
      };
    });
    return readyPromise;
  }

  async function txLectura(store) {
    const d = await abrirDB();
    if (d === "ls") return null;
    return d.transaction([store], "readonly").objectStore(store);
  }
  async function txEscritura(store) {
    const d = await abrirDB();
    if (d === "ls") return null;
    return d.transaction([store], "readwrite").objectStore(store);
  }

  function lsKeyHist() { return "lp_historial"; }
  function lsKeyAjustes() { return "lp_ajustes"; }

  const Storage = {
    listo: function () { return abrirDB(); },

    historialAgregar: async function (item) {
      const base = {
        fecha: Date.now(),
        tipo: item.tipo || "manual",
        formula: item.formula || "",
        lectura: item.lectura || "",
        descripciones: item.descripciones || {},
        tema: item.tema || null,
        batchId: item.batchId || null,
        count: item.count || 1
      };
      const d = await abrirDB();
      if (d === "ls") {
        try {
          const arr = JSON.parse(localStorage.getItem(lsKeyHist()) || "[]");
          arr.unshift(base);
          if (arr.length > 500) arr.length = 500;
          localStorage.setItem(lsKeyHist(), JSON.stringify(arr));
          return { id: Date.now() };
        } catch (e) { return { id: null }; }
      }
      const os = await txEscritura(STORE_HIST);
      return new Promise((res) => {
        const r = os.add(base);
        r.onsuccess = () => res({ id: r.result });
        r.onerror = () => res({ id: null });
      });
    },

    historialListar: async function (limite) {
      const lim = limite || 200;
      const d = await abrirDB();
      if (d === "ls") {
        try {
          const arr = JSON.parse(localStorage.getItem(lsKeyHist()) || "[]");
          return arr.slice(0, lim);
        } catch (e) { return []; }
      }
      const os = await txLectura(STORE_HIST);
      return new Promise((res) => {
        const out = [];
        const cur = os.openCursor(null, "prev");
        let cont = 0;
        cur.onsuccess = (e) => {
          const c = e.target.result;
          if (c && cont < lim) { out.push(c.value); cont++; c.continue(); }
          else res(out);
        };
        cur.onerror = () => res(out);
      });
    },

    historialLimpiar: async function () {
      const d = await abrirDB();
      if (d === "ls") { localStorage.removeItem(lsKeyHist()); return true; }
      const os = await txEscritura(STORE_HIST);
      return new Promise((res) => {
        const r = os.clear();
        r.onsuccess = () => res(true);
        r.onerror = () => res(false);
      });
    },

    ajustesGet: async function (clave, defecto) {
      const d = await abrirDB();
      if (d === "ls") {
        try {
          const obj = JSON.parse(localStorage.getItem(lsKeyAjustes()) || "{}");
          return (obj[clave] !== undefined) ? obj[clave] : (defecto !== undefined ? defecto : null);
        } catch (e) { return (defecto !== undefined ? defecto : null); }
      }
      const os = await txLectura(STORE_AJUSTES);
      return new Promise((res) => {
        const r = os.get(clave);
        r.onsuccess = () => {
          const v = r.result ? r.result.valor : undefined;
          res(v !== undefined ? v : (defecto !== undefined ? defecto : null));
        };
        r.onerror = () => res(defecto !== undefined ? defecto : null);
      });
    },

    ajustesSet: async function (clave, valor) {
      const d = await abrirDB();
      if (d === "ls") {
        try {
          const obj = JSON.parse(localStorage.getItem(lsKeyAjustes()) || "{}");
          obj[clave] = valor;
          localStorage.setItem(lsKeyAjustes(), JSON.stringify(obj));
          return true;
        } catch (e) { return false; }
      }
      const os = await txEscritura(STORE_AJUSTES);
      return new Promise((res) => {
        const r = os.put({ clave: clave, valor: valor });
        r.onsuccess = () => res(true);
        r.onerror = () => res(false);
      });
    },

    ajustesGetTodos: async function (defectoObj) {
      const def = defectoObj || {};
      const d = await abrirDB();
      if (d === "ls") {
        try {
          const obj = JSON.parse(localStorage.getItem(lsKeyAjustes()) || "{}");
          return Object.assign({}, def, obj);
        } catch (e) { return def; }
      }
      const os = await txLectura(STORE_AJUSTES);
      return new Promise((res) => {
        const out = Object.assign({}, def);
        const cur = os.openCursor();
        cur.onsuccess = (e) => {
          const c = e.target.result;
          if (c) { out[c.key] = c.value.valor; c.continue(); }
          else res(out);
        };
        cur.onerror = () => res(out);
      });
    }
  };

  global.Storage = Storage;
})(window);
