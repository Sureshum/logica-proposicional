# -*- coding: utf-8 -*-
"""Generador de Fórmulas Bien Formadas aleatorias.

Su propósito es crear un **dataset** de fórmulas etiquetadas
(Tautología / Contradicción / Contingencia) a partir de tablas de verdad,
que servirá para entrenar el modelo de Machine Learning.

Estrategia para obtener clases balanceadas:
  - Si se quiere una tautología: se genera una F aleatoria y se usa ``F ∨ ¬F``
    (principio del tercero excluido: siempre es verdadera).
  - Si se quiere una contradicción: se usa ``F ∧ ¬F`` (siempre falsa).
  - Si se quiere una contingencia: se usa ``F`` tal cual (su tabla de verdad
    depende de la asignación).
"""

from __future__ import annotations

import random
from typing import List, Optional

from .parser import (
    AtomNode,
    NegNode,
    BinNode,
    a_cadena,
    atomos,
    render_es,
)
from .semantica import clasificar

#: Variables proposicionales disponibles para generar fórmulas.
ATOMOS_POOL = ["p", "q", "r", "s", "t"]

#: Banco de significados sencillos en español para las proposiciones.
DESCRIPCIONES_POOL = [
    "llueve", "hace frío", "hace calor", "nieva", "hay neblina",
    "estudio", "duermo", "como", "trabajo", "descanso",
    "corro", "bailo", "canto", "leo", "mira televisión", "viaja",
]

_OPERADORES_BINARIOS = ["∧", "∨", "→", "↔"]


def _fbf_aleatoria(vars_usadas: List[str], profundidad_restante: int):
    """Genera un AST aleatorio usando las variables dadas."""
    if profundidad_restante <= 0 or random.random() < 0.4:
        return AtomNode(random.choice(vars_usadas))

    modo = random.random()
    if modo < 0.25:
        return NegNode(_fbf_aleatoria(vars_usadas, profundidad_restante - 1))

    op = random.choice(_OPERADORES_BINARIOS)
    return BinNode(
        op,
        _fbf_aleatoria(vars_usadas, profundidad_restante - 1),
        _fbf_aleatoria(vars_usadas, profundidad_restante - 1),
    )


def _sobre_subconjunto():
    """Elige un subconjunto de 1 a 3 variables para 'sembrar' la fórmula."""
    n = random.randint(1, min(3, len(ATOMOS_POOL)))
    return random.sample(ATOMOS_POOL, n)


def _generar_formula(categoria: str) -> object:
    """Genera un AST cuya tabla de verdad corresponde (en su mayoría) a la clase."""
    vars_semilla = _sobre_subconjunto()
    base = _fbf_aleatoria(vars_semilla, profundidad_restante=random.randint(1, 3))

    if categoria == "tautologia":
        # F ∨ ¬F  es tautología garantizada.
        return BinNode("∨", base, NegNode(base))
    if categoria == "contradiccion":
        # F ∧ ¬F  es contradicción garantizada.
        return BinNode("∧", base, NegNode(base))
    # contingencia: fórmula al azar (se confirma luego con la tabla de verdad).
    return base


def proposicion_aleatoria(simbolos_permitidos: Optional[List[str]] = None) -> dict:
    """Genera una proposición al azar (simple o molecular) para practicar.

    Args:
        simbolos_permitidos: símbolos disponibles (p, q, r…). Por defecto usa
            todo :data:`ATOMOS_POOL`. Evita colisiones con tarjetas existentes.

    Returns:
        dict con ``formula`` (FBF canónica), ``descripciones`` (símbolo →
        significado) y ``lectura`` (la proposición en lenguaje natural).
    """
    pool = list(simbolos_permitidos if simbolos_permitidos else ATOMOS_POOL)
    n = min(random.randint(1, 3), len(pool))
    vars_usadas = random.sample(pool, n)
    descripciones = {v: random.choice(DESCRIPCIONES_POOL) for v in vars_usadas}

    if n == 1 and random.random() < 0.5:
        # Proposición simple (a veces negada).
        ast = AtomNode(vars_usadas[0])
        if random.random() < 0.3:
            ast = NegNode(ast)
    else:
        ast = _fbf_aleatoria(vars_usadas, random.randint(1, 2))

    # Ocasionalmente se niega el resultado completo…
    if random.random() < 0.25:
        ast = NegNode(ast)

    # …o se combina con un átomo nuevo para obtener una proposición molecular.
    libres = [s for s in pool if s not in vars_usadas]
    if libres and random.random() < 0.25:
        extra = random.choice(libres)
        descripciones[extra] = random.choice(DESCRIPCIONES_POOL)
        ast = BinNode(random.choice(_OPERADORES_BINARIOS), ast, AtomNode(extra))

    return {
        "formula": a_cadena(ast),
        "descripciones": descripciones,
        "lectura": render_es(ast, descripciones),
    }


