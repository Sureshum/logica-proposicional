# -*- coding: utf-8 -*-
"""Clasificador de FBF (Tautología / Contradicción / Contingencia).

Arquitectura / algoritmo
------------------------
El sistema intenta usar **Scikit-Learn (Random Forest)**, un ensamble de
árboles de decisión que aprende reglas no lineales a partir de las
características sintácticas de cada fórmula::

    X (características por fórmula)  ──►  RandomForestClassifier  ──►  clase

Si Scikit-Learn no está instalado en el entorno, se activa de forma
**transparente** un clasificador propio: **k-NN (k vecinos más cercanos)**
con normalización z-score. En ambos casos la interfaz pública es idéntica
(``entrenar``, ``predecir``, ``probabilidades``).
"""

from __future__ import annotations

import statistics
from typing import Optional

from .dataset import CLASES, CLASE_A_INDICE, construir_dataset
from .features import extraer_caracteristicas
from logica.parser import parsear

#: Intentamos cargar Scikit-Learn; si no está, usamos el fallback propio.
try:
    from sklearn.ensemble import RandomForestClassifier
    SKLEARN_DISPONIBLE = True
except ImportError:                                   # pragma: no cover
    RandomForestClassifier = None
    SKLEARN_DISPONIBLE = False


class _KNN:
    """Clasificador k-NN en Python puro (fallback sin dependencias)."""

    def __init__(self, k: int = 5):
        self.k = k
        self.X = None
        self.y = None
        self.media = None
        self.desv = None

    def ajustar(self, X, y):
        """Guarda los datos y calcula media/desviación para normalizar.

        IMPORTANTE: almacenamos las filas de entrenamiento *ya normalizadas*
        con la misma transformación z-score que después se aplica al vector
        de consulta; si no, las distancias compararían escalas distintas.
        """
        self.y = y
        n_cols = len(X[0])
        self.media = [statistics.mean(fila[i] for fila in X) for i in range(n_cols)]
        self.desv = [statistics.pstdev(fila[i] for fila in X) or 1.0 for i in range(n_cols)]
        self.X = [self._normalizar(fila) for fila in X]

    def _normalizar(self, vector):
        return [(v - m) / s for v, m, s in zip(vector, self.media, self.desv)]

    def _distancias(self, vector):
        v = self._normalizar(vector)
        resultados = []
        for j, fila in enumerate(self.X):
            distancia = sum((v[i] - fila[i]) ** 2 for i in range(len(v))) ** 0.5
            resultados.append((distancia, j))
        return sorted(resultados, key=lambda t: t[0])

    def predecir_clase(self, vector) -> tuple:
        """Devuelve ``(clase, probabilidades_dict, k_usado)``."""
        vecinos = self._distancias(vector)[: self.k]
        votos = {c: 0 for c in range(len(CLASES))}
        for _, j in vecinos:
            votos[self.y[j]] += 1
        total = sum(votos.values())
        probs = {CLASES[c]: votos[c] / total for c in votos}
        mejor = max(votos, key=votos.get)
        return CLASES[mejor], probs, self.k


