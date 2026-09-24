# -*- coding: utf-8 -*-
"""Extracción de características numéricas para el modelo de ML.

Convertimos cada FBF (su AST) en un vector de números que describen su
**morfología sintáctica**: cuántas veces aparece cada conectivo, cuántas
variables distintas usa, la profundidad del árbol, etc.

La idea es que el modelo aprenda patrones del tipo:
    "si la fórmula contiene parejas complementarias (A y ¬A) unidas por ∧,
     entonces probablemente es una *Contradicción*".

Estas características se calculan **sin** construir la tabla de verdad,
lo cual permite *predecir* la clase antes de evaluarla exhaustivamente.
"""

from __future__ import annotations

from collections import Counter

from logica.parser import AtomNode, NegNode, BinNode, hijos, atomos, profundidad, contar_nodos

#: Lista de conectivos binarios que contamos como características.
OPERADORES = ["∧", "∨", "→", "↔"]

#: Nombres legibles de cada característica (van con el vector en orden).
NOMBRES_CARACTERISTICAS = [
    "num_variables",
    "num_variables_distintas",
    "num_negaciones",
    "num_conjunciones",
    "num_disyunciones",
    "num_condicionales",
    "num_bicondicionales",
    "profundidad_maxima",
    "total_nodos",
    "total_tokens",
    "parejas_complementarias",
    "ratio_negaciones",
]


def _conteo_operadores(nodo) -> Counter:
    """Cuenta las apariciones de cada conectivo binario y unario en el árbol."""
    conteo = Counter()

    def _rec(n):
        if isinstance(n, NegNode):
            conteo["¬"] += 1
            _rec(n.hijo)
        elif isinstance(n, BinNode):
            conteo[n.op] += 1
            _rec(n.izq)
            _rec(n.der)

    _rec(nodo)
    return conteo


def _parejas_complementarias(nodo) -> int:
    """Nº de variables que aparecen a la vez negadas y sin negar (A, ¬A).

    High value sugiere fórmulas tipo ``A ∧ ¬A`` (contradicción) o
    ``A ∨ ¬A`` (tautología).
    """
    negadas = set()
    no_negadas = set()

    def _es_nodo_negado(n):
        return isinstance(n, NegNode)

    def _rec(n, bajo_negacion):
        if isinstance(n, AtomNode):
            (negadas if bajo_negacion else no_negadas).add(n.nombre)
        elif isinstance(n, NegNode):
            _rec(n.hijo, not bajo_negacion)
        else:
            _rec(n.izq, bajo_negacion)
            _rec(n.der, bajo_negacion)

    _rec(nodo, False)
    return len(negadas & no_negadas)


def extraer_caracteristicas(nodo) -> list:
    """Devuelve el vector de características de la fórmula (lista de float)."""
    conteo = _conteo_operadores(nodo)
    vars_ = atomos(nodo)
    total_nodos = contar_nodos(nodo)

    vector = [
        float(len(vars_)),                       # apariciones de variables
        float(len(set(vars_))),                  # variables distintas
        float(conteo["¬"]),                      # nº de negaciones
        float(conteo["∧"]),                      # nº de conjunciones
        float(conteo["∨"]),                      # nº de disyunciones
        float(conteo["→"]),                      # nº de condicionales
        float(conteo["↔"]),                      # nº de bicondicionales
        float(profundidad(nodo)),                # profundidad del árbol
        float(total_nodos),                      # nodos totales
        float(_longitud_texto(nodo)),            # nº aproximado de tokens
        float(_parejas_complementarias(nodo)),   # parejas A y ¬A
        float(conteo["¬"]) / max(total_nodos, 1),  # proporción de negaciones
    ]
    return vector


def _longitud_texto(nodo) -> int:
    """Nº aproximado de tokens del texto canónico: nodos + paréntesis."""
    return contar_nodos(nodo) + 2 * _conteo_parens(nodo)


def _conteo_parens(nodo) -> int:
    """Cuenta los pares de paréntesis que la notación canónica insertaría."""

    def _rec(n):
        if isinstance(n, AtomNode):
            return 0
        if isinstance(n, NegNode):
            return (0 if isinstance(n.hijo, (AtomNode, NegNode)) else 1) + _rec(n.hijo)
        return 1 + _rec(n.izq) + _rec(n.der)

    return _rec(nodo)