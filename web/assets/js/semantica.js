/* =========================================================================
   logica/semantica.py → JavaScript
   Evaluación semántica: tablas de verdad y clasificación
   (Tautología / Contradicción / Contingencia).
   ========================================================================= */
"use strict";

(function () {
  var LP = window.LogicaParser;
  var S = {};

  S.TAUTOLOGIA = "Tautología";
  S.CONTRADICCION = "Contradicción";
  S.CONTINGENCIA = "Contingencia";
  S.MAX_ATOMOS_TABLA = 5;

  function evaluar(n, asg) {
    if (n instanceof LP.AtomNode) return !!asg[n.nombre];
    if (n instanceof LP.NegNode) return !evaluar(n.hijo, asg);
    var izq = evaluar(n.izq, asg);
    var der = evaluar(n.der, asg);
    switch (n.op) {
      case "∧": return izq && der;
      case "∨": return izq || der;
      case "→": return (!izq) || der; // el condicional solo falla con V→F
      case "↔": return izq === der;
    }
    throw new Error("Operador desconocido: " + n.op);
  }

  // Combinaciones de valores: mismo orden que itertools.product (V...V → F...F).
  function combinaciones(atoms) {
    var filas = [];
    var total = Math.pow(2, atoms.length);
    for (var mask = 0; mask < total; mask++) {
      var val = total - 1 - mask;
      var asg = {};
      for (var j = 0; j < atoms.length; j++) {
        asg[atoms[j]] = !!((val >> (atoms.length - 1 - j)) & 1);
      }
      filas.push(asg);
    }
    return filas;
  }

  function tablaVerdad(n) {
    var vars_ = LP.atomos(n);
    var nv = vars_.length;
    var datos = { atoms: vars_, filas: [], valores: [], excede_limite: nv > S.MAX_ATOMOS_TABLA };
    if (datos.excede_limite) return datos;
    combinaciones(vars_).forEach(function (asg) {
      datos.filas.push(asg);
      datos.valores.push(evaluar(n, asg));
    });
    return datos;
  }

  function subexpresiones(n) {
    var resultado = [n];
    LP.hijos(n).forEach(function (h) { resultado = resultado.concat(subexpresiones(h)); });
    return resultado;
  }

  function tablaVerdadCompleta(n) {
    var vars_ = LP.atomos(n);
    var subnodos = subexpresiones(n);
    var columnas = [];
    subnodos.forEach(function (sub) {
      var t = LP.aCadena(sub);
      if (columnas.indexOf(t) === -1) columnas.push(t);
    });
    var total = vars_.length;
    if (total > S.MAX_ATOMOS_TABLA) return { columnas: columnas, filas: [], excede_limite: true };

    var filas = [];
    combinaciones(vars_).forEach(function (asg) {
      var fila = {};
      subnodos.forEach(function (sub) {
        var t = LP.aCadena(sub);
        fila[t] = evaluar(sub, asg) ? "V" : "F";
      });
      filas.push(fila);
    });
    return { columnas: columnas, filas: filas, excede_limite: false };
  }

  function clasificar(n) {
    var tabla = tablaVerdad(n);
    var valores = tabla.valores;
    var canon = LP.aCadena(n);

    if (tabla.excede_limite) {
      return {
        canonical: canon,
        clase: "No determinable" + " (>" + S.MAX_ATOMOS_TABLA + " átomos: " + tabla.atoms.length + ")",
        verdaderos: null,
        falsos: null,
      };
    }

    var verdaderos = 0;
    valores.forEach(function (v) { if (v) verdaderos++; });
    var falsos = valores.length - verdaderos;
    var clase;
    if (falsos === 0) clase = S.TAUTOLOGIA;
    else if (verdaderos === 0) clase = S.CONTRADICCION;
    else clase = S.CONTINGENCIA;

    return { canonical: canon, clase: clase, verdaderos: verdaderos, falsos: falsos };
  }

  function tablaHtml(datos) {
    var columnas = datos.columnas;
    var filas = datos.filas || [];
    if (datos.excede_limite) {
      return '<p class="aviso">La tabla tendría 2^' + columnas.length +
             " filas; se omite por superar el límite de trabajabilidad.</p>";
    }
    var th = columnas.map(function (c) { return "<th>" + LP.escapar(c) + "</th>"; }).join("");
    var cuerpo = filas.map(function (fila) {
      var tds = columnas.map(function (c) { return "<td>" + LP.escapar(fila[c]) + "</td>"; }).join("");
      return "<tr>" + tds + "</tr>";
    }).join("");
    return '<table class="tabla-verdad"><thead><tr>' + th + "</tr></thead><tbody>" + cuerpo + "</tbody></table>";
  }

  S.evaluar = evaluar;
  S.tablaVerdad = tablaVerdad;
  S.tablaVerdadCompleta = tablaVerdadCompleta;
  S.clasificar = clasificar;
  S.tablaHtml = tablaHtml;

  window.Semantica = S;
})();