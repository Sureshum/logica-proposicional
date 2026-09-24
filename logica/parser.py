# -*- coding: utf-8 -*-
"""Módulo Directo · Análisis sintáctico de Fórmulas Bien Formadas (FBF).

Este módulo implementa un tokenizador y un *parser descendente recursivo*
(recursive descent) que convierte una cadena de texto (ej. ``(p ∧ q) → ¬r``)
en un Árbol Sintáctico Abstracto (AST).

Gramática (EBNF), ordenada de menor a mayor precedencia:

    fbf      := bicond
    bicond   := cond  ( '↔' cond  )*
    cond     := disj  ( '→' disj  )*
    disj     := conj  ( '∨' conj  )*
    conj     := neg   ( '∧' neg   )*
    neg      := ( '¬' )* primario
    primario := '(' fbf ')' | ATOMO

Precedencia (de menor a mayor):  ↔  <  →  <  ∨  <  ∧  <  ¬  <  átomo.
Los paréntesis permiten agrupar y forzar otra asociación.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from typing import List, Optional


# ---------------------------------------------------------------------------
# 1. Definición de símbolos (conectivos) y sus alias textuales
# ---------------------------------------------------------------------------

#: Símbolos canónicos de los conectivos lógicos.
SIMBOLOS = {
    "neg": "¬",
    "conj": "∧",
    "disj": "∨",
    "impl": "→",
    "bicond": "↔",
}

#: Nombres legibles en lenguaje natural para cada conectivo (para interpretación).
NOMBRE_OPERADORES = {
    "¬": "no {x}",
    "∧": "({x} y {y})",
    "∨": "({x} o {y})",
    "→": "(si {x} entonces {y})",
    "↔": "({x} si y solo si {y})",
}

#: Alias no oficiales aceptados como entrada (formato ASCII).
_ALIASES = [
    ("<=>", "↔"),
    ("=>", "→"),
    ("->", "→"),
    ("-->", "→"),
    ("&&", "∧"),
    ("||", "∨"),
    ("&", "∧"),
    ("|", "∨"),
    ("~", "¬"),
    ("!", "¬"),
    ("^", "∧"),
    (">", "→"),
]


class FBFError(Exception):
    """Error lanzado cuando una cadena no es una Fórmula Bien Formada (FBF)."""


# ---------------------------------------------------------------------------
# 2. Nodos del Árbol Sintáctico Abstracto (AST)
# ---------------------------------------------------------------------------

@dataclass
class AtomNode:
    """Nodo hoja: una proposición atómica (ej. ``p``, ``q``, ``r``)."""
    nombre: str


@dataclass
class NegNode:
    """Nodo unario: negación (¬)."""
    hijo: object


@dataclass
class BinNode:
    """Nodo binario: fórmula con conectivo binario (∧, ∨, →, ↔)."""
    op: str            # Símbolo del conectivo en formato canónico.
    izq: object        # Sub-fórmula izquierda (AST).
    der: object        # Sub-fórmula derecha (AST).


# ---------------------------------------------------------------------------
# 3. Tokenizador: transforma texto plano en una lista de tokens
# ---------------------------------------------------------------------------

_ATOMO_RE = re.compile(r"[a-z][a-zA-Z0-9]*|_x", re.IGNORECASE)
_OPERADORES = set(SIMBOLOS.values())


def _canonicalizar(texto: str) -> str:
    """Reemplaza los alias ASCII por los símbolos canónicos unicode.

    Ejemplos:
        ``p => q``        -> ``p → q``
        ``(p & q) <-...`` -> ``(p ∧ q) ...``
    """
    for alias, simbolo in _ALIASES:
        texto = texto.replace(alias, simbolo)
    return texto


def _tokenizar(texto: str) -> List[tuple]:
    """Divide la fórmula ya normalizada en tokens: (tipo, valor).

    ``tipo`` es ``"PAREN"``, ``"OP"`` (conectivo) o ``"ATOM"``.
    Lanza :class:`FBFError` ante cualquier carácter no reconocido.
    """
    tokens: List[tuple] = []
    i, n = 0, len(texto)
    while i < n:
        c = texto[i]
        if c.isspace():
            i += 1
            continue
        if c in "()":
            tokens.append(("PAREN", c))
            i += 1
            continue
        if c in _OPERADORES:
            tokens.append(("OP", c))
            i += 1
            continue
        m = _ATOMO_RE.match(texto, i)
        if m:
            tokens.append(("ATOM", m.group(0)))
            i = m.end()
            continue
        raise FBFError(
            f"Símbolo no reconocido: {c!r} (posición {i + 1}). "
            f"Use letras a-z, conectivos {sorted(_OPERADORES)} y paréntesis."
        )
    return tokens


# ---------------------------------------------------------------------------
# 4. Parser descendente recursivo
# ---------------------------------------------------------------------------

class _Parser:
    """Parser descendente recursivo según la gramática EBNF definida arriba."""

    def __init__(self, tokens: List[tuple]):
        self._tokens = tokens
        self._pos = 0

    # --- utilidades de cursor ---
    def _actual(self) -> Optional[tuple]:
        return self._tokens[self._pos] if self._pos < len(self._tokens) else None

    def _avanzar(self) -> tuple:
        tok = self._actual()
        if tok is None:
            raise FBFError("Fórmula incompleta: falta un operando o un cierre de paréntesis.")
        self._pos += 1
        return tok

    def _esperar(self, valor: str) -> None:
        tok = self._actual()
        if tok is None or tok[1] != valor:
            raise FBFError(
                f"Se esperaba {valor!r} pero se encontró {tok[1] if tok else 'fin de fórmula'}."
            )
        self._pos += 1

    # --- reglas gramaticales ---
    def fbf(self):
        return self._bicond()

    def _bicond(self):
        """bicond := cond ( '↔' cond )*  -> asociatividad izquierda."""
        nodo = self._cond()
        while self._actual() and self._actual()[1] == "↔":
            self._avanzar()
            nodo = BinNode("↔", nodo, self._cond())
        return nodo

    def _cond(self):
        """cond := disj ( '→' disj )*  -> asociatividad izquierda."""
        nodo = self._disj()
        while self._actual() and self._actual()[1] == "→":
            self._avanzar()
            nodo = BinNode("→", nodo, self._disj())
        return nodo

    def _disj(self):
        """disj := conj ( '∨' conj )*  -> asociatividad izquierda."""
        nodo = self._conj()
        while self._actual() and self._actual()[1] == "∨":
            self._avanzar()
            nodo = BinNode("∨", nodo, self._conj())
        return nodo

    def _conj(self):
        """conj := neg ( '∧' neg )*  -> asociatividad izquierda."""
        nodo = self._neg()
        while self._actual() and self._actual()[1] == "∧":
            self._avanzar()
            nodo = BinNode("∧", nodo, self._neg())
        return nodo

    def _neg(self):
        """neg := ( '¬' )* primario  -> la negación puede repetirse (¬¬p)."""
        veces = 0
        while self._actual() and self._actual()[1] == "¬":
            self._avanzar()
            veces += 1
        nodo = self._primario()
        for _ in range(veces):
            nodo = NegNode(nodo)
        return nodo

    def _primario(self):
        """primario := '(' fbf ')' | ATOMO."""
        tok = self._actual()
        if tok is None:
            raise FBFError("Fórmula vacía o incompleta.")
        if tok[0] == "PAREN" and tok[1] == "(":
            self._avanzar()                  # consume '('
            nodo = self.fbf()
            self._esperar(")")               # consume ')'
            return nodo
        if tok[0] == "ATOM":
            self._avanzar()
            return AtomNode(tok[1])
        if tok[0] == "OP":
            raise FBFError(
                f"Conectivo {tok[1]!r} sin operando a la izquierda (posición {self._pos + 1})."
            )
        raise FBFError(f"Token inesperado: {tok[1]!r}.")


def parsear(texto: str):
    """Analiza una cadena y devuelve el AST correspondiente.

    Raises:
        FBFError: si la cadena no es sintácticamente válida.
    """
    if not texto or not texto.strip():
        raise FBFError("La fórmula está vacía.")
    texto = _canonicalizar(texto)
    tokens = _tokenizar(texto)
    parser = _Parser(tokens)
    arbol = parser.fbf()
    if parser._actual() is not None:
        resto = parser._actual()[1]
        raise FBFError(f"Contenido no esperado después de la fórmula: {resto!r}.")
    return arbol


def es_fbf(texto: str) -> bool:
    """Devuelve ``True`` si la cadena es una FBF válida (sin lanzar errores)."""
    try:
        parsear(texto)
        return True
    except FBFError:
        return False


# ---------------------------------------------------------------------------
# 5. Utilidades sobre el AST
# ---------------------------------------------------------------------------

def _cadena_interna(nodo) -> str:
    """Serializa el AST dejando siempre paréntesis en cada nodo binario."""
    if isinstance(nodo, AtomNode):
        return nodo.nombre
    if isinstance(nodo, NegNode):
        interior = _cadena_interna(nodo.hijo)
        if isinstance(nodo.hijo, AtomNode):
            return "¬" + interior
        # Los nodos binarios ya se serializan como "(...)" ; no duplicamos
        # el par de paréntesis (¬(p → q) y no ¬((p → q))).
        if interior.startswith("(") and interior.endswith(")"):
            return "¬" + interior
        return "¬(" + interior + ")"
    return f"({_cadena_interna(nodo.izq)} {nodo.op} {_cadena_interna(nodo.der)})"


def _parens_recubren(texto: str) -> bool:
    """¿El primer '(' tiene su par de cierre como último carácter?"""
    prof = 0
    for i, c in enumerate(texto):
        if c == "(":
            prof += 1
        elif c == ")":
            prof -= 1
            if prof == 0:
                return i == len(texto) - 1
    return False


def a_cadena(nodo) -> str:
    """Serializa el AST a su representación canónica formal (FBF).

    La raíz de un conectivo binario se muestra *sin* paréntesis exteriores:
    ``(p → q)`` se imprime como ``p → q``. Los paréntesis internos sí se
    conservan cuando la precedencia de los conectivos lo exige.
    """
    texto = _cadena_interna(nodo)
    if isinstance(nodo, BinNode) and _parens_recubren(texto):
        return texto[1:-1]
    return texto


def hijos(nodo) -> List:
    """Devuelve los hijos del nodo (según su tipo)."""
    if isinstance(nodo, AtomNode):
        return []
    if isinstance(nodo, NegNode):
        return [nodo.hijo]
    return [nodo.izq, nodo.der]


def atomos(nodo) -> List[str]:
    """Devuelve las proposiciones atómicas de la fórmula (sin duplicados).

    Se mantiene el orden de la primera aparición.
    """
    vistos = []

    def _rec(n):
        for sub in hijos(n):
            _rec(sub)
        if isinstance(n, AtomNode) and n.nombre not in vistos:
            vistos.append(n.nombre)

    _rec(nodo)
    return vistos


def profundidad(nodo) -> int:
    """Profundidad máxima del árbol sintáctico (hoja = 0)."""
    if isinstance(nodo, AtomNode):
        return 0
    return 1 + max((profundidad(h) for h in hijos(nodo)), default=0)


def contar_nodos(nodo) -> int:
    """Cantidad total de nodos del árbol."""
    return 1 + sum(contar_nodos(h) for h in hijos(nodo))


# ---------------------------------------------------------------------------
# 6. Interpretación en lenguaje natural y render del árbol
# ---------------------------------------------------------------------------

def render_es(nodo, nombres: Optional[dict] = None) -> str:
    """Traduce la fórmula a una lectura en lenguaje natural (español).

    Args:
        nodo: AST de la FBF.
        nombres: diccionario opcional ``{átomo: descripción}`` usado para leer
            cada variable como su significado (ej. ``{'p': 'llueve'}``).
    """
    nombres = nombres or {}
    if isinstance(nodo, AtomNode):
        return nombres.get(nodo.nombre, nodo.nombre)
    if isinstance(nodo, NegNode):
        return NOMBRE_OPERADORES["¬"].format(x=render_es(nodo.hijo, nombres))
    return NOMBRE_OPERADORES[nodo.op].format(
        x=render_es(nodo.izq, nombres), y=render_es(nodo.der, nombres)
    )


def _escape(texto: str) -> str:
    return html.escape(str(texto))


def arbol_html(nodo) -> str:
    """Devuelve un HTML con el árbol sintáctico (lista anidada), para la GUI."""
    label = _escape(a_cadena(nodo))
    if isinstance(nodo, AtomNode):
        return f'<li class="nodo atom">{label}</li>'

    hijos_html = "".join(arbol_html(h) for h in hijos(nodo))
    clase = "nodo neg" if isinstance(nodo, NegNode) else "nodo binario"
    return f'<li class="{clase}"><span>{label}</span><ul>{hijos_html}</ul></li>'