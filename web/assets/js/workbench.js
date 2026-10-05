/* ============================================================================
 * workbench.js · Tarjeta de construcción visual (arrastrar y soltar)
 * ----------------------------------------------------------------------------
 * Tablero con ranuras (dropzones) donde se ensambla una Fórmula Bien Formada
 * y se ve, en tiempo real, su forma canónica y su lectura en lenguaje natural.
 *
 *   ┌──────┬────────┬──────┐        ┌──────┬────────┬──────┐
 *   │  A   │   ∧    │  B   │  [+]   │  C   │   ∨    │  D   │
 *   └──────┴────────┴──────┘        └──────┴────────┴──────┘
 *
 * El botón «+» al final de la fila añade un par (conector + proposición).
 * El botón «−» quita el último par añadido. Así se pueden encadenar tantas
 * proposiciones como haga falta, cada una con su propio conectivo.
 *
 * REGLA DE COMPOSICIÓN (plegado por la izquierda)
 *   ¬ A                                        →  ¬A
 *   A ∧ B                                      →  (A ∧ B)
 *   A ∧ B ∨ C → D                              →  (((A ∧ B) ∨ C) → D)
 *
 * EXTENSIBILIDAD
 *   · Añadir un par extra      → Workbench.anadirPar().
 *   · Añadir una ranura        → Workbench.registrarSlot({ id, rol, orden, acepta… }).
 *   · Añadir un tipo de pieza  → Workbench.registrarTipo(clave, { etiqueta, clase }).
 *   · Añadir una regla         → Workbench.registrarRegla(): recibe el estado de
 *     las ranuras (conectores y operandos ya ordenados) y devuelve un nodo AST.
 *
 * El módulo NO conoce las tarjetas ni el historial: recibe callbacks
 * (`alCrear`, `alCambiar`, `alAvisar`) desde la página que lo usa, de modo que
 * puede reutilizarse en otros módulos sin cambios.
 * ========================================================================== */
"use strict";

