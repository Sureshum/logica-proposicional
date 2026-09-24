# -*- coding: utf-8 -*-
"""Paquete de lógica proposicional.

Incluye:
- parser            : análisis sintáctico de FBF (tokenizador + parser descendente).
- semantica         : tablas de verdad y clasificación de fórmulas.
- generador         : generación aleatoria de FBF para construir datasets de ML.
"""

from .parser import (  # noqa: F401
    FBFError,
    AtomNode,
    NegNode,
    BinNode,
    parsear,
    a_cadena,
    atomos,
    profundidad,
    hijos,
    render_es,
    arbol_html,
    SIMBOLOS,
    NOMBRE_OPERADORES,
)
from .semantica import (  # noqa: F401
    evaluar,
    tabla_verdad,
    tabla_verdad_completa,
    clasificar,
)