class ModeloFBF:
    """Wrapper unificado: entrena/predece con sklearn o con el kNN propio."""

    def __init__(self):
        self.modelo = None
        self.nombre = ""
        self.metricas = {}
        self.data = None

    # ------------------------------------------------------------------ API
    def entrenar(self, data: dict) -> dict:
        """Entrena con el dataset dividido y calcula métricas de validación."""
        self.data = data
        Xtr, ytr = data["X_train"], data["y_train"]
        Xte, yte = data["X_test"], data["y_test"]

        if SKLEARN_DISPONIBLE:
            self.modelo = RandomForestClassifier(
                n_estimators=200, random_state=42, class_weight="balanced"
            )
            self.modelo.fit(Xtr, ytr)
            self.nombre = "Random Forest (Scikit-Learn, 200 árboles)"
        else:
            self.modelo = _KNN(k=5)
            self.modelo.ajustar(Xtr, ytr)
            self.nombre = "k-NN (5 vecinos) — fallback puro Python, sin Scikit-Learn"

        preds = [self._predecir_etiqueta(f) for f in Xte]
        self.metricas = _metricas(yte, preds)
        self.metricas["n_entrenamiento"] = len(Xtr)
        self.metricas["n_prueba"] = len(Xte)
        self.metricas["algoritmo"] = self.nombre
        self.metricas["distribucion_dataset"] = data["distribucion"]
        return self.metricas

    def _predecir_etiqueta(self, vector) -> int:
        """Índice de clase predicho para un vector de características."""
        if SKLEARN_DISPONIBLE:
            return int(self.modelo.predict([vector])[0])
        clase, _, _ = self.modelo.predecir_clase(vector)
        return CLASE_A_INDICE[clase]

    def predecir(self, formula: str) -> dict:
        """Clasifica una fórmula (texto) y devuelve clase + probabilidades."""
        from logica.parser import parsear

        ast = parsear(formula)
        return self.predecir_vector(extraer_caracteristicas(ast))

    def predecir_vector(self, vector) -> dict:
        if SKLEARN_DISPONIBLE:
            probs = self.modelo.predict_proba([vector])[0]
            # predict_proba alinea las clases con `classes_` (ordenado alfabéticamente
            # en sklearn), así que re-mapeamos a nuestro orden.
            clases_ = sorted(self.modelo.classes_)
            prob_dict = {}
            for idx_modelo, idx_nuestro in enumerate(clases_):
                prob_dict[CLASES[idx_nuestro]] = float(probs[idx_modelo])
            mejor = max(prob_dict, key=prob_dict.get)
            return {"clase": mejor, "probabilidades": prob_dict}
        clase, probs, k = self.modelo.predecir_clase(vector)
        return {"clase": clase, "probabilidades": probs, "k": k}


# ---------------------------------------------------------------------------
# Métricas y entrenamiento globales
# ---------------------------------------------------------------------------

def _metricas(y_real: list, y_pred: list) -> dict:
    """Precisión global + matriz de confusión 3×3."""
    total = len(y_real)
    aciertos = sum(1 for r, p in zip(y_real, y_pred) if r == p)
    exactitud = aciertos / total if total else 0.0

    n = len(CLASES)
    matriz = [[0] * n for _ in range(n)]
    for r, p in zip(y_real, y_pred):
        matriz[r][p] += 1

    filas = []
    for i, clase in enumerate(CLASES):
        vp = matriz[i][i]
        total_real = sum(matriz[i])
        total_pred = sum(matriz[j][i] for j in range(n))
        precision = vp / total_pred if total_pred else 0.0
        recall = vp / total_real if total_real else 0.0
        filas.append(
            {
                "clase": clase,
                "vp": vp,
                "precision": round(precision, 3),
                "recall": round(recall, 3),
                "f1": round((2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0, 3),
            }
        )

    return {
        "exactitud": round(exactitud, 4),
        "matriz": matriz,
        "clases": CLASES,
        "por_clase": filas,
    }


# ---------------------------------------------------------------------------
# Estado del modelo (se entrena una sola vez y se cachea en memoria)
# ---------------------------------------------------------------------------

_MODELO: Optional[ModeloFBF] = None


def reentrenar(n_instancias: int = 1500, semilla: int = 42) -> dict:
    """Entrena (o re-entrena) el modelo y devuelve sus métricas."""
    global _MODELO
    data = construir_dataset(n=n_instancias, semilla=semilla)
    _MODELO = ModeloFBF()
    return _MODELO.entrenar(data)


def obtener_modelo() -> ModeloFBF:
    """Devuelve el modelo entrenado, entrenándolo al primer uso (lazy)."""
    global _MODELO
    if _MODELO is None:
        reentrenar()
    return _MODELO


def info_modelo() -> dict:
    """Información resumida para la GUI (algoritmo, métricas, dataset)."""
    modelo = obtener_modelo()
    info = {
        "algoritmo": modelo.nombre,
        "sklearn": SKLEARN_DISPONIBLE,
        "metricas": modelo.metricas,
    }
    return info