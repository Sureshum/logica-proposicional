# -*- coding: utf-8 -*-
"""Módulo de semántica: evaluación con tablas de verdad.

Define cómo asignar valores de verdad a cada proposición atómica
y cómo clasificar una FBF en **Tautología**, **Contradicción** o **Contingencia**.
"""

from __future__ import annotations

import html
from itertools import product
from typing import Dict, List

from .parser import AtomNode, NegNode, BinNode, a_cadena, atomos, hijos

# Clasificaciones posibles de una FBF según su tabla de verdad.
TAUTOLOGIA = "Tautología"
CONTRADICCION = "Contradicción"
CONTINGENCIA = "Contingencia"

# Límite de átomos para construir la tabla de verdad (2^n filas).
MAX_ATOMOS_TABLA = 5


def evaluar(nodo, asignacion: Dict[str, bool]) -> bool:
    """Evalúa el AST con una asignación de valores (dict átomo -> bool).

    Tablas de verdad de operadores:
        ¬A  : negación (invierte).
        A∧B : verdadero solo si ambos lo son.
        A∨B : verdadero si al menos uno lo es.
        A→B : falso solo si A es V y B es F.
        A↔B : verdadero si ambos coinciden.
    """
    if isinstance(nodo, AtomNode):
        return bool(asignacion[nodo.nombre])
    if isinstance(nodo, NegNode):
        return not evaluar(nodo.hijo, asignacion)
    izq = evaluar(nodo.izq, asignacion)
    der = evaluar(nodo.der, asignacion)
    if nodo.op == "∧":
        return izq and der
    if nodo.op == "∨":
        return izq or der
    if nodo.op == "→":
        return (not izq) or der          # el condicional solo falla con V→F
    if nodo.op == "↔":
        return izq == der
    raise ValueError(f"Operador desconocido: {nodo.op!r}")


def _combinaciones(atoms: List[str]):
    """Genera todas las combinaciones de valores de verdad (producto cartesiano)."""
    return product([True, False], repeat=len(atoms))


def tabla_verdad(nodo) -> dict:
    """Construye la tabla de verdad de la fórmula.

    Returns:
        dict con ``atoms`` (columnas), ``filas`` (asignaciones) y ``valores``
        (resultado de la fórmula en cada fila). Si hay demasiados átomos se
        indica el límite.
    """
    vars_ = atomos(nodo)
    n = len(vars_)
    datos = {"atoms": vars_, "filas": [], "valores": [], "excede_limite": n > MAX_ATOMOS_TABLA}
    if datos["excede_limite"]:
        return datos
    for combinacion in _combinaciones(vars_):
        asg = dict(zip(vars_, combinacion))
        datos["filas"].append(asg)
        datos["valores"].append(evaluar(nodo, asg))
    return datos


def _subexpresiones(nodo) -> List:
    """Lista de todas las sub-fórmulas del árbol en orden pre-orden (raíz primero)."""
    resultado = [nodo]
    for sub in hijos(nodo):
        resultado.extend(_subexpresiones(sub))
    return resultado


def tabla_verdad_completa(nodo) -> dict:
    """Tabla de verdad enriquecida: una columna por cada sub-fórmula.

    Devuelve ``columnas`` (encabezados) y ``filas`` (valores como texto V/F).
    """
    vars_ = atomos(nodo)
    subnodos = _subexpresiones(nodo)
    # Solo conservamos una columna por cada subfórmula textual distinta.
    columnas: List[str] = []
    for sub in subnodos:
        texto = a_cadena(sub)
        if texto not in columnas:
            columnas.append(texto)

    total = len(vars_)
    filas = []
    if total > MAX_ATOMOS_TABLA:
        return {"columnas": columnas, "filas": [], "excede_limite": True}

    for combinacion in _combinaciones(vars_):
        asg = dict(zip(vars_, combinacion))
        fila = {}
        for sub in subnodos:
            texto = a_cadena(sub)
            valor = evaluar(sub, asg)
            fila[texto] = "V" if valor else "F"
        filas.append(fila)
    return {"columnas": columnas, "filas": filas, "excede_limite": False}


def clasificar(nodo) -> dict:
    """Clasifica la FBF según su tabla de verdad.

    Returns:
        dict con la clase, el conteo de valores verdaderos/falsos y
        la tabla asociada.
    """
    tabla = tabla_verdad(nodo)
    valores = tabla["valores"]

    canon = a_cadena(nodo)
    if tabla.get("excede_limite"):
        # No podemos probar todas las filas: reportamos indeterminado.
        return {
            "canonical": canon,
            "clase": "No determinable"
            f" (>{MAX_ATOMOS_TABLA} átomos: {len(tabla['atoms'])})",
            "verdaderos": None,
            "falsos": None,
            "tabla": tabla,
        }

    verdaderos = sum(1 for v in valores if v)
    falsos = len(valores) - verdaderos
    if falsos == 0:
        clase = TAUTOLOGIA
    elif verdaderos == 0:
        clase = CONTRADICCION
    else:
        clase = CONTINGENCIA

    return {
        "canonical": canon,
        "clase": clase,
        "verdaderos": verdaderos,
        "falsos": falsos,
        "tabla": tabla,
    }


def tabla_html(datos: dict) -> str:
    """Renderiza la tabla de verdad como HTML (para insertar en la GUI)."""
    columnas = datos["columnas"]
    filas = datos.get("filas", [])
    if datos.get("excede_limite"):
        return (
            '<p class="aviso">La tabla tendría '
            f"2^{len(columnas)} filas; "
            "se omite por superar el límite de trabajabilidad.</p>"
        )

    encabezados = "".join(f"<th>{html.escape(c)}</th>" for c in columnas)
    cuerpo = []
    for fila in filas:
        celdas = "".join(f"<td>{html.escape(fila[c])}</td>" for c in columnas)
        cuerpo.append(f"<tr>{celdas}</tr>")
    return (
        f'<table class="tabla-verdad"><thead><tr>{encabezados}</tr></thead>'
        f"<tbody>{''.join(cuerpo)}</tbody></table>"
    )