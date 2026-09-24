/* =========================================================================
   logica/parser.py → JavaScript
   Parser descendente recursivo de Fórmulas Bien Formadas (FBF).
   Convierte texto en un AST (AtomNode / NegNode / BinNode).
   ========================================================================= */
"use strict";

(function () {
  var LP = {};

  var SIMBOLOS = { neg: "¬", conj: "∧", disj: "∨", impl: "→", bicond: "↔" };

  var NOMBRE_OPERADORES = {
    "¬": function (x) { return "no " + x; },
    "∧": function (x, y) { return "(" + x + " y " + y + ")"; },
    "∨": function (x, y) { return "(" + x + " o " + y + ")"; },
    "→": function (x, y) { return "(si " + x + " entonces " + y + ")"; },
    "↔": function (x, y) { return "(" + x + " si y solo si " + y + ")"; },
  };

  var ALIASES = [
    ["<=>", "↔"], ["=>", "→"], ["->", "→"], ["-->", "→"],
    ["&&", "∧"], ["||", "∨"], ["&", "∧"], ["|", "∨"],
    ["~", "¬"], ["!", "¬"], ["^", "∧"], [">", "→"],
  ];

  function FBFError(mensaje) {
    this.message = mensaje;
    this.name = "FBFError";
  }
  FBFError.prototype = Object.create(Error.prototype);
  FBFError.prototype.constructor = FBFError;

  // ------------------------- Nodos del AST -------------------------
  function AtomNode(nombre) { this.nombre = nombre; }
  function NegNode(hijo) { this.hijo = hijo; }
  function BinNode(op, izq, der) { this.op = op; this.izq = izq; this.der = der; }

  var ATOMO_RE = /^[a-z][a-zA-Z0-9]*/i;
  var OPERADORES = { "¬": true, "∧": true, "∨": true, "→": true, "↔": true };

  function canonicalizar(texto) {
    for (var i = 0; i < ALIASES.length; i++) {
      texto = texto.split(ALIASES[i][0]).join(ALIASES[i][1]);
    }
    return texto;
  }

  function tokenizar(texto) {
    var tokens = [];
    var i = 0;
    while (i < texto.length) {
      var c = texto[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "(" || c === ")") { tokens.push(["PAREN", c]); i++; continue; }
      if (OPERADORES[c]) { tokens.push(["OP", c]); i++; continue; }
      var m = ATOMO_RE.exec(texto.slice(i));
      if (m) { tokens.push(["ATOM", m[0]]); i += m[0].length; continue; }
      throw new FBFError(
        "Símbolo no reconocido: '" + c + "' (posición " + (i + 1) +
        "). Use letras a-z, conectivos [∧, ∨, →, ↔, ¬] y paréntesis."
      );
    }
    return tokens;
  }

  // --------------------- Parser descendente recursivo ---------------------
  function Parser(tokens) {
    this.t = tokens;
    this.pos = 0;
  }
  Parser.prototype.actual = function () {
    return this.pos < this.t.length ? this.t[this.pos] : null;
  };
  Parser.prototype.avanzar = function () {
    var tok = this.actual();
    if (!tok) throw new FBFError("Fórmula incompleta: falta un operando o un cierre de paréntesis.");
    this.pos++;
    return tok;
  };
  Parser.prototype.esperar = function (v) {
    var tok = this.actual();
    if (!tok || tok[1] !== v) {
      throw new FBFError("Se esperaba '" + v + "' pero se encontró " + (tok ? "'" + tok[1] + "'" : "fin de fórmula") + ".");
    }
    this.pos++;
  };
  Parser.prototype.fbf = function () { return this.bicond(); };
  Parser.prototype.bicond = function () {
    var n = this.cond();
    while (this.actual() && this.actual()[1] === "↔") { this.avanzar(); n = new BinNode("↔", n, this.cond()); }
    return n;
  };
  Parser.prototype.cond = function () {
    var n = this.disj();
    while (this.actual() && this.actual()[1] === "→") { this.avanzar(); n = new BinNode("→", n, this.disj()); }
    return n;
  };
  Parser.prototype.disj = function () {
    var n = this.conj();
    while (this.actual() && this.actual()[1] === "∨") { this.avanzar(); n = new BinNode("∨", n, this.conj()); }
    return n;
  };
  Parser.prototype.conj = function () {
    var n = this.neg();
    while (this.actual() && this.actual()[1] === "∧") { this.avanzar(); n = new BinNode("∧", n, this.neg()); }
    return n;
  };
  Parser.prototype.neg = function () {
    var veces = 0;
    while (this.actual() && this.actual()[1] === "¬") { this.avanzar(); veces++; }
    var n = this.primario();
    for (var i = 0; i < veces; i++) n = new NegNode(n);
    return n;
  };
  Parser.prototype.primario = function () {
    var tok = this.actual();
    if (!tok) throw new FBFError("Fórmula vacía o incompleta.");
    if (tok[0] === "PAREN" && tok[1] === "(") {
      this.avanzar();
      var n = this.fbf();
      this.esperar(")");
      return n;
    }
    if (tok[0] === "ATOM") { this.avanzar(); return new AtomNode(tok[1]); }
    if (tok[0] === "OP") throw new FBFError("Conectivo '" + tok[1] + "' sin operando a la izquierda.");
    throw new FBFError("Token inesperado: '" + tok[1] + "'.");
  };

  function parsear(texto) {
    if (!texto || !texto.trim()) throw new FBFError("La fórmula está vacía.");
    var p = new Parser(tokenizar(canonicalizar(texto)));
    var arbol = p.fbf();
    if (p.actual() !== null) {
      throw new FBFError("Contenido no esperado después de la fórmula: '" + p.actual()[1] + "'.");
    }
    return arbol;
  }

  function esFbf(texto) {
    try { parsear(texto); return true; } catch (e) { return false; }
  }

  // ------------------------- Serialización -------------------------
  function cadenaInterna(n) {
    if (n instanceof AtomNode) return n.nombre;
    if (n instanceof NegNode) {
      var interior = cadenaInterna(n.hijo);
      if (n.hijo instanceof AtomNode) return "¬" + interior;
      if (interior.charAt(0) === "(" && interior.charAt(interior.length - 1) === ")") return "¬" + interior;
      return "¬(" + interior + ")";
    }
    return "(" + cadenaInterna(n.izq) + " " + n.op + " " + cadenaInterna(n.der) + ")";
  }

  function parensRecubren(t) {
    var prof = 0;
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (c === "(") prof++;
      else if (c === ")") { prof--; if (prof === 0) return i === t.length - 1; }
    }
    return false;
  }

  function aCadena(n) {
    var texto = cadenaInterna(n);
    if (n instanceof BinNode && parensRecubren(texto)) return texto.slice(1, -1);
    return texto;
  }

  function hijos(n) {
    if (n instanceof AtomNode) return [];
    if (n instanceof NegNode) return [n.hijo];
    return [n.izq, n.der];
  }

  function atomos(n) {
    var vistos = [];
    function rec(x) {
      var hs = hijos(x);
      for (var i = 0; i < hs.length; i++) rec(hs[i]);
      if (x instanceof AtomNode && vistos.indexOf(x.nombre) === -1) vistos.push(x.nombre);
    }
    rec(n);
    return vistos;
  }

  function profundidad(n) {
    if (n instanceof AtomNode) return 0;
    var max = 0;
    hijos(n).forEach(function (h) { max = Math.max(max, profundidad(h)); });
    return 1 + max;
  }

  function contarNodos(n) {
    var total = 1;
    hijos(n).forEach(function (h) { total += contarNodos(h); });
    return total;
  }

  // ------------------------- Lectura en español -------------------------
  function renderEs(n, nombres) {
    nombres = nombres || {};
    if (n instanceof AtomNode) return nombres.hasOwnProperty(n.nombre) ? nombres[n.nombre] : n.nombre;
    if (n instanceof NegNode) return NOMBRE_OPERADORES["¬"](renderEs(n.hijo, nombres));
    return NOMBRE_OPERADORES[n.op](renderEs(n.izq, nombres), renderEs(n.der, nombres));
  }

  // ------------------------- HTML del árbol -------------------------
  function escapa(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function arbolHtml(n) {
    var label = escapa(aCadena(n));
    if (n instanceof AtomNode) return '<li class="nodo atom">' + label + "</li>";
    var inner = hijos(n).map(arbolHtml).join("");
    var clase = n instanceof NegNode ? "nodo neg" : "nodo binario";
    return '<li class="' + clase + '"><span>' + label + "</span><ul>" + inner + "</ul></li>";
  }

  LP.AtomNode = AtomNode;
  LP.NegNode = NegNode;
  LP.BinNode = BinNode;
  LP.FBFError = FBFError;
  LP.parsear = parsear;
  LP.esFbf = esFbf;
  LP.aCadena = aCadena;
  LP.atomos = atomos;
  LP.hijos = hijos;
  LP.profundidad = profundidad;
  LP.contarNodos = contarNodos;
  LP.renderEs = renderEs;
  LP.arbolHtml = arbolHtml;
  LP.escapar = escapa;

  window.LogicaParser = LP;
})();