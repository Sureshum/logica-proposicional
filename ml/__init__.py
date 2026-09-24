# -*- coding: utf-8 -*-
"""Paquete de Machine Learning para el asistente inteligente.

Contiene:
- features : extracción de características numéricas de una FBF.
- dataset  : construcción de X/y a partir del generador de fórmulas.
- modelo   : clasificador (Scikit-Learn o fallback puro Python) + entrenamiento.
- nlp      : conversión de lenguaje natural (español) a FBF.
"""

from .features import extraer_caracteristicas, NOMBRES_CARACTERISTICAS  # noqa: F401
from .dataset import construir_dataset  # noqa: F401
from .modelo import obtener_modelo, reentrenar, info_modelo, SKLEARN_DISPONIBLE  # noqa: F401
from .nlp import oracion_a_fbf, parsear_asignaciones  # noqa: F401