def generar_instancia(categoria: str) -> dict:
    """Genera una instancia ``{formula, clase}`` con la clase ya verificada."""
    ast = _generar_formula(categoria)
    clas = clasificar(ast)
    texto = a_cadena(ast)
    indices = {
        "Tautología": "tautologia",
        "Contradicción": "contradiccion",
        "Contingencia": "contingencia",
    }
    # Si por azar la clase difiere de la pedida, la usamos igualmente porque
    # la etiqueta de verdad proviene siempre de la tabla de verdad.
    return {"formula": texto, "clase": clas["clase"], "target": indices.get(clas["clase"])}


def generar_dataset(n_objetivo: int = 1500, semilla: int = 42) -> List[dict]:
    """Genera un dataset balanceado de ``n_objetivo`` instancias etiquetadas.

    Returns:
        lista de dicts ``{"formula": str, "clase": str, "target": 0|1|2}``.
    """
    rng = random.Random(semilla)
    estado = rng.getstate()
    random.setstate(estado)          # semilla global para reproducibilidad

    cuotas = {
        "tautologia": n_objetivo // 3,
        "contradiccion": n_objetivo // 3,
        "contingencia": n_objetivo - 2 * (n_objetivo // 3),
    }
    acumulado = {"tautologia": [], "contradiccion": [], "contingencia": []}

    intentos = 0
    while len(acumulado["tautologia"]) < cuotas["tautologia"] \
            or len(acumulado["contradiccion"]) < cuotas["contradiccion"] \
            or len(acumulado["contingencia"]) < cuotas["contingencia"]:
        intentos += 1
        if intentos > 50_000:          # salvaguarda ante bucles infinitos.
            break

        categoria = random.choice(list(cuotas.keys()))
        instancia = generar_instancia(categoria)
        # La agrupamos por su clase real (la tabla de verdad manda).
        clave = {
            "Tautología": "tautologia",
            "Contradicción": "contradiccion",
            "Contingencia": "contingencia",
        }.get(instancia["clase"], "contingencia")
        try:
            if len(acumulado[clave]) < cuotas[clave]:
                acumulado[clave].append(instancia)
        except KeyError:
            acumulado["contingencia"].append(instancia)

    resultado: List[dict] = []
    # Mezclamos para que el dataset no quede agrupado por clase.
    for lista in acumulado.values():
        resultado.extend(lista)
    random.shuffle(resultado)
    return resultado


def resumen_dataset(datos: List[dict]) -> dict:
    """Cuenta cuántas instancias hay de cada clase (para mostrar en la GUI)."""
    conteo = {"Tautología": 0, "Contradicción": 0, "Contingencia": 0}
    for d in datos:
        if d["clase"] in conteo:
            conteo[d["clase"]] += 1
    return conteo


if __name__ == "__main__":
    # Prueba rápida de línea de comandos.
    import time

    inicio = time.time()
    data = generar_dataset(n_objetivo=300)
    print("Instancias generadas:", len(data))
    print("Distribución:", resumen_dataset(data))
    print("Ejemplos:")
    for d in data[:8]:
        print(f"  {d['formula']:<24} -> {d['clase']}")
    print(f"Tiempo: {time.time() - inicio:.2f}s")