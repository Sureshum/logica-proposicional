# -*- coding: utf-8 -*-
"""Aplicación web (Flask) del sistema de Lógica Proposicional.

Arquitectura general
--------------------
La interfaz es una aplicación web compuesta por un backend Python (Flask)
y una capa de presentación (HTML + Tailwind + JavaScript). Los módulos
de dominio son librerías puras y reutilizables:

    * ``logica.parser``     análisis sintáctico de FBF (AST + validación).
    * ``logica.semantica``  tablas de verdad y clasificación de fórmulas.
    * ``logica.generador``  generación del dataset etiquetado (ML).
    * ``ml.*``              características, modelo predictivo y NLP.

Rutas principales
-----------------
    /login          pantalla de autenticación (usuario/contraseña).
    /logout         cierra la sesión.
    /panel          panel principal con acceso a los tres módulos.
    /directo        módulo directo: construcción de FBF paso a paso.
    /inverso        módulo inverso: parsing e interpretación de una FBF.
    /ml             asistente inteligente (clasificador + NLP).

Las rutas ``/api/*`` son endpoints JSON que consumen las páginas mediante
``fetch``. Toda la API exige sesión iniciada.
"""

from __future__ import annotations

import os
import re
from functools import wraps

from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from logica.generador import ATOMOS_POOL, proposicion_aleatoria
from logica.parser import (
    AtomNode,
    BinNode,
    FBFError,
    NegNode,
    a_cadena,
    arbol_html,
    atomos,
    parsear,
    render_es,
)
from logica.semantica import (
    clasificar,
    tabla_html,
    tabla_verdad_completa,
)
from ml.modelo import info_modelo, obtener_modelo, reentrenar
from ml.nlp import oracion_a_fbf, parsear_asignaciones

# ---------------------------------------------------------------------------
# Configuración básica de la aplicación
# ---------------------------------------------------------------------------

app = Flask(__name__)
# En producción reemplazar SECRET_KEY por un valor aleatorio desde variables
# de entorno; en esta versión de demostración usamos una clave fija de desarrollo.
app.secret_key = os.environ.get("SECRET_KEY", "clave-desarrollo-logica-2026")

# Credenciales predeterminadas definidas en el enunciado.
USUARIO_POR_DEFECTO = "admin"
CLAVE_POR_DEFECTO = "1234"

