
"use strict";

(function () {
  var LP = window.LogicaParser;
  var G = window.Generador;
  var ML = {};

  var OPERADORES = ["∧", "∨", "→", "↔"];
  ML.NOMBRES_CARACTERISTICAS = [
    "num_variables", "num_variables_distintas", "num_negaciones",
    "num_conjunciones", "num_disyunciones", "num_condicionales",
    "num_bicondicionales", "profundidad_maxima", "total_nodos",
    "total_tokens", "parejas_complementarias", "ratio_negaciones",
  ];

  ML.CLASES = ["Contradicción", "Contingencia", "Tautología"];
  ML.CLASE_A_INDICE = { "Contradicción": 0, "Contingencia": 1, "Tautología": 2 };
  ML.FRACCION_PRUEBA = 0.2;
  ML.NO_DEFECTO = 1000;


  function conteoOperadores(n) {
    var conteo = { "¬": 0, "∧": 0, "∨": 0, "→": 0, "↔": 0 };
    function rec(x) {
      if (x instanceof LP.NegNode) { conteo["¬"]++; rec(x.hijo); }
      else if (x instanceof LP.BinNode) {
        conteo[x.op] = (conteo[x.op] || 0) + 1;
        rec(x.izq); rec(x.der);
      }
    }
    rec(n);
    return conteo;
  }

  function parejasComplementarias(n) {
    var negadas = {}, noNegadas = {};
    function rec(x, bajoNegacion) {
      if (x instanceof LP.AtomNode) {
        (bajoNegacion ? negadas : noNegadas)[x.nombre] = true;
      } else if (x instanceof LP.NegNode) {
        rec(x.hijo, !bajoNegacion);
      } else {
        rec(x.izq, bajoNegacion); rec(x.der, bajoNegacion);
      }
    }
    rec(n, false);
    var cuenta = 0;
    Object.keys(negadas).forEach(function (k) { if (noNegadas[k]) cuenta++; });
    return cuenta;
  }

  function conteoParens(n) {
    function rec(x) {
      if (x instanceof LP.AtomNode) return 0;
      if (x instanceof LP.NegNode) {
        return ((x.hijo instanceof LP.AtomNode || x.hijo instanceof LP.NegNode) ? 0 : 1) + rec(x.hijo);
      }
      return 1 + rec(x.izq) + rec(x.der);
    }
    return rec(n);
  }

  function longitudTexto(n) {
    return LP.contarNodos(n) + 2 * conteoParens(n);
  }

  function extraerCaracteristicas(n) {
    var conteo = conteoOperadores(n);
    var vars_ = LP.atomos(n);
    var totalNodos = LP.contarNodos(n);
    return [
      vars_.length, new Set(vars_).size, conteo["¬"],
      conteo["∧"], conteo["∨"], conteo["→"], conteo["↔"],
      LP.profundidad(n), totalNodos, longitudTexto(n),
      parejasComplementarias(n), conteo["¬"] / Math.max(totalNodos, 1),
    ].map(Number);
  }


  function convertir(formulas) {
    var X = [], y = [];
    formulas.forEach(function (item) {
      var ast = LP.parsear(item.formula);
      X.push(extraerCaracteristicas(ast));
      y.push(ML.CLASE_A_INDICE[item.clase]);
    });
    return [X, y];
  }

  function construirDataset(n, semilla) {
    var datos = G.generarDataset(n, semilla);
    var rnd = G.alea(semilla == null ? 42 : semilla);
    var orden = [];
    for (var i = 0; i < datos.length; i++) orden.push(i);

    for (var j = orden.length - 1; j > 0; j--) {
      var r = Math.floor(rnd() * (j + 1));
      var tmp = orden[j]; orden[j] = orden[r]; orden[r] = tmp;
    }
    var corte = Math.floor(orden.length * ML.FRACCION_PRUEBA);
    var testIdx = orden.slice(0, corte).sort(function (a, b) { return a - b; });
    var trainIdx = orden.slice(corte).sort(function (a, b) { return a - b; });

    var train = trainIdx.map(function (i) { return datos[i]; });
    var test = testIdx.map(function (i) { return datos[i]; });

    var convT = convertir(train);
    var convTe = convertir(test);
    return {
      X_train: convT[0], y_train: convT[1],
      X_test: convTe[0], y_test: convTe[1],
      formulas_test: test.map(function (d) { return d.formula; }),
      formulas_entrenamiento: train.map(function (d) { return d.formula; }),
      distribucion: G.resumenDataset(datos),
      n_entrenamiento: train.length,
      n_prueba: test.length,
    };
  }


  function KNN(k) {
    this.k = k || 5;
    this.X = null;
    this.y = null;
    this.media = null;
    this.desv = null;
  }
  KNN.prototype.ajustar = function (X, y) {
    var self = this;
    this.y = y;
    var nCols = X[0].length;
    this.media = [];
    this.desv = [];
    for (var c = 0; c < nCols; c++) {
      var suma = 0;
      X.forEach(function (f) { suma += f[c]; });
      var media = suma / X.length;
      var acum = 0;
      X.forEach(function (f) { var d = f[c] - media; acum += d * d; });
      var desv = Math.sqrt(acum / X.length) || 1.0;
      this.media.push(media);
      this.desv.push(desv);
    }
    this.X = X.map(function (f) { return self.normalizar(f); });
  };
  KNN.prototype.normalizar = function (vector) {
    var out = [];
    for (var i = 0; i < vector.length; i++) out.push((vector[i] - this.media[i]) / this.desv[i]);
    return out;
  };
  KNN.prototype.distancias = function (vector) {
    var v = this.normalizar(vector);
    var resultados = [];
    for (var j = 0; j < this.X.length; j++) {
      var dist = 0;
      for (var i = 0; i < v.length; i++) { var d = v[i] - this.X[j][i]; dist += d * d; }
      resultados.push([Math.sqrt(dist), j]);
    }
    resultados.sort(function (a, b) { return a[0] - b[0]; });
    return resultados;
  };
  KNN.prototype.predecirClase = function (vector) {
    var vecinos = this.distancias(vector).slice(0, this.k);
    var votos = { 0: 0, 1: 0, 2: 0 };
    vecinos.forEach(function (v) { votos[this.y[v[1]]]++; }.bind(this));
    var total = vecinos.length;
    var probs = {};
    Object.keys(votos).forEach(function (c) { probs[ML.CLASES[c]] = votos[c] / total; });
    var mejor = 0;
    Object.keys(votos).forEach(function (c) { if (votos[c] > votos[mejor]) mejor = +c; });
    return [ML.CLASES[mejor], probs, this.k];
  };


  function ModeloFBF() {
    this.modelo = null;
    this.nombre = "";
    this.metricas = {};
    this.data = null;
  }
  ModeloFBF.prototype.entrenar = function (data) {
    this.data = data;
    this.modelo = new KNN(5);
    this.modelo.ajustar(data.X_train, data.y_train);
    this.nombre = "k-NN (5 vecinos) — implementado en JavaScript, en el navegador";

    var self = this;
    var preds = data.X_test.map(function (f) { return self.predecirEtiqueta(f); });
    this.metricas = metricas(data.y_test, preds);
    this.metricas.n_entrenamiento = data.n_entrenamiento;
    this.metricas.n_prueba = data.n_prueba;
    this.metricas.algoritmo = this.nombre;
    this.metricas.distribucion_dataset = data.distribucion;
    return this.metricas;
  };
  ModeloFBF.prototype.predecirEtiqueta = function (vector) {
    var r = this.modelo.predecirClase(vector);
    return ML.CLASE_A_INDICE[r[0]];
  };
  ModeloFBF.prototype.predecirVector = function (vector) {
    var r = this.modelo.predecirClase(vector);
    return { clase: r[0], probabilidades: r[1], k: r[2] };
  };
  ModeloFBF.prototype.predecir = function (formula) {
    return this.predecirVector(extraerCaracteristicas(LP.parsear(formula)));
  };

  function metricas(yReal, yPred) {
    var total = yReal.length;
    var aciertos = 0;
    for (var i = 0; i < total; i++) if (yReal[i] === yPred[i]) aciertos++;
    var exactitud = total ? aciertos / total : 0;

    var n = ML.CLASES.length;
    var matriz = [];
    for (var r = 0; r < n; r++) { matriz.push([]); for (var c2 = 0; c2 < n; c2++) matriz[r].push(0); }
    for (i = 0; i < total; i++) matriz[yReal[i]][yPred[i]]++;

    var filas = [];
    for (var k2 = 0; k2 < n; k2++) {
      var vp = matriz[k2][k2];
      var totalReal = 0;
      for (var r2 = 0; r2 < n; r2++) totalReal += matriz[k2][r2];
      var totalPred = 0;
      for (var r3 = 0; r3 < n; r3++) totalPred += matriz[r3][k2];
      var precision = totalPred ? vp / totalPred : 0;
      var recall = totalReal ? vp / totalReal : 0;
      var f1 = (precision + recall) ? (2 * precision * recall / (precision + recall)) : 0;
      filas.push({
        clase: ML.CLASES[k2], vp: vp,
        precision: Math.round(precision * 1000) / 1000,
        recall: Math.round(recall * 1000) / 1000,
        f1: Math.round(f1 * 1000) / 1000,
      });
    }
    return {
      exactitud: Math.round(exactitud * 10000) / 10000,
      matriz: matriz,
      clases: ML.CLASES,
      por_clase: filas,
    };
  }


  var _modelo = null;

  function entrenar(n, semilla) {
    var data = construirDataset(n || ML.NO_DEFECTO, semilla == null ? 42 : semilla);
    _modelo = new ModeloFBF();
    return _modelo.entrenar(data);
  }

  function obtenerModelo() {
    if (_modelo === null) entrenar();
    return _modelo;
  }

  ML.entrenar = entrenar;
  ML.reentrenar = function (n) { return entrenar(n || ML.NO_DEFECTO); };
  ML.obtenerModelo = obtenerModelo;
  ML.predecir = function (formula) { return obtenerModelo().predecir(formula); };
  ML.info = function () {
    return { algoritmo: obtenerModelo().nombre, metricas: obtenerModelo().metricas };
  };
  ML.extraerCaracteristicas = extraerCaracteristicas;

  window.ML = ML;
})();