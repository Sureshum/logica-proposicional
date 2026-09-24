# -*- coding: utf-8 -*-
"""Conversión de lenguaje natural (español) a su FBF simbólica.

Es una de las capacidades del módulo de *asistencia inteligente*: el usuario
escribe una oración como::

    "Llueve y hace frío"               (con p=Llueve, q=Hace frío)
    -> (p ∧ q)

Se implementa con **procesamiento de reglas**:
  1. Normalización (minúsculas + sin acentos).
  2. Sustitución de las descripciones declaradas por sus símbolos (p, q, ...).
  3. Detección de conectivos en español:
       "y"  -> ∧      "o"  -> ∨      "no" -> ¬
       "si A entonces B"  -> (A → B)   "A si y solo si B" -> (A ↔ B)
  4. La cadena resultante se valida con el parser de FBF.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Dict, List

from logica.parser import parsear, FBFError

# Conectivos en español y su símbolo lógico.
_CONECTORES = {
    "↔": "↔",
    "y": "∧",
    "o": "∨",
}

# Palabras 'negras' será: si no aparece al inicio se sustituye por ¬.
_ATOMO_RE = re.compile(r"[a-z][a-z0-9]*")
_ASIGNACION_RE = re.compile(r"([A-Za-z0-9_]+)\s*[:=]\s*([^,;\n]+)")


def _sin_acentos(texto: str) -> str:
    """Elimina tildes y normaliza a minúsculas."""
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return texto.lower()


def parsear_asignaciones(texto: str) -> Dict[str, str]:
    """Convierte ``"p: Llueve, q: Hace frío"`` en ``{"p": "llueve", ...}``.

    Los sinónimos separados por ``/`` se guardan todos en la misma clave de
    búsqueda. Devuelve un dict ``{simbolo: descripción}``.
    """
    resultado: Dict[str, str] = {}
    for m in _ASIGNACION_RE.finditer(texto or ""):
        simbolo = m.group(1).strip()
        desc = _sin_acentos(m.group(2).strip()).strip(" .")
        if not _ATOMO_RE.fullmatch(simbolo):
            continue
        resultado[simbolo] = desc
    return resultado


def _mapa_desc_a_simbolo(simbolos: Dict[str, str]) -> List[tuple]:
    """Construye la lista (descripción → símbolo) ordenada de más larga a corta."""
    mapa = []
    for simbolo, desc in simbolos.items():
        desc = _sin_acentos(desc)
        for sinonimo in desc.split("/"):
            sinonimo = sinonimo.strip()
            if sinonimo:
                mapa.append((sinonimo, simbolo))
    mapa.sort(key=lambda x: -len(x[0]))
    return mapa


def _sustituir_descripciones(oracion: str, simbolos: Dict[str, str]) -> str:
    """Reemplaza las descripciones declaradas por el símbolo de su variable."""
    for desc, simbolo in _mapa_desc_a_simbolo(simbolos):
        patron = r"(?<![a-z])" + re.escape(desc) + r"(?![a-z])"
        oracion = re.sub(patron, f" {simbolo} ", oracion)
    return oracion


def _quitar_no_validos(oracion: str) -> str:
    """Borra puntuación residual; conserva letras, dígitos y símbolos lógicos."""
    permitidos = "abcdefghijklmnopqrstuvwxyz0123456789 ()¬∧∨→↔"
    return "".join(c for c in oracion if c in permitidos)


def _buscar_fuera_parens(oracion: str, token: str) -> int:
    """Índice de `token` (símbolo lógico rodeado de espacios) fuera de paréntesis."""
    prof = 0
    n = len(oracion)
    i = 0
    while i < n:
        c = oracion[i]
        if c == "(":
            prof += 1
        elif c == ")":
            prof = max(0, prof - 1)
        elif prof == 0 and oracion.startswith(token, i) \
                and oracion[i - 1].isspace() \
                and (i + len(token) >= n or oracion[i + len(token)].isspace()):
            return i
        i += 1
    return -1


def _dividir(oracion: str, token: str):
    """Divide la oración en (izquierda, derecha) en la primera aparición del token."""
    pos = _buscar_fuera_parens(oracion, token)
    if pos < 0:
        return None
    izq = oracion[:pos].strip()
    der = oracion[pos + len(token):].strip()
    return izq, der


def _balanceada(oracion: str) -> bool:
    """Verifica que los paréntesis estén balanceados."""
    return oracion.count("(") == oracion.count(")") and \
        not re.search(r"\)\s*\(", oracion.replace(" ", ""))


def _es_atomo_valido(pieza: str) -> bool:
    """True si la pieza es una variable proposicional (p, q1, r22, ...)."""
    return bool(_ATOMO_RE.fullmatch(pieza))


def _traducir(oracion: str) -> str:
    """Traduce recursivamente una oración ya normalizada a una cadena FBF."""
    oracion = " ".join(oracion.split())          # normaliza espacios
    if not oracion:
        raise FBFError("No se encontró contenido para traducir.")

    # 1. Paréntesis explícitos: se respetan.
    if oracion.startswith("(") and oracion.endswith(")") and _balanceada(oracion):
        interior = _traducir(oracion[1:-1])
        return f"({interior})"

    # 2. Bicondicional: "p si y solo si q" -> (p ↔ q)
    pieza = _dividir(oracion.strip(" "), "↔")
    if pieza:
        izq, der = pieza
        return f"({_traducir(izq)} ↔ {_traducir(der)})"

    # 3. Condicional: "si A entonces B" -> (A → B)
    m = re.search(r"^si\s+(.+?)\s+entonces\s+(.+)$", oracion)
    if m:
        return f"({_traducir(m.group(1))} → {_traducir(m.group(2))})"

    # 3b. Condicional ya materializado por reglas previas (p.ej. "solo si").
    pieza = _dividir(oracion, "→")
    if pieza:
        izq, der = pieza
        return f"({_traducir(izq)} → {_traducir(der)})"

    # 4. Disyunción: "A o B" -> (A ∨ B)
    pieza = _dividir(oracion, "∨")
    if pieza:
        izq, der = pieza
        return f"({_traducir(izq)} ∨ {_traducir(der)})"

    # 5. Conjunción: "A y B" -> (A ∧ B)
    pieza = _dividir(oracion, "∧")
    if pieza:
        izq, der = pieza
        return f"({_traducir(izq)} ∧ {_traducir(der)})"

    # 6. Negación explícita: "no A" -> (¬ A)
    if oracion.startswith("no "):
        return f"(¬ {_traducir(oracion[3:])})"

    # 7. Caso base: variable simple.
    if _es_atomo_valido(oracion):
        return oracion

    # Si quedan palabras sueltas que no son conectivos, hubo algo sin declarar.
    sobrantes = [t for t in oracion.split() if not _es_atomo_valido(t)]
    raise FBFError(
        "Término(s) no reconocidos en la oración: "
        + ", ".join(sobrantes)
        + ". Decláralos en las asignaciones (ej. p: Llueve)."
    )


def oracion_a_fbf(oracion: str, simbolos: Dict[str, str]) -> str:
    """Convierte una oración en español a su FBF (cadena canónica).

    Raises:
        FBFError: si no se puede interpretar o la FBF resultante es inválida.
    """
    texto = _sin_acentos(oracion or "")
    texto = _sustituir_descripciones(texto, simbolos)

    # 1) Bicondicional: "p si y solo si q" -> "p ↔ q".
    texto = re.sub(r"\bsi y solo si\b", " ↔ ", texto)
    # 2) "p solo si q" («p sólo si q») se lee como condicional didáctico p → q.
    texto = re.sub(r"^(.+?)\s+solo\s+si\s+(.+)$", r"(\1 → \2)", texto)
    # 3) Conectivos binarios en español (palabras completas, con límites).
    texto = re.sub(r"\by\b", " ∧ ", texto)
    texto = re.sub(r"\bo\b", " ∨ ", texto)

    texto = _quitar_no_validos(texto)
    if not texto.strip():
        raise FBFError("La oración quedó vacía tras la normalización.")

    fbf = _traducir(texto.strip(" ."))
    # Validación final con el parser real de FBF.
    parsear(fbf)
    return fbf