# Conectivos binarios soportados por el constructor directo.
OPERADORES_BINARIOS = {"∧", "∨", "→", "↔"}
# Formato aceptado para los símbolos proposicionales (p, q, r1, s2, ...).
SIMBOLO_ATOMO_RE = re.compile(r"^[a-z][a-z0-9]*$", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Utilidades de sesión y validación
# ---------------------------------------------------------------------------

def login_requerido(func):
    """Decorador: redirige a /login si no hay sesión iniciada."""
    @wraps(func)
    def envoltura(*args, **kwargs):
        if not session.get("logueado"):
            return redirect(url_for("login", next=request.path))
        return func(*args, **kwargs)
    return envoltura


def _parsear_descripciones(valor):
    """Normaliza las descripciones que llegan del cliente.

    Acepta un dict ``{simbolo: descripción}`` o una cadena
    ``"p: Llueve, q: Hace frío"``. Devuelve siempre un dict ``{simbolo: texto}``.
    """
    if isinstance(valor, dict):
        return {str(k): str(v) for k, v in valor.items()}
    if isinstance(valor, str):
        return parsear_asignaciones(valor)
    return {}


# ---------------------------------------------------------------------------
# Autenticación
# ---------------------------------------------------------------------------

@app.route("/")
def inicio():
    """Raíz de la aplicación: redirige según haya sesión o no."""
    if session.get("logueado"):
        return redirect(url_for("panel"))
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    """Pantalla de inicio de sesión (usuario admin / contraseña 1234)."""
    if session.get("logueado"):
        return redirect(url_for("panel"))

    error = None
    if request.method == "POST":
        usuario = request.form.get("usuario", "").strip()
        clave = request.form.get("clave", "")
        if usuario == USUARIO_POR_DEFECTO and clave == CLAVE_POR_DEFECTO:
            session["logueado"] = True
            session["usuario"] = usuario
            destino = request.args.get("next") or url_for("panel")
            return redirect(destino)
        error = (
            "Credenciales incorrectas. "
            "Uso la cuenta predeterminada: admin / 1234."
        )
    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    """Cierra la sesión iniciada."""
    session.clear()
    return redirect(url_for("login"))


# ---------------------------------------------------------------------------
# Páginas (vistas) de los tres módulos
# ---------------------------------------------------------------------------

@app.route("/panel")
@login_requerido
def panel():
    """Panel principal: tarjetas de acceso a cada módulo."""
    return render_template("panel.html")


@app.route("/directo")
@login_requerido
def directo():
    """Módulo directo: construcción de proposiciones moleculares a FBF."""
    return render_template("directo.html")


@app.route("/inverso")
@login_requerido
def inverso():
    """Módulo inverso: parsing de una FBF a proposiciones moleculares."""
    return render_template("inverso.html")


@app.route("/ml")
@login_requerido
def ml():
    """Asistente inteligente: clasificador de FBF + NLP español a FBF."""
    return render_template("ml.html")


# ---------------------------------------------------------------------------
# API · Generador de proposiciones (compartido por los módulos)
# ---------------------------------------------------------------------------

@app.post("/api/generar")
@login_requerido
def api_generar():
    """Genera una proposición aleatoria (simple o molecular).

    El cliente indica en ``existentes`` qué símbolos ya están en uso (por
    ejemplo, los de las tarjetas del constructor) para que la proposición
    generada no colisione con las ya construidas.
    """
    datos = request.get_json(silent=True) or {}
    existentes = {str(s).lower() for s in datos.get("existentes", [])}
    permitidos = [s for s in ATOMOS_POOL if s not in existentes] or list(ATOMOS_POOL)

    try:
        generada = proposicion_aleatoria(permitidos)
    except Exception as e:                                 # pragma: no cover
        return jsonify(ok=False, error=f"No se pudo generar la proposición: {e}"), 500
    return jsonify(ok=True, **generada)


# ---------------------------------------------------------------------------
# API · Módulo directo
# ---------------------------------------------------------------------------

@app.post("/api/directo/agregar")
@login_requerido
def api_directo_agregar():
    """Añade una proposición atómica (símbolo + descripción).

    Body: ``{"simbolo": "p", "descripcion": "Llueve", "existentes": ["p", ...]}``
    """
    datos = request.get_json(silent=True) or {}
    simbolo = str(datos.get("simbolo", "")).strip()
    descripcion = str(datos.get("descripcion", "")).strip()
    existentes = datos.get("existentes", []) or []

    if not SIMBOLO_ATOMO_RE.match(simbolo) or len(simbolo) > 12:
        return jsonify(
            ok=False,
            error="El símbolo debe ser una letra (p, q, r…) opcionalmente "
                  "seguida de dígitos (p1, q2) y sin espacios.",
        )

    usados = {str(s).lower() for s in existentes}
    simbolo = simbolo.lower()
    if simbolo in usados:
        return jsonify(
            ok=False,
            error=f"El símbolo {simbolo!r} ya está en uso. "
                  "Bórralo de la lista para reutilizarlo.",
        )

    ast = AtomNode(simbolo)
    desc = {simbolo: descripcion} if descripcion else {}
    lectura = descripcion if descripcion else simbolo
    return jsonify(
        ok=True,
        formula=simbolo,
        lectura=lectura,
        descripcion=descripcion,
        descripciones=desc,
    )


@app.post("/api/directo/negar")
@login_requerido
def api_directo_negar():
    """Aplica la negación (¬) a una fórmula dada.

    Body: ``{"formula": "(p ∧ q)", "descripciones": {"p": "Llueve"}}``
    """
    datos = request.get_json(silent=True) or {}
    try:
        ast = parsear(datos.get("formula", ""))
    except FBFError as e:
        return jsonify(ok=False, error=str(e)), 400

    neg = NegNode(ast)
    desc = _parsear_descripciones(datos.get("descripciones"))
    return jsonify(
        ok=True,
        formula=a_cadena(neg),
        lectura=render_es(neg, desc),
        descripciones=desc,
    )


@app.post("/api/directo/combinar")
@login_requerido
def api_directo_combinar():
    """Combina dos fórmulas con un conectivo binario.

    Body: ``{"a": "p", "b": "q", "op": "→", "descripciones": {...}}``
    Devuelve la FBF canónica y su lectura en lenguaje natural.
    """
    datos = request.get_json(silent=True) or {}
    op = datos.get("op")
    if op not in OPERADORES_BINARIOS:
        return jsonify(ok=False, error=f"Conectivo binario no soportado: {op!r}"), 400

    try:
        izq = parsear(datos.get("a", ""))
        der = parsear(datos.get("b", ""))
    except FBFError as e:
        return jsonify(ok=False, error=str(e)), 400

    nodo = BinNode(op, izq, der)
    desc = _parsear_descripciones(datos.get("descripciones"))
    return jsonify(
        ok=True,
        formula=a_cadena(nodo),
        lectura=render_es(nodo, desc),
        descripciones=desc,
        atomos=atomos(nodo),
    )


# ---------------------------------------------------------------------------
# API · Módulo inverso
# ---------------------------------------------------------------------------

@app.post("/api/inverso")
@login_requerido
def api_inverso():
    """Analiza una FBF ingresada y devuelve su interpretación completa.

    Body: ``{"formula": "(p ∧ q) → ¬r", "asignaciones": "p: Llueve, ..."}``
    Respuesta: forma canónica, átomos, lectura en español, clasificación,
    tabla de verdad (con subfórmulas) y árbol sintáctico en HTML.
    """
    datos = request.get_json(silent=True) or {}
    try:
        ast = parsear(datos.get("formula", ""))
    except FBFError as e:
        return jsonify(ok=False, error=str(e)), 400

    desc = _parsear_descripciones(datos.get("asignaciones"))
    cls = clasificar(ast)

    return jsonify(
        ok=True,
        canonical=a_cadena(ast),
        atomos=atomos(ast),
        lectura=render_es(ast, desc),
        clase=cls["clase"],
        verdaderos=cls["verdaderos"],
        falsos=cls["falsos"],
        tabla=tabla_html(tabla_verdad_completa(ast)),
        arbol=arbol_html(ast),
    )


# ---------------------------------------------------------------------------
# API · Módulo de Machine Learning
# ---------------------------------------------------------------------------

@app.get("/api/ml/estado")
@login_requerido
def api_ml_estado():
    """Información del modelo entrenado (algoritmo, métricas, dataset).

    El entrenamiento es *lazy*: la primera llamada a este endpoint entrena
    el modelo y puede tardar unos segundos.
    """
    try:
        info = info_modelo()
    except Exception as e:                                   # pragma: no cover
        return jsonify(ok=False, error=f"No se pudo preparar el modelo: {e}"), 500
    return jsonify(ok=True, **info)


@app.post("/api/ml/clasificar")
@login_requerido
def api_ml_clasificar():
    """Predice la clase (Tautología/Contradicción/Contingencia) de una FBF.

    Body: ``{"formula": "p ∨ ¬p"}``
    """
    datos = request.get_json(silent=True) or {}
    try:
        resultado = obtener_modelo().predecir(datos.get("formula", ""))
    except FBFError as e:
        return jsonify(ok=False, error=str(e)), 400

    item = {
        "clase": resultado["clase"],
        "probabilidades": resultado["probabilidades"],
    }
    if "k" in resultado:
        item["k"] = resultado["k"]
    return jsonify(ok=True, **item)


@app.post("/api/ml/nlp")
@login_requerido
def api_ml_nlp():
    """Convierte una oración en español a su representación simbólica FBF.

    Body: ``{"oracion": "Llueve y hace frío",
             "asignaciones": "p: Llueve, q: Hace frío"}``
    Además de la FBF devuelve la clase predicha por el modelo.
    """
    datos = request.get_json(silent=True) or {}
    try:
        simbolos = parsear_asignaciones(datos.get("asignaciones", ""))
        fbf = oracion_a_fbf(datos.get("oracion", ""), simbolos)
        ast = parsear(fbf)
        resultado = obtener_modelo().predecir(fbf)
    except FBFError as e:
        return jsonify(ok=False, error=str(e)), 400

    return jsonify(
        ok=True,
        fbf=fbf,
        lectura=render_es(ast, simbolos),
        clase=resultado["clase"],
        probabilidades=resultado["probabilidades"],
    )


@app.post("/api/ml/reentrenar")
@login_requerido
def api_ml_reentrenar():
    """Re-entrena el modelo con ``n`` instancias nuevas (por defecto 1500)."""
    datos = request.get_json(silent=True) or {}
    try:
        n = int(datos.get("n", 1500))
    except (TypeError, ValueError):
        n = 1500
    n = max(150, min(n, 5000))                     # límite de seguridad
    try:
        metricas = reentrenar(n)
    except Exception as e:                         # pragma: no cover
        return jsonify(ok=False, error=f"Falló el reentrenamiento: {e}"), 500
    return jsonify(ok=True, metricas=metricas)


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True, port=5000)