(function (global) {
  /* ------------------------------------------------------------------ */
  /* Configuración por defecto (punto de extensión)                      */
  /* ------------------------------------------------------------------ */
  const TIPOS = {
    proposicion: { etiqueta: "Proposición", clase: "slot-pieza", conecta: true },
    conector: { etiqueta: "Conector", clase: "slot-conector", conecta: false },
    parentesis: { etiqueta: "Paréntesis", clase: "slot-conector", conecta: false }
  };

  const CONECTORES = [
    { op: "¬", texto: "no", titulo: "Negación: no A" },
    { op: "∧", texto: "y", titulo: "Conjunción: A y B" },
    { op: "∨", texto: "o", titulo: "Disyunción: A o B" },
    { op: "→", texto: "si…entonces", titulo: "Condicional: si A entonces B" },
    { op: "↔", texto: "sii", titulo: "Bicondicional: A si y solo si B" }
  ];

  /* Cuántos pares (conector + proposición) se pueden añadir como máximo.
     La FBF admite más, pero a partir de 6 átomos la tabla de verdad ya no se
     calcula (ver Semantica.MAX_ATOMOS_TABLA), así que el tope evita crear
     fórmulas imposibles de clasificar. */
  const MAX_PARES_EXTRA = 8;

  /* Ranuras del tablero. El array está en orden de lectura:
       op1 · con1 · op2 · [con2 · op3] · [con3 · op4] …
     · `rol`      → familia (conector / operando) que usa cada regla.
     · `orden`    → posición dentro de su familia, para componer en cadena.  */
  const SLOTS = [
    {
      id: "op1",
      rol: "operando",
      orden: 1,
      titulo: "Proposición A",
      pista: "[ Arrastra aquí ]",
      acepta: ["proposicion"]
    },
    {
      id: "con1",
      rol: "conector",
      orden: 1,
      titulo: "Conector",
      pista: "[ Arrastra aquí ]",
      acepta: ["conector"]
    },
    {
      id: "op2",
      rol: "operando",
      orden: 2,
      titulo: "Proposición B",
      pista: "[ Arrastra aquí ]",
      acepta: ["proposicion"]
    }
  ];

  /* Reglas de composición: convierten el estado de las ranuras en un nodo AST.
     Se evalúan en orden; la primera cuyo `cuando` se cumple gana.
     `e.conectores` y `e.operandos` llegan ya ordenados por `orden`.
       · e.conectores → [{ id, orden, op }]
       · e.operandos  → [{ id, orden, pieza }] */
  const REGLAS = [
    {
      nombre: "negacion",
      etiqueta: "Negación",
      cuando: function (e) {
        return e.conectores.length === 1 && e.conectores[0].op === "¬" && e.operandos.length >= 1;
      },
      aplicar: function (e) {
        const P = global.LogicaParser;
        return { nodo: new P.NegNode(P.parsear(e.operandos[0].pieza.formula)) };
      }
    },
    {
      nombre: "cadena",
      etiqueta: "Cadena de proposiciones",
      cuando: function (e) {
        return e.operandos.length >= 2 && e.conectores.length >= e.operandos.length - 1;
      },
      aplicar: function (e) {
        const P = global.LogicaParser;
        /* Plegado por la izquierda: (((A ∧ B) ∨ C) → D) */
        let nodo = P.parsear(e.operandos[0].pieza.formula);
        for (let i = 0; i < e.operandos.length - 1; i++) {
          nodo = new P.BinNode(e.conectores[i].op, nodo, P.parsear(e.operandos[i + 1].pieza.formula));
        }
        return { nodo: nodo };
      }
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Estado interno                                                     */
  /* ------------------------------------------------------------------ */
  let contenedor = null;             // <div id="workbench">
  let opciones = { alCrear: null, alCambiar: null, alAvisar: null };
  let ranuras = Object.create(null);  // id → { pieza, agrupado }
  let arrastre = null;               // pieza arrastrada (dragover no lee dataTransfer)
  let arrancando = false;            // hay un dragstart activo en la página

  function el(id) { return document.getElementById(id); }
  function porId(id) { return SLOTS.filter(function (s) { return s.id === id; })[0] || null; }

  /* Escape de HTML. Reutiliza el de app.js si está disponible y, si el módulo
     se carga sin él, usa un equivalente local para no romper el tablero. */
  const esc = typeof global.esc === "function" ? global.esc : function (texto) {
    return String(texto === undefined || texto === null ? "" : texto).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  function avisar(mensaje, tipo) {
    if (typeof opciones.alAvisar === "function") { opciones.alAvisar(mensaje, tipo); return; }
    if (global.App && global.App.toast) global.App.toast(mensaje, tipo || "info");
  }

  /* Ranuras de una familia, ordenadas como aparecen en la fórmula. */
  function ranurasDe(rol) {
    return SLOTS
      .filter(function (s) { return s.rol === rol; })
      .sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
  }

  /* Pares añadidos con «+» (los que se pueden quitar con «−»).
     Cada par son dos ranuras (conector + operando), así que se cuentan los
     identificadores de par distintos y no las ranuras. */
  function paresExtra() {
    const vistos = [];
    SLOTS.forEach(function (s) {
      if (s.extra === true && vistos.indexOf(s.par) === -1) vistos.push(s.par);
    });
    return vistos;
  }

  /* ------------------------------------------------------------------ */
  /* API pública                                                        */
  /* ------------------------------------------------------------------ */
  const Workbench = {
    TIPOS: TIPOS,
    CONECTORES: CONECTORES,
    SLOTS: SLOTS,
    REGLAS: REGLAS,
    MAX_PARES_EXTRA: MAX_PARES_EXTRA,

    /* Permite ampliar el tablero sin tocar el resto del módulo. */
    registrarSlot: function (def) {
      if (!def || !def.id) return null;
      const existente = porId(def.id);
      if (existente) return existente;
      SLOTS.push(Object.assign({
        rol: def.rol || "operando",
        orden: (ranurasDe(def.rol || "operando").length + 1),
        titulo: def.id,
        pista: "[ Arrastra aquí ]",
        acepta: def.acepta || ["proposicion"]
      }, def));
      return porId(def.id);
    },

    /* Registra una pieza de un tipo nuevo. */
    registrarTipo: function (clave, def) {
      TIPOS[clave] = Object.assign({ etiqueta: clave, clase: "slot-pieza", conecta: true }, def || {});
      return TIPOS[clave];
    },

    /* Registra una regla nueva de composición.
       Las reglas se evalúan en orden y gana la primera aplicable. Pasa
       `antes = true` para que la nueva tenga prioridad sobre las existentes
       (por ejemplo, para redefinir cómo se compone un conectivo). */
    registrarRegla: function (regla, antes) {
      if (!regla || typeof regla.aplicar !== "function") return REGLAS.length;
      if (antes) REGLAS.unshift(regla);
      else REGLAS.push(regla);
      return REGLAS.length;
    },

    init: function (opc) {
      opciones = Object.assign({ alCrear: null, alCambiar: null, alAvisar: null }, opc || {});
      contenedor = typeof opciones.contenedor === "string" ? el(opciones.contenedor) : opciones.contenedor;
      if (!contenedor) return;
      this.render();
      this.refrescarOrigenes();
    },

    /* Vuelve al tablero inicial (2 proposiciones y 1 conector). */
    reiniciar: function () {
      SLOTS.length = 0;
      SLOTS.push(
        { id: "op1", rol: "operando", orden: 1, titulo: "Proposición A",
          pista: "[ Arrastra aquí ]", acepta: ["proposicion"] },
        { id: "con1", rol: "conector", orden: 1, titulo: "Conector",
          pista: "[ Arrastra aquí ]", acepta: ["conector"] },
        { id: "op2", rol: "operando", orden: 2, titulo: "Proposición B",
          pista: "[ Arrastra aquí ]", acepta: ["proposicion"] }
      );
      ranuras = Object.create(null);
      arrastre = null;
      arrancando = false;
      this.render();
      this.refrescarOrigenes();
      this.notificar();
    },

    /* ---------------------------------------------------------------- */
    /* Cadena de pares: más conectores y más proposiciones              */
    /* ---------------------------------------------------------------- */

    /* Añade al final de la fila un par (conector + proposición). */
    anadirPar: function () {
      const extra = paresExtra();
      if (extra.length >= MAX_PARES_EXTRA) {
        avisar("Máximo de " + MAX_PARES_EXTRA + " pares extra (" +
          (2 + extra.length) + " proposiciones).", "error");
        return null;
      }
      /* Los números se deducen del tablero para que el `id` nunca choque con
         una ranura existente aunque se haya quitado alguna por el medio. */
      const k = ranurasDe("conector").length;      // el nuevo será con(k+1)
      const n = ranurasDe("operando").length;       // el nuevo será op(n+1)
      const conector = this.registrarSlot({
        id: "con" + (k + 1),
        rol: "conector",
        orden: k + 1,
        extra: true,
        par: k + 1,
        titulo: "Conector " + (k + 1),
        pista: "[ Conector ]",
        acepta: ["conector"]
      });
      const operando = this.registrarSlot({
        id: "op" + (n + 1),
        rol: "operando",
        orden: n + 1,
        extra: true,
        par: k + 1,
        titulo: "Proposición " + (n + 1),
        pista: "[ Arrastra aquí ]",
        acepta: ["proposicion"]
      });
      this.render();
      this.refrescarOrigenes();
      this.notificar();
      if (contenedor && conector) {
        const nodo = contenedor.querySelector('[data-slot="' + conector.id + '"]');
        if (nodo) nodo.focus();
      }
      return { conector: conector, operando: operando };
    },

    /* Quita el último par (conector + proposición) añadido. */
    quitarUltimoPar: function () {
      const extra = paresExtra();
      if (!extra.length) { avisar("No hay pares extra que quitar.", "error"); return false; }
      const ultimoPar = extra[extra.length - 1];
      const miembros = SLOTS.filter(function (s) { return s.extra === true && s.par === ultimoPar; });
      miembros.forEach(function (s) {
        delete ranuras[s.id];
        SLOTS.splice(SLOTS.indexOf(s), 1);
      });
      this.render();
      this.refrescarOrigenes();
      this.notificar();
      return true;
    },

    /* ---------------------------------------------------------------- */
    /* Render                                                           */
    /* ---------------------------------------------------------------- */
    render: function () {
      if (!contenedor) return;
      const hayExtra = paresExtra().length > 0;
      contenedor.className = "workbench";
      contenedor.innerHTML =
        '<div class="workbench-tablero">' +
          SLOTS.map(function (s) { return Workbench.htmlRanura(s); }).join("") +
          '<div class="workbench-anadir">' +
            '<button type="button" class="workbench-mas" id="wb-mas"' +
              ' title="Añade otro conector y otra proposición" ' +
              'aria-label="Añade otro conector y otra proposición">+</button>' +
            '<button type="button" class="workbench-menos" id="wb-menos"' +
              ' title="Quita el último conector y la última proposición"' +
              ' aria-label="Quita el último par añadido"' + (hayExtra ? "" : " disabled") + ">−</button>" +
            '<span class="workbench-anadir-nota">y entrelaza otra proposición</span>' +
          "</div>" +
        "</div>" +
        '<div class="workbench-preview vacia" id="wb-preview">' +
          '<div class="prev-fbf" id="wb-prev-fbf">FBF en construcción…</div>' +
          '<div class="prev-lectura" id="wb-prev-lectura">Arrastra piezas a las ranuras para ver la fórmula.</div>' +
          '<div class="prev-nota" id="wb-prev-nota"></div>' +
        "</div>" +
        '<div class="workbench-tray" id="wb-tray">' +
          '<span class="tray-titulo">Conectivos</span>' +
          CONECTORES.map(function (c) {
            return '<span class="btn-conectivo wb-token" draggable="true" data-pieza=\'' +
              JSON.stringify({ tipo: "conector", op: c.op }) + '\' title="' + esc(c.titulo) + '">' +
              '<span class="texto-fbf">' + c.op + "</span>" +
              '<span class="texto-token">' + c.texto + "</span></span>";
          }).join("") +
        "</div>" +
        '<div class="workbench-acciones">' +
          '<button type="button" class="btn-pixel btn-azul" id="wb-crear">Crear Tarjeta FBF</button>' +
          '<button type="button" class="btn-pixel btn-gris" id="wb-limpiar">Limpiar ranuras</button>' +
          '<span class="wb-nota" id="wb-nota">Con 3 o más proposiciones se encadenan por la izquierda.</span>' +
        "</div>";

      this.bind();
      this.refrescarRanuras();
      this.preview();
    },

    /* Marcado de una ranura (estado vacío / ocupada / deshabilitada). */
    htmlRanura: function (def) {
      return '<div class="workbench-slot' + (def.rol === "conector" ? " conector" : "") +
        (def.extra ? " extra" : "") + '"' +
        ' data-slot="' + def.id + '" data-rol="' + def.rol + '" tabindex="0" role="button"' +
        ' aria-label="' + esc(def.titulo) + '">' +
        '<span class="slot-titulo">' + esc(def.titulo) + "</span>" +
        '<span class="slot-pista">' + esc(def.pista) + "</span>" +
        '<button type="button" class="slot-quitar" data-quitar="' + def.id + '" hidden>✕</button>' +
        "</div>";
    },

    /* ---------------------------------------------------------------- */
    /* Estado de las ranuras                                            */
    /* ---------------------------------------------------------------- */
    estado: function () {
      return SLOTS.map(function (s) { return Object.assign({ def: s }, ranuras[s.id] || {}); });
    },

    hay: function (id) { return !!(ranuras[id] && ranuras[id].pieza); },
    pieza: function (id) { return ranuras[id] ? ranuras[id].pieza : null; },

    /* ¿La ranura acepta este tipo de pieza ahora mismo? */
    acepta: function (def, pieza) {
      if (!def || !pieza) return false;
      /* El paréntesis es un modificador: vale en cualquier ranura de operando
         y no ocupa el hueco (alterna la agrupación). */
      if (pieza.tipo === "parentesis") {
        if (def.rol !== "operando") return false;
      } else if ((def.acepta || []).indexOf(pieza.tipo) === -1) {
        return false;
      }
      return !this.estaDeshabilitada(def);
    },

    estaDeshabilitada: function (def) {
      if (!def) return false;

      /* Regla genérica declarada por la propia ranura. */
      if (def.seDesactivaCon) {
        const otra = this.pieza(def.seDesactivaCon.ranura);
        if (otra && otra.tipo === "conector" && otra.op === def.seDesactivaCon.valor) return true;
      }

      /* La negación solo admite una proposición: todo lo que va detrás del
         primer conector queda desactivado mientras haya un ¬ en él. */
      if ((def.orden || 1) > 1) {
        const con = this.pieza("con1");
        if (con && con.tipo === "conector" && con.op === "¬") return true;
      }
      return false;
    },

    /* Coloca una pieza en una ranura validando el tipo. */
    poner: function (id, pieza, opcionesPoner) {
      const def = porId(id);
      const cfg = opcionesPoner || {};
      if (!def) return false;

      if (!this.acepta(def, pieza)) {
        if (!cfg.silencioso) {
          avisar(this.estaDeshabilitada(def)
            ? (def.alDeshabilitarse || "Con la negación solo se usa la primera proposición.")
            : "En «" + def.titulo + "» no se puede soltar " +
              (TIPOS[pieza.tipo] ? TIPOS[pieza.tipo].etiqueta.toLowerCase() : "esa pieza") + ".",
            "error");
        }
        return false;
      }

      /* El token de paréntesis no ocupa la ranura: alterna la agrupación. */
      if (pieza.tipo === "parentesis") {
        ranuras[id] = ranuras[id] || {};
        ranuras[id].agrupado = !ranuras[id].agrupado;
        this.refrescarRanuras();
        this.preview();
        this.notificar();
        return true;
      }

      ranuras[id] = { pieza: pieza, agrupado: (ranuras[id] && ranuras[id].agrupado) || false };

      /* Un ¬ vacía todo lo que tenga detrás: no se puede encadenar. */
      if (pieza.tipo === "conector" && pieza.op === "¬") {
        SLOTS.forEach(function (s) {
          if ((s.orden || 1) > (def.orden || 1) && ranuras[s.id]) delete ranuras[s.id];
        });
      }

      this.refrescarRanuras();
      this.preview();
      this.notificar();
      return true;
    },

    quitar: function (id) {
      if (!ranuras[id]) return false;
      delete ranuras[id];
      this.refrescarRanuras();
      this.preview();
      this.notificar();
      return true;
    },

    limpiar: function () {
      ranuras = Object.create(null);
      this.refrescarRanuras();
      this.preview();
      this.notificar();
      avisar("Ranuras vaciadas", "info");
    },

    notificar: function () {
      if (typeof opciones.alCambiar === "function") opciones.alCambiar(this.resumen());
    },

    /* Estado listo para la página: piezas y FBF en construcción. */
    resumen: function () {
      const comp = this.componer();
      const piezas = {};
      SLOTS.forEach(function (s) {
        if (ranuras[s.id] && ranuras[s.id].pieza) piezas[s.id] = ranuras[s.id].pieza;
      });
      return {
        piezas: piezas,
        formula: comp.ok ? comp.formula : null,
        lectura: comp.ok ? comp.lectura : null,
        completa: comp.ok,
        error: comp.error || null
      };
    },

    /* Pinta el contenido de cada ranura y sus clases de estado. */
    refrescarRanuras: function () {
      if (!contenedor) return;
      SLOTS.forEach(function (def) {
        const nodo = contenedor.querySelector('[data-slot="' + def.id + '"]');
        if (!nodo) return;
        const estado = ranuras[def.id] || {};
        const pieza = estado.pieza;
        const deshabilitada = Workbench.estaDeshabilitada(def);

        nodo.classList.toggle("ocupado", !!pieza);
        nodo.classList.toggle("inactivo", deshabilitada);
        nodo.setAttribute("aria-disabled", deshabilitada ? "true" : "false");

        const pista = nodo.querySelector(".slot-pista");
        const quitar = nodo.querySelector("[data-quitar]");
        if (quitar) quitar.hidden = !pieza;

        if (pieza) {
          const clase = (TIPOS[pieza.tipo] && TIPOS[pieza.tipo].clase) || "slot-pieza";
          const contenido = pieza.tipo === "conector" ? pieza.op : (pieza.formula || "");
          pista.innerHTML = '<span class="' + clase + '">' + esc(contenido) + "</span>" +
            (estado.agrupado ? '<span class="slot-parentesis">(</span>' : "") +
            (pieza.lectura ? '<span class="slot-lectura">' + esc(pieza.lectura) + "</span>" : "");
        } else {
          pista.textContent = deshabilitada
            ? (def.alDeshabilitarse || "—")
            : def.pista;
        }
      });

      const menos = el("wb-menos");
      if (menos) menos.disabled = paresExtra().length === 0;
    },

    /* ---------------------------------------------------------------- */
    /* Composición: ranuras → AST → FBF + lectura natural               */
    /* ---------------------------------------------------------------- */
    componer: function () {
      const P = global.LogicaParser;
      if (!P) return { ok: false, error: "El parser no está cargado." };

      /* Se recogen las piezas por familia y se ordenan por `orden`, de modo que
         añadir pares no obliga a cambiar esta función. */
      const e = { conectores: [], operandos: [] };
      SLOTS.forEach(function (def) {
        const estado = ranuras[def.id];
        if (!estado || !estado.pieza) return;
        const pieza = Object.assign({}, estado.pieza);
        if (estado.agrupado && pieza.tipo === "proposicion") {
          pieza.formula = "(" + pieza.formula + ")";
        }
        const entrada = { id: def.id, orden: def.orden || 0, pieza: pieza };
        if (def.rol === "conector") e.conectores.push({ id: def.id, orden: def.orden || 0, op: pieza.op });
        else if (def.rol === "operando") e.operandos.push(entrada);
      });
      e.operandos.sort(function (a, b) { return a.orden - b.orden; });
      e.conectores.sort(function (a, b) { return a.orden - b.orden; });

      /* Descripciones (significados) unidas de todos los operandos usados. */
      const descripciones = {};
      e.operandos.forEach(function (o) {
        if (o.pieza && o.pieza.descripciones) Object.assign(descripciones, o.pieza.descripciones);
      });

      /* Sin proposición todavía no hay nada que componer. */
      if (!e.operandos.length) {
        return { ok: false, error: null, piezas: e, descripciones: descripciones };
      }

      /* Primera regla aplicable: convierte todo el estado en un nodo AST.
         Se prueban todas antes de avisar nada, para que una regla registrada
         pueda definir su propio conectivo (ver registrarRegla). */
      for (let i = 0; i < REGLAS.length; i++) {
        const regla = REGLAS[i];
        if (regla.cuando(e)) {
          let salida = null;
          try { salida = this.aplicarRegla(regla, e, descripciones); }
          catch (err) {
            return {
              ok: false,
              error: "No se pudo componer la fórmula: " + (err && err.message ? err.message : err),
              piezas: e,
              descripciones: descripciones
            };
          }
          if (salida && salida.ok) return salida;
        }
      }

      /* Ninguna regla admite el conectivo: se avisa en lugar de dejar que el
         parser lance un error interno. */
      const conocidos = CONECTORES.map(function (c) { return c.op; });
      const desconocido = e.conectores.filter(function (c) {
        return conocidos.indexOf(c.op) === -1;
      })[0];
      if (desconocido) {
        return {
          ok: false,
          error: "Conectivo no reconocido: " + desconocido.op,
          piezas: e,
          descripciones: descripciones
        };
      }

      /* Ninguna regla aplicable: normalmente falta un conectivo. */
      const faltanConectores = e.operandos.length - 1 - e.conectores.length;
      return {
        ok: false,
        error: faltanConectores > 0
          ? (faltanConectores === 1
            ? "Falta un conectivo entre las proposiciones."
            : "Faltan " + faltanConectores + " conectivos entre las proposiciones.")
          : "Completa las ranuras.",
        piezas: e,
        descripciones: descripciones
      };
    },

    /* Ejecuta una regla y normaliza su salida. */
    aplicarRegla: function (regla, e, descripciones) {
      const P = global.LogicaParser;
      const salida = regla.aplicar(e);
      const nodo = salida && salida.nodo;
      if (!nodo) return { ok: false, error: (salida && salida.error) || "No se pudo componer." };
      return {
        ok: true,
        error: null,
        regla: regla.nombre,
        piezas: e,
        nodo: nodo,
        formula: P.aCadena(nodo),
        lectura: P.renderEs(nodo, descripciones),
        descripciones: descripciones
      };
    },

    /* Vista previa en tiempo real. */
    preview: function () {
      if (!contenedor) return;
      const caja = el("wb-preview");
      const fbf = el("wb-prev-fbf");
      const lectura = el("wb-prev-lectura");
      const nota = el("wb-prev-nota");
      if (!caja || !fbf) return;

      const comp = this.componer();

      if (!comp.ok) {
        caja.classList.add("vacia");
        caja.classList.remove("lista");
        fbf.textContent = "FBF en construcción…";
        lectura.textContent = comp.error
          || "Arrastra piezas a las ranuras para ver la fórmula.";
        nota.textContent = this.notaAyuda();
        return;
      }

      caja.classList.remove("vacia");
      caja.classList.add("lista");
      fbf.textContent = "(" + comp.formula + ")";
      lectura.textContent = "“" + comp.lectura + "”";
      nota.innerHTML = this.notaSemantica(comp);
    },

    /* Nota de ayuda según lo que falta por colocar. */
    notaAyuda: function () {
      const falta = [];
      SLOTS.forEach(function (s) {
        if (Workbench.estaDeshabilitada(s)) return;
        if (!ranuras[s.id] || !ranuras[s.id].pieza) falta.push(s.titulo);
      });
      if (!falta.length) return "";
      return "Pendiente: " + falta.join(" · ");
    },

    /* Clasificación con el evaluador semántico (si está cargado). */
    notaSemantica: function (comp) {
      const partes = [];
      const atomos = global.LogicaParser ? global.LogicaParser.atomos(comp.nodo) : [];
      if (global.Semantica && comp.nodo) {
        try {
          const info = global.Semantica.clasificar(comp.nodo);
          partes.push("<strong>" + esc(info.clase) + "</strong>");
        } catch (err) {
          partes.push("sin clasificar: " + esc(err.message));
        }
      }
      partes.push(atomos.length + " proposición/es atómica/s");
      if (global.Semantica && atomos.length > global.Semantica.MAX_ATOMOS_TABLA) {
        partes.push("la tabla de verdad supera el límite de " + global.Semantica.MAX_ATOMOS_TABLA + " átomos");
      }
      if (atomos.length >= 3) partes.push("encadenada por la izquierda");
      return partes.length ? partes.join(" · ") : "";
    },

    /* Crea la tarjeta a partir de lo compuesto. El callback de la página puede
       ser asíncrono y devolver `false` para conservar las ranuras (por ejemplo
       cuando el límite del administrador impidió crear la tarjeta). */
    crear: async function () {
      const comp = this.componer();
      if (!comp.ok) {
        avisar(comp.error || "Completa las ranuras antes de crear la tarjeta.", "error");
        return null;
      }
      const resultado = {
        formula: comp.formula,
        lectura: comp.lectura,
        descripciones: comp.descripciones,
        piezas: comp.piezas,
        tipo: "workbench"
      };
      let crear = null;
      if (typeof opciones.alCrear === "function") {
        try { crear = await opciones.alCrear(resultado); }
        catch (err) { avisar(err.message || "No se pudo crear la tarjeta.", "error"); return null; }
      }
      /* Si la página no confirma (no estaba al límite), se limpian las ranuras. */
      if (crear !== false) this.limpiar();
      return crear === undefined ? resultado : crear;
    },

    /* ---------------------------------------------------------------- */
    /* Drag & drop                                                      */
    /* ---------------------------------------------------------------- */

    /* Registra un elemento como origen de arrastre.
       `pieza` es un objeto { tipo, … } que se entrega al soltar. */
    marcarOrigen: function (elemento, pieza) {
      if (!elemento) return;
      elemento.setAttribute("draggable", "true");
      if (elemento.dataset.wbOrigen === "1") {
        /* Reutiliza el mismo elemento tras un rerender: solo actualiza la pieza. */
        elemento.dataset.wbPieza = JSON.stringify(pieza);
        return;
      }
      elemento.dataset.wbOrigen = "1";
      elemento.dataset.wbPieza = JSON.stringify(pieza);

      elemento.addEventListener("dragstart", function (ev) {
        arrastre = Workbench.leerPieza(elemento);
        arrancando = true;
        elemento.classList.add("arrastrando");
        if (ev.dataTransfer) {
          ev.dataTransfer.effectAllowed = "copy";
          try { ev.dataTransfer.setData("text/plain", elemento.dataset.wbPieza); } catch (e) { /* Safari */ }
        }
        Workbench.pintarRanuras();
      });

      elemento.addEventListener("dragend", function () {
        arrastre = null;
        arrancando = false;
        elemento.classList.remove("arrastrando");
        Workbench.pintarRanuras();
      });
    },

    /* Lee la pieza de un origen de arrastre. Los elementos marcados con
       `marcarOrigen()` la guardan en `data-wb-pieza`; los tokens de la bandeja
       usan `data-pieza`. Se aceptan ambos. */
    leerPieza: function (elemento) {
      if (!elemento || !elemento.dataset) return null;
      const crudo = elemento.dataset.wbPieza || elemento.dataset.pieza;
      if (!crudo) return null;
      try { return JSON.parse(crudo); }
      catch (e) { return null; }
    },

    /* Resalta las ranuras compatibles con lo que se arrastra. */
    pintarRanuras: function () {
      if (!contenedor) return;
      SLOTS.forEach(function (def) {
        const nodo = contenedor.querySelector('[data-slot="' + def.id + '"]');
        if (!nodo) return;
        nodo.classList.remove("acepta", "rechaza");
        if (!arrancando || !arrastre) return;
        nodo.classList.add(Workbench.acepta(def, arrastre) ? "acepta" : "rechaza");
      });
    },

    /* Vuelve a enganchar como arrastrables las tarjetas y los botones
       conectivos que la página acaba de renderizar. */
    refrescarOrigenes: function () {
      if (!global.Workbench) return;
      const origenes = document.querySelectorAll("[data-wb-tarjeta]");
      Array.prototype.forEach.call(origenes, function (nodo) {
        const id = parseInt(nodo.getAttribute("data-wb-tarjeta"), 10);
        if (!global.obtenerTarjetaPorId) return;
        const t = global.obtenerTarjetaPorId(id);
        if (!t) return;
        Workbench.marcarOrigen(nodo, {
          tipo: "proposicion",
          id: t.id,
          formula: t.formula,
          lectura: t.lectura,
          descripciones: t.descripciones || {}
        });
      });

      /* Botones conectivos de la sección "2 · Conectivos". */
      const botones = document.querySelectorAll("[data-conector]");
      Array.prototype.forEach.call(botones, function (nodo) {
        Workbench.marcarOrigen(nodo, { tipo: "conector", op: nodo.getAttribute("data-conector") });
      });
    },

    /* Coloca una pieza en la primera ranura compatible y libre.
       Es la alternativa al arrastre para móviles y teclado. */
    asignar: function (pieza) {
      if (!pieza) return false;
      if (pieza.tipo === "parentesis") {
        const ocupada = SLOTS.filter(function (s) {
          return ranuras[s.id] && ranuras[s.id].pieza && ranuras[s.id].pieza.tipo === "proposicion";
        })[0];
        if (!ocupada) { avisar("Primero coloca una proposición para agruparla.", "error"); return false; }
        return Workbench.poner(ocupada.id, pieza);
      }
      for (let i = 0; i < SLOTS.length; i++) {
        const def = SLOTS[i];
        if (!Workbench.acepta(def, pieza)) continue;
        if (ranuras[def.id] && ranuras[def.id].pieza) continue;
        return Workbench.poner(def.id, pieza);
      }
      avisar("No queda ninguna ranura libre para " +
        (TIPOS[pieza.tipo] ? TIPOS[pieza.tipo].etiqueta.toLowerCase() : "esa pieza") +
        ". Usa «+» para alargar la fórmula.", "error");
      return false;
    },

    /* Coloca la pieza en una ranura concreta (alternativa al arrastre). */
    asignarEn: function (id, pieza) {
      const def = porId(id);
      if (!def) return false;
      return this.poner(id, pieza);
    },

    /* ---------------------------------------------------------------- */
    /* Eventos del tablero                                              */
    /* ---------------------------------------------------------------- */
    bind: function () {
      if (!contenedor) return;

      /* Piezas de la bandeja (conectivos). */
      this.bindTokens();

      /* Ranuras: soltar y, con clic/teclado, asignar o limpiar. */
      SLOTS.forEach(function (def) {
        const nodo = contenedor.querySelector('[data-slot="' + def.id + '"]');
        if (!nodo) return;

        nodo.addEventListener("dragenter", function (ev) {
          /* La spec pide cancelar dragenter Y dragover para que el elemento
             cuente como zona de destino válida y se llegue a disparar drop. */
          ev.preventDefault();
          if (!arrastre) return;
          nodo.classList.add(Workbench.acepta(def, arrastre) ? "acepta" : "rechaza");
        });

        nodo.addEventListener("dragover", function (ev) {
          /* Sin preventDefault el navegador no dispara el evento drop. */
          ev.preventDefault();
          if (ev.dataTransfer) ev.dataTransfer.dropEffect = "copy";
          nodo.classList.remove("acepta", "rechaza");
          if (!arrastre) return;
          nodo.classList.add(Workbench.acepta(def, arrastre) ? "acepta" : "rechaza");
        });

        nodo.addEventListener("dragleave", function (ev) {
          /* Salir hacia un hijo no cuenta como abandono real. */
          if (ev.relatedTarget && nodo.contains(ev.relatedTarget)) return;
          nodo.classList.remove("acepta", "rechaza");
        });

        nodo.addEventListener("drop", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          nodo.classList.remove("acepta", "rechaza");
          let pieza = arrastre;
          if (!pieza && ev.dataTransfer) {
            try { pieza = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch (e) { pieza = null; }
          }
          arrastre = null;
          arrancando = false;
          Workbench.pintarRanuras();
          if (!pieza) { avisar("No se reconoce la pieza soltada.", "error"); return; }
          Workbench.poner(def.id, pieza);
        });

        nodo.addEventListener("click", function (ev) {
          if (ev.target.closest("[data-quitar]")) return;
          if (Workbench.hay(def.id)) { Workbench.quitar(def.id); return; }
          if (arrastre) Workbench.poner(def.id, arrastre);
        });

        nodo.addEventListener("keydown", function (ev) {
          if (ev.key !== "Enter" && ev.key !== " ") return;
          ev.preventDefault();
          if (Workbench.hay(def.id)) Workbench.quitar(def.id);
        });
      });

      /* Botones de quitar pieza. */
      const quitar = contenedor.querySelectorAll("[data-quitar]");
      Array.prototype.forEach.call(quitar, function (btn) {
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          Workbench.quitar(btn.getAttribute("data-quitar"));
        });
      });

      const crear = el("wb-crear");
      if (crear) crear.addEventListener("click", function () { Workbench.crear(); });

      const limpiar = el("wb-limpiar");
      if (limpiar) limpiar.addEventListener("click", function () { Workbench.limpiar(); });

      const mas = el("wb-mas");
      if (mas) mas.addEventListener("click", function () { Workbench.anadirPar(); });

      const menos = el("wb-menos");
      if (menos) menos.addEventListener("click", function () { Workbench.quitarUltimoPar(); });
    },

    /* Engancha los tokens de la bandeja (se rehacen en cada render). */
    bindTokens: function () {
      const tokens = contenedor.querySelectorAll(".wb-token");
      Array.prototype.forEach.call(tokens, function (token) {
        token.addEventListener("dragstart", function (ev) {
          arrastre = Workbench.leerPieza(token);
          arrancando = true;
          token.classList.add("arrastrando");
          if (ev.dataTransfer) {
            ev.dataTransfer.effectAllowed = "copy";
            try { ev.dataTransfer.setData("text/plain", token.dataset.pieza); } catch (e) { /* Safari */ }
          }
          Workbench.pintarRanuras();
        });
        token.addEventListener("dragend", function () {
          arrastre = null;
          arrancando = false;
          token.classList.remove("arrastrando");
          Workbench.pintarRanuras();
        });
        /* Táctil / clic: coloca la pieza en la primera ranura libre. */
        token.addEventListener("click", function () {
          Workbench.asignar(Workbench.leerPieza(token));
        });
      });
    }
  };

  global.Workbench = Workbench;
})(window);
