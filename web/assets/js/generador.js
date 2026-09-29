
"use strict";

(function () {
  var LP = window.LogicaParser;
  var S = window.Semantica;
  var G = {};

  G.ATOMOS_POOL = ["p", "q", "r", "s", "t"];

  G.ORDEN_SIMBOLOS = ["p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];

  G.TEMAS = [
    {
      id: "clima",
      etiqueta: "el clima",
      textos: ["llueve", "nieva", "hace frío", "hace calor", "hay viento",
               "está nublado", "hay neblina", "truena"],
    },
    {
      id: "estudio",
      etiqueta: "el estudio",
      textos: ["estudio", "hago la tarea", "apruebo el examen", "tengo dudas",
               "repaso", "voy a la biblioteca", "entrego el trabajo", "uso el móvil"],
    },
    {
      id: "rutina",
      etiqueta: "la rutina diaria",
      textos: ["duermo", "despierto temprano", "como bien", "hago ejercicio",
               "descanso", "salgo a tiempo", "tomo café", "me acuesto tarde"],
    },
    {
      id: "ocio",
      etiqueta: "el ocio",
      textos: ["corro", "bailo", "canto", "leo", "miro televisión",
               "viajo", "juego al fútbol", "cocino"],
    },
    {
      id: "clase",
      etiqueta: "la clase",
      textos: ["estoy atento", "participo en clase", "tengo prisa",
               "el profesor explica", "hago preguntas", "me aburro",
               "llego tarde", "tomo apuntes"],
    },
    {
      id: "salud",
      etiqueta: "la salud",
      textos: ["tengo sueño", "tengo buena salud", "bebo agua", "estoy relajado",
               "tengo fiebre", "sigo la dieta", "me cuido la espalda", "respiro bien"],
    },
  ];

  G.DESCRIPCIONES_POOL = G.TEMAS.reduce(function (acc, t) {
    return acc.concat(t.textos);
  }, []);

  var OPERADORES_BINARIOS = ["∧", "∨", "→", "↔"];

  G.CONECTORES_FRASE = ["y", "o", "u", "e", "ni", "no", "si", "entonces", "solo", "sii"];

  G.normalizarTexto = function (texto) {
    return String(texto == null ? "" : texto)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9ñ ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  G.simboloLibre = function (simbolosUsados) {
    var visto = {};
    (simbolosUsados || []).forEach(function (s) { visto[String(s).trim().toLowerCase()] = true; });
    for (var i = 0; i < G.ORDEN_SIMBOLOS.length; i++) {
      if (!visto[G.ORDEN_SIMBOLOS[i]]) return G.ORDEN_SIMBOLOS[i];
    }
    for (var n = 1; n < 2000; n++) {
      if (!visto["p" + n]) return "p" + n;
    }
    return "p" + Date.now();
  };

  G.temasConTextosLibres = function (textosUsados) {
    var usados = {};
    (textosUsados || []).forEach(function (t) { usados[G.normalizarTexto(t)] = true; });
    return G.TEMAS.map(function (tema) {
      return {
        id: tema.id,
        etiqueta: tema.etiqueta,
        libres: tema.textos.filter(function (t) { return !usados[G.normalizarTexto(t)]; }),
        total: tema.textos.length,
      };
    });
  };

  G.elegirTema = function (textosUsados, temaForzado, rnd) {
    rnd = rnd || Math.random;
    var candidatos = G.temasConTextosLibres(textosUsados);
    var conLibres = candidatos.filter(function (c) { return c.libres.length > 0; });
    if (!conLibres.length) {
      var todos = G.TEMAS[Math.floor(rnd() * G.TEMAS.length)];
      return { id: todos.id, etiqueta: todos.etiqueta, textos: todos.textos.slice(), recycles: true };
    }
    var elegido = null;
    if (temaForzado) {
      elegido = conLibres.filter(function (c) { return c.id === temaForzado; })[0] || null;
    }
    if (!elegido) elegido = conLibres[Math.floor(rnd() * conLibres.length)];
    return { id: elegido.id, etiqueta: elegido.etiqueta, textos: elegido.libres.slice(), recycles: false };
  };

  function barajar(lista, rnd) {
    var out = lista.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var r = Math.floor(rnd() * (i + 1));
      var tmp = out[i]; out[i] = out[r]; out[r] = tmp;
    }
    return out;
  }

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


  function sinDobleNegacion(nodo) {
    while (nodo instanceof LP.NegNode && nodo.hijo instanceof LP.NegNode) nodo = nodo.hijo;
    if (nodo instanceof LP.NegNode) return new LP.NegNode(sinDobleNegacion(nodo.hijo));
    if (nodo instanceof LP.BinNode) {
      return new LP.BinNode(nodo.op, sinDobleNegacion(nodo.izq), sinDobleNegacion(nodo.der));
    }
    return nodo;
  }

  function inspeccionar(nodo) {
    if (nodo instanceof LP.NegNode) {
      if (nodo.hijo instanceof LP.NegNode) return { valido: false };
      var dentro = inspeccionar(nodo.hijo);
      return dentro.valido ? dentro : { valido: false };
    }
    if (nodo instanceof LP.BinNode) {
      var izq = inspeccionar(nodo.izq);
      var der = inspeccionar(nodo.der);
      if (!izq.valido || !der.valido) return { valido: false };
      if (LP.aCadena(nodo.izq) === LP.aCadena(nodo.der)) return { valido: false };
      return { valido: true };
    }
    return { valido: true };
  }

  function construirInteresante(varsUsadas, rnd, opciones) {
    var profundidad = opciones.profundidad || (rnd() < 0.4 ? 3 : 2);
    var ast = fbfAleatoria(varsUsadas, profundidad, rnd);
    for (var intento = 0; intento < 60; intento++) {
      var distintos = {};
      LP.atomos(ast).forEach(function (a) { distintos[a] = true; });
      var comodo = Object.keys(distintos).length >= 2 &&
                   LP.profundidad(ast) >= 2 && inspeccionar(ast).valido;
      if (comodo) break;
      ast = fbfAleatoria(varsUsadas, profundidad, rnd);
    }
    if (opciones.negacion !== false && rnd() < 0.25) ast = new LP.NegNode(ast);
    return sinDobleNegacion(ast);
  }


  G.proposicionCoherente = function (opciones) {
    opciones = opciones || {};
    var rnd = opciones.rnd || Math.random;
    var usados = (opciones.simbolosUsados || []).slice();
    var tema = G.elegirTema(opciones.textosUsados, opciones.tema, rnd);

    var candidatos = barajar(tema.textos, rnd);
    var cuantos = Math.min(candidatos.length, opciones.cuantosTextos || (rnd() < 0.55 ? 2 : 3));

    var descripciones = {};
    for (var i = 0; i < cuantos; i++) {
      var simbolo = G.simboloLibre(usados);
      usados.push(simbolo);
      descripciones[simbolo] = candidatos[i];
    }

    var varsUsadas = Object.keys(descripciones);
    var ast = construirInteresante(varsUsadas, rnd, opciones);

    var presentes = {};
    LP.atomos(ast).forEach(function (a) { presentes[a] = true; });
    var final = {};
    var simbolosFinales = [];
    varsUsadas.forEach(function (s) {
      if (!presentes[s]) return;
      final[s] = descripciones[s];
      simbolosFinales.push(s);
    });

    return {
      formula: LP.aCadena(ast),
      descripciones: final,
      lectura: LP.renderEs(ast, final),
      tema: tema.id,
      etiquetaTema: tema.etiqueta,
      atomos: simbolosFinales,
      recicla: !!tema.recycles,
    };
  };


  G.buscarTemaDeTexto = function (texto) {
    var clave = G.normalizarTexto(texto);
    for (var i = 0; i < G.TEMAS.length; i++) {
      for (var j = 0; j < G.TEMAS[i].textos.length; j++) {
        if (G.normalizarTexto(G.TEMAS[i].textos[j]) === clave) return G.TEMAS[i];
      }
    }
    return null;
  };


  G.CONECTORES_FRASE = ["y", "o", "u", "e", "ni", "no", "si", "entonces", "solo", "sii"];

  G.significadosDesdeFrase = function (frase, opciones) {
    opciones = opciones || {};
    var usados = (opciones.simbolosUsados || []).slice();

    var bruto = String(frase == null ? "" : frase)
      .replace(/[,;:]+/g, " y ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    var originales = bruto ? bruto.split(" ") : [];
    var palabras = originales.map(G.normalizarTexto);

    var indice = {};
    G.TEMAS.forEach(function (tema) {
      tema.textos.forEach(function (texto) { indice[G.normalizarTexto(texto)] = texto; });
    });
    var conectores = {};
    G.CONECTORES_FRASE.forEach(function (c) { conectores[c] = true; });
    var determinantes = {};
    ["el", "la", "los", "las", "un", "una", "unos", "unas", "mis", "tus",
     "su", "sus", "de", "del", "al"].forEach(function (d) { determinantes[d] = true; });

    var grupos = [];
    var actual = [];
    for (var i = 0; i < palabras.length; i++) {
      if (conectores[palabras[i]]) {
        if (actual.length) grupos.push(actual);
        actual = [];
      } else {
        actual.push(i);
      }
    }
    if (actual.length) grupos.push(actual);

    var descripciones = {};
    var temasUsados = [];
    var propios = [];

    grupos.forEach(function (indices) {
      var gramaCompleta = indices.map(function (k) { return palabras[k]; }).join(" ");
      var mejor = indice[gramaCompleta]
        ? { texto: indice[gramaCompleta], propio: false }
        : null;
      if (!mejor) {
          var ini = 0;
        while (ini < indices.length - 1 && determinantes[palabras[indices[ini]]]) ini++;
        mejor = {
          texto: indices.slice(ini).map(function (k) { return originales[k]; }).join(" "),
          propio: true,
        };
      }
      if (!mejor.texto) return;

      var simbolo = G.simboloLibre(usados);
      usados.push(simbolo);
      descripciones[simbolo] = mejor.texto;
      if (mejor.propio) {
        propios.push(simbolo);
      } else {
        var tema = G.buscarTemaDeTexto(mejor.texto);
        if (tema && temasUsados.indexOf(tema.id) === -1) temasUsados.push(tema.id);
      }
    });

    var etiquetas = temasUsados.map(function (id) {
      var t = G.TEMAS.filter(function (x) { return x.id === id; })[0];
      return t ? t.etiqueta : id;
    });

    return {
      descripciones: descripciones,
      simbolos: Object.keys(descripciones),
      temas: temasUsados,
      etiquetasTema: etiquetas,
      propios: propios,
    };
  };


  G.proposicionAleatoria = function (simbolosPermitidos, rnd) {
    return G.proposicionCoherente({ simbolosUsados: [], rnd: rnd });
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