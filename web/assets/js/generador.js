
"use strict";

(function () {
  var LP = window.LogicaParser;
  var S = window.Semantica;
  var G = {};

  G.ATOMOS_POOL = ["p", "q", "r", "s", "t"];
  G.DESCRIPCIONES_POOL = [
    "llueve", "hace frío", "hace calor", "nieva", "hay neblina",
    "estudio", "duermo", "como", "trabajo", "descanso",
    "corro", "bailo", "canto", "leo", "mira televisión", "viaja",
  ];

  var OPERADORES_BINARIOS = ["∧", "∨", "→", "↔"];


  G.alea = function (semilla) {
    var a = semilla >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function fbfAleatoria(varsUsadas, profundidadRestante, rnd) {
    rnd = rnd || Math.random;
    if (profundidadRestante <= 0 || rnd() < 0.4) {
      return new LP.AtomNode(varsUsadas[Math.floor(rnd() * varsUsadas.length)]);
    }
    var modo = rnd();
    if (modo < 0.25) {
      return new LP.NegNode(fbfAleatoria(varsUsadas, profundidadRestante - 1, rnd));
    }
    var op = OPERADORES_BINARIOS[Math.floor(rnd() * OPERADORES_BINARIOS.length)];
    return new LP.BinNode(
      op,
      fbfAleatoria(varsUsadas, profundidadRestante - 1, rnd),
      fbfAleatoria(varsUsadas, profundidadRestante - 1, rnd)
    );
  }

  function sobreSubconjunto(rnd) {
    var n = 1 + Math.floor(rnd() * Math.min(3, G.ATOMOS_POOL.length));

    var pool = G.ATOMOS_POOL.slice();
    var res = [];
    for (var i = 0; i < n; i++) {
      var idx = Math.floor(rnd() * pool.length);
      res.push(pool.splice(idx, 1)[0]);
    }
    return res;
  }


  function generarForma(categoria, rnd) {
    var vars_semilla = sobreSubconjunto(rnd);
    var base = fbfAleatoria(vars_semilla, 1 + Math.floor(rnd() * 3), rnd);
    if (categoria === "tautologia") return new LP.BinNode("∨", base, new LP.NegNode(base));
    if (categoria === "contradiccion") return new LP.BinNode("∧", base, new LP.NegNode(base));
    return base;
  }


  G.proposicionAleatoria = function (simbolosPermitidos, rnd) {
    rnd = rnd || Math.random;
    var pool = simbolosPermitidos && simbolosPermitidos.length ? simbolosPermitidos.slice() : G.ATOMOS_POOL.slice();
    var n = Math.min(1 + Math.floor(rnd() * 3), pool.length);
    var varsUsadas = [];
    for (var i = 0; i < n; i++) {
      var idx = Math.floor(rnd() * pool.length);
      varsUsadas.push(pool.splice(idx, 1)[0]);
    }
    var descripciones = {};
    varsUsadas.forEach(function (v) {
      descripciones[v] = G.DESCRIPCIONES_POOL[Math.floor(rnd() * G.DESCRIPCIONES_POOL.length)];
    });

    var ast;
    if (n === 1 && rnd() < 0.5) {
      ast = new LP.AtomNode(varsUsadas[0]);
      if (rnd() < 0.3) ast = new LP.NegNode(ast);
    } else {
      ast = fbfAleatoria(varsUsadas, 1 + Math.floor(rnd() * 2), rnd);
    }
    if (rnd() < 0.25) ast = new LP.NegNode(ast);

    var libres = [];
    var usadas = {};
    varsUsadas.forEach(function (v) { usadas[v] = true; });
    libres = G.ATOMOS_POOL.filter(function (s) { return !usadas[s]; });
    if (libres.length && rnd() < 0.25) {
      var extra = libres[Math.floor(rnd() * libres.length)];
      descripciones[extra] = G.DESCRIPCIONES_POOL[Math.floor(rnd() * G.DESCRIPCIONES_POOL.length)];
      ast = new LP.BinNode(OPERADORES_BINARIOS[Math.floor(rnd() * OPERADORES_BINARIOS.length)], ast, new LP.AtomNode(extra));
    }

    return {
      formula: LP.aCadena(ast),
      descripciones: descripciones,
      lectura: LP.renderEs(ast, descripciones),
    };
  };


  G.generarInstancia = function (categoria, rnd) {
    var ast = generarForma(categoria, rnd);
    var cls = S.clasificar(ast);
    var indices = { Tautología: "tautologia", "Contradicción": "contradiccion", Contingencia: "contingencia" };
    var texto = LP.aCadena(ast);
    return { formula: texto, clase: cls.clase, target: indices[cls.clase] };
  };

  G.generarDataset = function (nObjetivo, semilla) {
    nObjetivo = nObjetivo || 1500;
    var rnd = G.alea(semilla == null ? 42 : semilla);
    var cuotas = {
      tautologia: Math.floor(nObjetivo / 3),
      contradiccion: Math.floor(nObjetivo / 3),
      contingencia: nObjetivo - 2 * Math.floor(nObjetivo / 3),
    };

    var acumulado = { tautologia: [], contradiccion: [], contingencia: [] };
    var claves = Object.keys(cuotas);
    var mapeo = { Tautología: "tautologia", "Contradicción": "contradiccion", Contingencia: "contingencia" };

    var intentos = 0;
    while (acumulado.tautologia.length < cuotas.tautologia ||
           acumulado.contradiccion.length < cuotas.contradiccion ||
           acumulado.contingencia.length < cuotas.contingencia) {
      intentos++;
      if (intentos > 50000) break;
      var categoria = claves[Math.floor(rnd() * claves.length)];
      var instancia = G.generarInstancia(categoria, rnd);
      var clave = mapeo[instancia.clase] || "contingencia";
      if (acumulado[clave].length < cuotas[clave]) acumulado[clave].push(instancia);
    }

    var resultado = [];
    Object.keys(acumulado).forEach(function (k) { resultado = resultado.concat(acumulado[k]); });

    for (var j = resultado.length - 1; j > 0; j--) {
      var r = Math.floor(rnd() * (j + 1));
      var tmp = resultado[j]; resultado[j] = resultado[r]; resultado[r] = tmp;
    }
    return resultado;
  };

  G.resumenDataset = function (datos) {
    var conteo = { Tautología: 0, "Contradicción": 0, Contingencia: 0 };
    datos.forEach(function (d) { if (conteo.hasOwnProperty(d.clase)) conteo[d.clase]++; });
    return conteo;
  };

  window.Generador = G;
})();