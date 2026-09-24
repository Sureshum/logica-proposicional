# -*- coding: utf-8 -*-
"""Construcción del conjunto de datos (X, y) para el entrenamiento del modelo.

- X : matriz de características (vectores numéricos por fórmula).
- y : etiquetas de clase codificadas (0=Contradicción, 1=Contingencia, 2=Tautología).

Los datos provienen de :mod:`logica.generador`, que etiqueta cada fórmula con su
**tabla de verdad** real, de modo que el modelo aprende a clasificar por
morfología sintáctica (características) algo que originalmente se decidía por
semántica (tabla de verdad).
"""

from __future__ import annotations

import random
from typing import Tuple

from logica.parser import parsear
from logica.generador import generar_dataset, resumen_dataset

from .features import NOMBRES_CARACTERISTICAS, extraer_caracteristicas

#: Mapeo etiqueta textual -> índice numérico de clase.
CLASES = ["Contradicción", "Contingencia", "Tautología"]
CLASE_A_INDICE = {"Contradicción": 0, "Contingencia": 1, "Tautología": 2}

FRACCION_PRUEBA = 0.2


def _feat_de_formula(texto: str) -> list:
    """Características de una fórmula dada (por texto)."""
    ast = parsear(texto)
    return extraer_caracteristicas(ast)


def _convertir(formulas: list) -> Tuple[list, list]:
    """Convierte una lista de dicts ``{formula, clase}`` en X e y."""
    X, y = [], []
    for item in formulas:
        X.append(_feat_de_formula(item["formula"]))
        y.append(CLASE_A_INDICE[item["clase"]])
    return X, y


def construir_dataset(n: int = 1500, semilla: int = 42) -> dict:
    """Genera y divide el dataset en entrenamiento y prueba.

    Returns:
        dict con ``X_train, y_train, X_test, y_test, formulas_test`` y
        ``distribucion`` (conteo por clase del dataset completo).
    """
    datos = generar_dataset(n_objetivo=n, semilla=semilla)
    rng = random.Random(semilla)              # split reproducible
    orden = list(range(len(datos)))
    rng.shuffle(orden)

    corte = int(len(orden) * FRACCION_PRUEBA)
    test_idx = set(orden[:corte])
    train_idx = [i for i in orden if i not in test_idx]
    test_idx = [i for i in orden if i in test_idx]

    train = [datos[i] for i in train_idx]
    test = [datos[i] for i in test_idx]

    X_train, y_train = _convertir(train)
    X_test, y_test = _convertir(test)

    return {
        "X_train": X_train,
        "y_train": y_train,
        "X_test": X_test,
        "y_test": y_test,
        "formulas_test": [d["formula"] for d in test],
        "formulas_entrenamiento": [d["formula"] for d in train],
        "distribucion": resumen_dataset(datos),
        "n_entrenamiento": len(train),
        "n_prueba": len(test),
    }