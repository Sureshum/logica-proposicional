# Propositional Logic System

[![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=fff)](#) [![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)](#)  [![HTML](https://img.shields.io/badge/HTML-%23E34F26.svg?logo=html5&logoColor=white)](#) [![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-%2338B2AC.svg?logo=tailwind-css&logoColor=white)](#)

A Flask web application to study and practice **Propositional Logic**: building
Well-Formed Formulas (WFF), semantic analysis with truth tables, and a
**Machine Learning** assistant that classifies propositions and translates
natural language into logical symbols.

> Default account: `admin` / `1234`

There are **two running versions** of the same system:

1. **Flask web app** (this repo's root): Python backend + HTML/JS frontend.
2. **100% browser version** (the `web/` folder): all the logic ported to
   JavaScript, deployed to **GitHub Pages** (no server, no login).

---

## 1. What the system does

Three main modules:

| Module | What it does | Route |
|--------|--------------|-------|
| **Direct** | Builds WFFs step by step: you define propositions (p="It rains") and combine them with connectives (¬ ∧ ∨ → ↔). | `/directo` |
| **Inverse** | You type a ready-made WFF and the system breaks it down: canonical form, atoms, natural-language reading, classification, truth table and syntax tree. | `/inverso` |
| **AI Assistant** | Predicts whether a WFF is a Tautology / Contradiction / Contingency and translates Spanish sentences ("Llueve y hace frío") into symbolic form via NLP. | `/ml` |

The whole app is **web-based**: the logic lives in Python (Flask) and the UI
uses HTML + Tailwind + JavaScript with a **pixel art** theme (retro 8-bit).

---

## 2. Project structure

```
logica-proposicional/
├── app.py                     # Flask server: routes (pages + JSON API)
├── requirements.txt           # Dependencies
├── logica/                    # DOMAIN: pure propositional logic
│   ├── parser.py              # Tokenizer + recursive descent parser (AST)
│   ├── semantica.py           # Evaluation, truth tables and classification
│   └── generador.py           # Random WFF generator (ML dataset)
├── ml/                        # MACHINE LEARNING
│   ├── features.py            # Syntactic feature vector of a WFF
│   ├── dataset.py             # Training dataset construction (X, y)
│   ├── modelo.py              # RandomForest (scikit-learn) or pure k-NN (fallback)
│   └── nlp.py                 # Spanish → WFF translation by rules (NLP)
├── templates/                 # HTML templates (Jinja2)
│   ├── base.html              # Base layout (nav, virtual assistant, footer)
│   ├── login.html / panel.html / directo.html / inverso.html / ml.html
├── static/
│   ├── css/estilos.css        # Pixel art theme + BOOLE assistant styles
│   └── js/
│       ├── app.js             # Shared JS utilities (esc, apiFetch)
│       └── asistente.js       # BOOLE virtual assistant (per-page guide)
└── data/                      # (optional persistence)
```

**Request flow:**

```
Browser (HTML/JS)  →  fetch to /api/*  →  app.py (Flask)
                                            ├─ logica.parser    (validate/parse)
                                            ├─ logica.semantica (truth tables/class)
                                            ├─ logica.generador (random)
                                            └─ ml.*             (predict/NLP)
                                            → JSON → Browser renders
```

---

## 3. Key concepts before reading the code

- **Atomic proposition**: a variable (p, q, r…) with a meaning like "It rains".
- **WFF (Well-Formed Formula)**: a proposition built from atoms and logical
  connectives with correct parentheses. E.g.: `(p ∧ q) → ¬r`.
- **AST**: Abstract Syntax Tree. Every WFF becomes a tree of nodes
  (`AtomNode`, `NegNode`, `BinNode`) so it can be evaluated.
- **Connectives** and their precedence (highest to lowest): **¬** < **∧** < **∨** < **→** < **↔**.
- **Tautology**: always true (`p ∨ ¬p`). **Contradiction**: always false
  (`p ∧ ¬p`). **Contingency**: depends on the assignment (`p → q`).

---

## 4. The `logica` module (pure domain; doesn't touch Flask or HTML)

### `logica/parser.py` — syntactic analysis

Converts text into an AST and validates it. Key functions:

| Function | What it does |
|----------|--------------|
| `parsear(texto)` | Tokenizes and parses a string. Returns the **AST** or raises `FBFError`. It's the module's entry point. |
| `es_fbf(texto)` | `parsear` wrapper returning `True`/`False` without raising. |
| `_canonicalizar(texto)` | Maps ASCII aliases (`=>`, `&`, `~`…) to Unicode symbols (`→`, `∧`, `¬`). |
| `_tokenizar(texto)` | Splits text into `(type, value)` tokens: `PAREN`, `OP`, `ATOM`. |
| `a_cadena(nodo)` | Serializes the AST back to canonical form (no redundant parentheses). |
| `atomos(nodo)` | Lists the atomic propositions (no duplicates, in order of appearance). |
| `render_es(nodo, nombres)` | Reads the formula in Spanish: with `{p: "llueve"}` it produces "no llueve", "(llueve y hace frío)"… |
| `arbol_html(nodo)` | Generates the syntax-tree HTML for the UI. |
| `profundidad(nodo)` / `contar_nodos(nodo)` | Tree metrics (used as ML features). |

**How parsing works** (EBNF grammar via *recursive descent*):

```
fbf      := bicond
bicond   := cond  ( '↔' cond )*
cond     := disj  ( '→' disj )*
disj     := conj  ( '∨' conj )*
conj     := neg   ( '∧' neg )*
neg      := ( '¬' )* primario
primario := '(' fbf ')' | ATOMO
```

Each rule is a method of the `_Parser` class (`_bicond`, `_cond`, `_disj`, `_conj`,
`_neg`, `_primario`). The `fbf()` method starts with the **lowest-precedence** rule
(biconditional) and descends. Parentheses jump to the `primario` rule, which calls
`fbf()` again (recursion).

### `logica/semantica.py` — evaluation and classification

| Function | What it does |
|----------|--------------|
| `evaluar(nodo, asignacion)` | Evaluates the AST with `True/False` values for each atom. Implements the truth tables for ¬ ∧ ∨ → ↔. |
| `tabla_verdad(nodo)` | Iterates over the **Cartesian product** of all assignments and stores the results. |
| `tabla_verdad_completa(nodo)` | Same but with **one column per subformula** (for the UI). |
| `clasificar(nodo)` | Based on the values: 0 false → **Tautology**; 0 true → **Contradiction**; otherwise → **Contingency**. |
| `tabla_html(datos)` | Renders the truth table as HTML. |

Important detail: `MAX_ATOMOS_TABLA = 5`, because the table grows as `2^n` rows;
with more than 5 atoms the table is omitted and the class becomes "Not determinable".

Operators (in `evaluar`):

```python
izq ∧ der  →  izq and der
izq ∨ der  →  izq or der
izq → der  →  (not izq) or der      # only fails on V → F
izq ↔ der  →  izq == der
```

### `logica/generador.py` — random WFFs (ML dataset)

| Function | What it does |
|----------|--------------|
| `proposicion_aleatoria(simbolos)` | Random proposition for practice (with meanings and reading). |
| `generar_instancia(categoria)` | Generates **one** WFF labeled with its real class (confirmed via its truth table). |
| `generar_dataset(n, semilla)` | **Balanced** dataset (~n/3 per class). Key trick: tautologies are built as `F ∨ ¬F` and contradictions as `F ∧ ¬F`. |
| `resumen_dataset(datos)` | Count per class (to display in the UI). |

---

## 5. The `ml` module (Machine Learning)

**Complete pipeline:**

```
generator (labeled WFFs)
   → features (numeric vector per formula)
   → dataset (X, y, 80/20 split)
   → model (RandomForest or k-NN)
   → prediction ("Tautology" + probabilities)
```

### `ml/features.py` — features

`extraer_caracteristicas(nodo)` returns a **12-number vector** describing the
*shape* of the formula (without evaluating its truth table), e.g.:

- number of variables, negations, ∧, ∨, →, ↔,
- tree depth and node count,
- **complementary pairs**: how many variables appear both as `A` and `¬A`
  (key: `A ∧ ¬A` → contradiction; `A ∨ ¬A` → tautology),
- negation ratio.

### `ml/dataset.py` — training data

- `CLASES` / `CLASE_A_INDICE`: text ↔ index mapping (Contradiction=0, Contingency=1, Tautology=2).
- `construir_dataset(n, semilla)`: generates the dataset, performs the
  **train/test** 80/20 split (reproducible by seed) and returns `X_train, y_train, X_test, y_test`.

### `ml/modelo.py` — the classifier

System with **two interchangeable engines** (same interface):

| Engine | When | How it works |
|--------|------|--------------|
| **Random Forest** (`RandomForestClassifier`, 200 trees) | If `scikit-learn` is installed | Ensemble of decision trees. |
| **Own k-NN** (`_KNN` class, k=5) | If NOT installed | Nearest neighbors in pure Python, with **z-score normalization** of features. |

Public functions:

| Function | What it does |
|----------|--------------|
| `ModeloFBF.entrenar(data)` | Trains the model and computes metrics (accuracy, precision, recall, F1 per class). |
| `ModeloFBF.predecir(formula)` | Classifies a **text WFF** and returns `{clase, probabilidades}`. |
| `predecir_vector(vector)` | Same but from already-computed features. |
| `reentrenar(n, semilla)` | Builds a new dataset and retrains. |
| `obtener_modelo()` | **Lazy** model: trained on first call and cached in memory. |
| `info_modelo()` | Data for the UI (algorithm used, metrics, dataset size). |

### `ml/nlp.py` — Spanish → WFF by rules

| Function | What it does |
|----------|--------------|
| `oracion_a_fbf(oracion, simbolos)` | Entry point: normalizes, substitutes meanings for symbols, detects connectives and validates with the parser. |
| `_traducir(oracion)` | Translates **recursively**: first explicit parentheses, then ↔, then "if…then" →, then ∨, then ∧, then "not" → ¬. |
| `parsear_asignaciones(texto)` | Converts `"p: Llueve, q: Hace frío"` into `{"p": "llueve", ...}`. |

---

## 6. `app.py` — the Flask server

`app.py` separates **pages** (HTML) from **APIs** (JSON, consumed with `fetch`).
All `/api/*` routes require a session (`@login_requerido`).

**Pages:**

| Route | Function | Serves |
|-------|----------|--------|
| `/` | `inicio()` | Redirects to panel or login depending on session |
| `/login` (GET/POST) | `login()` | Authentication (admin/1234) |
| `/logout` | `logout()` | Closes session |
| `/panel`, `/directo`, `/inverso`, `/ml` | `panel`, `directo`, `inverso`, `ml` | Renders each template |

**APIs (JSON):**

| Endpoint | Function | Use |
|----------|----------|-----|
| `POST /api/generar` | `api_generar` | Generates a random proposition (avoids collisions with symbols in use) |
| `POST /api/directo/agregar` | `api_directo_agregar` | Validates and adds a simple proposition |
| `POST /api/directo/negar` | `api_directo_negar` | Applies `¬` to a formula |
| `POST /api/directo/combinar` | `api_directo_combinar` | Combines A and B with a connective `(∧ ∨ → ↔)` |
| `POST /api/inverso` | `api_inverso` | Analyzes a complete WFF (canonical, atoms, class, table, tree) |
| `GET /api/ml/estado` | `api_ml_estado` | Info about the trained model |
| `POST /api/ml/clasificar` | `api_ml_clasificar` | Predicts the class of a WFF |
| `POST /api/ml/nlp` | `api_ml_nlp` | Translates a sentence into a WFF and classifies it |
| `POST /api/ml/reentrenar` | `api_ml_reentrenar` | Retrains with N new instances |

---

## 8. Browser-only version (`web/`) + GitHub Pages

The same system also exists as a **100% static** version. Every logic module was
ported to JavaScript, so it runs entirely in the browser and can be hosted
anywhere that serves static files — e.g. **GitHub Pages**.

> Deployed site: **<https://Sureshum.github.io/logica-proposicional/>**

### Structure

```
web/                          # static site root (what GitHub Pages serves)
├── index.html                # panel (same as /panel)
├── directo.html              # Direct module
├── inverso.html              # Inverse module
├── ml.html                   # AI Assistant
└── assets/
    ├── css/estilos.css       # pixel-art theme (same as the Flask version)
    └── js/
        ├── parser.js         # LogicaParser  (port of logica/parser.py)
        ├── semantica.js      # Semantica     (port of logica/semantica.py)
        ├── generador.js      # Generador     (port of logica/generador.py)
        ├── nlp.js            # Nlp           (port of ml/nlp.py)
        ├── ml.js             # ML            (features + balanced dataset + k-NN, port of ml/*)
        ├── app.js            # shared esc()
        └── asistente.js      # BOOLE assistant (same as Flask version)
```

### Deploy to GitHub Pages

The workflow `.github/workflows/pages.yml` runs on every push to `master`,
uploads the `web/` folder and publishes it. The Pages **source** is
**GitHub Actions** (`build_type=workflow`).

One-time setup (already done for this repo):

```bash
gh api -X PUT /repos/Sureshum/logica-proposicional/pages -f build_type=workflow
```

Manual alternative: *Settings → Pages → Source: "GitHub Actions"*.

To test the static version locally:

```bash
python -m http.server 8000 --directory web   # http://localhost:8000
```

---

## 9. How to run it (Flask version)

```bash
pip install -r requirements.txt        # only Flask is required
python app.py                          # server at http://localhost:5000
```

- Without `scikit-learn` the ML still works via the **own k-NN** (no external dependencies).
- If you install `scikit-learn` you'll automatically use Random Forest.

---

<a href="https://github.com/Sureshum">
  <img src="https://media1.tenor.com/m/ki07u04jVnwAAAAC/gigi-murin-hololive-english.gif" width="100%" alt="Header Banner" />
</a>
   
