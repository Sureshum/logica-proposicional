/* =========================================================================
   ml/nlp.py → JavaScript
   Traducción de lenguaje natural (español) a FBF simbólica mediante reglas.
   ========================================================================= */
"use strict";

(function () {
  var LP = window.LogicaParser;
  var N = {};

  var ATOMO_RE = /^[a-z][a-z0-9]*$/i;
  var ASIGNACION_RE = /([A-Za-z0-9_]+)\s*[:=]\s*([^,;\n]+)/g;

  function sinAcentos(texto) {
    return String(texto).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function parsearAsignaciones(texto) {
    var resultado = {};
    if (!texto) return resultado;
    var m;
    ASIGNACION_RE.lastIndex = 0;
    while ((m = ASIGNACION_RE.exec(texto)) !== null) {
      var simbolo = m[1].trim();
      var desc = sinAcentos(m[2].trim()).replace(/[ .]+$/g, "");
      if (!ATOMO_RE.test(simbolo)) continue;
      resultado[simbolo] = desc;
    }
    return resultado;
  }

  function mapaDescASimbolo(simbolos) {
    var mapa = [];
    Object.keys(simbolos).forEach(function (s) {
      var desc = sinAcentos(simbolos[s]);
      desc.split("/").forEach(function (sn) {
        sn = sn.trim();
        if (sn) mapa.push([sn, s]);
      });
    });
    mapa.sort(function (a, b) { return b[0].length - a[0].length; });
    return mapa;
  }

  function sustituirDescripciones(oracion, simbolos) {
    mapaDescASimbolo(simbolos).forEach(function (par) {
      var desc = par[0], simbolo = par[1];
      var re = new RegExp("(?<![a-z])" + desc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z])", "g");
      oracion = oracion.replace(re, " " + simbolo + " ");
    });
    return oracion;
  }

  function quitarNoValidos(oracion) {
    var permitidos = "abcdefghijklmnopqrstuvwxyz0123456789 ()¬∧∨→↔";
    var out = "";
    for (var i = 0; i < oracion.length; i++) {
      if (permitidos.indexOf(oracion[i]) !== -1) out += oracion[i];
    }
    return out;
  }

  function buscarFueraParens(oracion, token) {
    var prof = 0;
    for (var i = 0; i < oracion.length; i++) {
      var c = oracion[i];
      if (c === "(") prof++;
      else if (c === ")") prof = Math.max(0, prof - 1);
      else if (prof === 0 && oracion.startsWith(token, i) &&
               (i === 0 || oracion[i - 1].charAt(0).match(/\s/)) &&
               (i + token.length >= oracion.length || oracion[i + token.length].charAt(0).match(/\s/))) {
        return i;
      }
    }
    return -1;
  }

  function dividir(oracion, token) {
    var pos = buscarFueraParens(oracion, token);
    if (pos < 0) return null;
    return [oracion.slice(0, pos).trim(), oracion.slice(pos + token.length).trim()];
  }

  function balanceada(oracion) {
    if (oracion.split("(").length - 1 !== oracion.split(")").length - 1) return false;
    return !/\)\s*\(/.test(oracion.replace(/ /g, ""));
  }

  function esAtomoValido(pieza) { return ATOMO_RE.test(pieza); }

  function traducir(oracion) {
    oracion = oracion.replace(/\s+/g, " ").trim();
    if (!oracion) throw new LP.FBFError("No se encontró contenido para traducir.");

    // 1. Paréntesis explícitos.
    if (oracion.charAt(0) === "(" && oracion.charAt(oracion.length - 1) === ")" && balanceada(oracion)) {
      return "(" + traducir(oracion.slice(1, -1)) + ")";
    }

    // 2. Bicondicional: "p si y solo si q".
    var pieza = dividir(oracion, "↔");
    if (pieza) return "(" + traducir(pieza[0]) + " ↔ " + traducir(pieza[1]) + ")";

    // 3. Condicional: "si A entonces B".
    var m = oracion.match(/^si\s+(.+?)\s+entonces\s+(.+)$/);
    if (m) return "(" + traducir(m[1]) + " → " + traducir(m[2]) + ")";

    // 3b. Condicional ya materializado.
    pieza = dividir(oracion, "→");
    if (pieza) return "(" + traducir(pieza[0]) + " → " + traducir(pieza[1]) + ")";

    // 4. Disyunción.
    pieza = dividir(oracion, "∨");
    if (pieza) return "(" + traducir(pieza[0]) + " ∨ " + traducir(pieza[1]) + ")";

    // 5. Conjunción.
    pieza = dividir(oracion, "∧");
    if (pieza) return "(" + traducir(pieza[0]) + " ∧ " + traducir(pieza[1]) + ")";

    // 6. Negación: "no A".
    if (oracion.startsWith("no ")) return "(¬ " + traducir(oracion.slice(3)) + ")";

    // 7. Caso base: variable.
    if (esAtomoValido(oracion)) return oracion;

    var sobrantes = oracion.split(/\s+/).filter(function (t) { return !esAtomoValido(t); });
    throw new LP.FBFError(
      "Término(s) no reconocidos en la oración: " + sobrantes.join(", ") +
      ". Decláralos en las asignaciones (ej. p: Llueve)."
    );
  }

  function oracionAFbf(oracion, simbolos) {
    var texto = sinAcentos(oracion || "");
    texto = sustituirDescripciones(texto, simbolos);

    texto = texto.replace(/\bsi y solo si\b/g, " ↔ ");
    texto = texto.replace(/^(.+?)\s+solo\s+si\s+(.+)$/g, "($1 → $2)");
    texto = texto.replace(/\by\b/g, " ∧ ");
    texto = texto.replace(/\bo\b/g, " ∨ ");

    texto = quitarNoValidos(texto).trim();
    if (!texto) throw new LP.FBFError("La oración quedó vacía tras la normalización.");

    var fbf = traducir(texto.replace(/[ .]+$/g, ""));
    LP.parsear(fbf); // validación final con el parser real
    return fbf;
  }

  N.sinAcentos = sinAcentos;
  N.parsearAsignaciones = parsearAsignaciones;
  N.oracionAFbf = oracionAFbf;

  window.Nlp = N;
})();