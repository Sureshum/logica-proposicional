# Propositional Logic System

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)](#)  [![HTML](https://img.shields.io/badge/HTML-%23E34F26.svg?logo=html5&logoColor=white)](#) [![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-%2338B2AC.svg?logo=tailwind-css&logoColor=white)](#)

Sistema web para estudiar y practicar **Lógica Proposicional**: construcción de
Fórmulas Bien Formadas (FBF), análisis semántico con tablas de verdad y un
**asistente de Machine Learning** que clasifica proposiciones y traduce español
a símbolos lógicos.

> **Una sola versión:** todo corre en el navegador (HTML + CSS + JavaScript).
> No hay servidor, ni Python, ni base de datos. Se despliega en **GitHub Pages**.

- Sitio publicado: <https://Sureshum.github.io/logica-proposicional/>
- Cuenta por defecto: **`admin` / `1234`** (también puedes crear la tuya en *REGISTRO*).

---

## 1. Módulos

| Módulo | Qué hace | Página |
|--------|----------|--------|
| **Directo** | Construyes FBF paso a paso: defines proposiciones (p = "Llueve") y las combinas con conectivos (¬ ∧ ∨ → ↔). | `directo.html` |
| **Inverso** | Escribes una FBF y el sistema la desarma: forma canónica, átomos, lectura en español, clasificación, tabla de verdad y árbol sintáctico. | `inverso.html` |
| **Asistente IA** | Predice si una FBF es Tautología / Contradicción / Contingencia y traduce oraciones ("Llueve y hace frío") a forma simbólica. | `ml.html` |

Todo con estética **pixel art** (retro 8-bit) y el asistente virtual **BOOLE**.

---

## 2. Estructura del proyecto

```
web/                          # raíz del sitio (lo que publica GitHub Pages)
├── index.html                # panel principal (protegido con sesión)
├── login.html                # acceso · con fondo espacial animado
├── registro.html             # alta de cuenta local
├── directo.html              # módulo directo
├── inverso.html              # módulo inverso
├── ml.html                   # asistente de Machine Learning
└── assets/
    ├── favicon.svg           # carita pixel de BOOLE
    ├── css/estilos.css       # tema pixel art, fondo espacial y estilos de BOOLE
    └── js/
        ├── parser.js         # LogicaParser  (tokenizador + parser descendente)
        ├── semantica.js      # Semantica     (evaluación, tablas de verdad, clasificación)
        ├── generador.js      # Generador     (FBF aleatorias para el dataset)
        ├── nlp.js            # Nlp           (español → FBF por reglas)
        ├── ml.js             # ML            (características + dataset + k-NN)
        ├── auth.js           # Auth          (cuentas y sesión en localStorage)
        ├── portal.js         # lógica de los formularios de acceso y registro
        ├── app.js            # utilidades (esc)
        └── asistente.js      # BOOLE (asistente con expresiones)
```

Cada módulo JS se publica en el ámbito global (`window.LogicaParser`,
`window.Semantica`, `window.Generador`, `window.Nlp`, `window.ML`, `window.Auth`),
así que las páginas llaman directamente a la lógica, sin peticiones HTTP.

---

## 3. Acceso y registro (100% local)

`assets/js/auth.js` implementa las cuentas **en el navegador**:

| Función | Qué hace |
|---------|----------|
| `Auth.registrar({nombre, usuario, clave, repetir})` | Valida (mín. 3 caracteres de usuario, mín. 4 de clave, claves iguales, usuario único), crea la cuenta y abre sesión. |
| `Auth.entrar(usuario, clave)` | Comprueba la clave y guarda la sesión. |
| `Auth.salir()` | Borra la sesión. |
| `Auth.sesion()` / `Auth.usuarioActual()` | Lee la sesión activa. |
| `Auth.protegerPagina()` | Si no hay sesión, redirige a `login.html?volver=<página>` (y recuerda a dónde volver). |

- Las cuentas viven en `localStorage` (`logica.usuarios`) y la sesión en
  `logica.sesion`.
- Las claves **no se guardan en claro**: se almacena su hash SHA-256
  (`crypto.subtle`, con alternativa por si el navegador no lo soporta).
- `auth.js` siembra la cuenta `admin / 1234` la primera vez.
- Cada página protegida incluye en el `<head>`:
  `Auth.protegerPagina()` → si no hay sesión, redirige antes de pintar nada.
- La barra superior muestra `@usuario` y el botón **SALIR**.

> Ojo: al no haber servidor, la "seguridad" es la de un candado de juguete —
> sirve para organizar el trabajo, no para proteger datos sensibles.

### Fondo espacial del acceso

`login.html` y `registro.html` llevan un fondo animado y lento (nada de
parpadeos): tres capas de estrellas a la deriva (`background-position` en
220 s / 360 s / 620 s), tres nebulosas con `blur` que vagan, un planeta con
anillo y una luna, estrellas fugaces y una viñeta. Con
`prefers-reduced-motion: reduce` todo se detiene.

---

## 4. El asistente BOOLE

`assets/js/asistente.js` crea el muñeco de la esquina inferior derecha.

**Solo se abre si lo pulsas.** No hay auto-apertura: el panel permanece
cerrado hasta que pulsas su cabeza (o el cartel de invitación, que desaparece
solo a los 14 s). El rótulo del panel (`EN LINEA`, `PENSANDO...`…) acompaña al
estado de la cara.

### Expresiones

| Expresión | Cuándo | Cómo se ve |
|-----------|--------|------------|
| `idle` | En reposo | Ojos con **parpadeo doble** automático (5,4 s) y neutros. |
| `piensa` | Mientras escribe el texto letra a letra | Pupilas hacia arriba, boca pequeña y nube de puntos sobre la cabeza. |
| `feliz` | Al terminar el saludo / al responderte | Ojos en arco `^ ^` y sonrisa escalonada. |
| `preocupado` | Al cerrar el panel | Ojos caídos, boca invertida y gota de sudor. |
| `sorprendido` | Gesto suelto en reposo (cada 9–18 s) | Ojos grandes y boca en `O`. |

Las expresiones se controlan con clases en el botón
(`expr-feliz`, `expr-piensa`, `expr-sorprendido`, `expr-preocupado`) y se dibujan
solo en CSS. Con `prefers-reduced-motion` se anulan parpadeos y gestos.

El guion (saludo, pasos y consejos rápidos) cambia según la página gracias al
atributo `data-pagina` del `<body>`: `login`, `registro`, `panel`, `directo`,
`inverso` y `ml`.

---

## 5. Lógica y Machine Learning (en JavaScript)

### `parser.js` — análisis sintáctico

`LogicaParser.parsear(texto)` devuelve el **AST** o lanza error. También
`aCadena(nodo)`, `atomos(nodo)`, `renderEs(nodo, nombres)`, `arbolHtml(nodo)`,
`profundidad` y `contar_nodos`.

```
fbf      := bicond
bicond   := cond  ( '↔' cond )*
cond     := disj  ( '→' disj )*
disj     := conj  ( '∨' conj )*
conj     := neg   ( '∧' neg )*
neg      := ( '¬' )* primario
primario := '(' fbf ')' | ATOMO
```

Acepta también los alias ASCII: `~`, `&`, `|`, `=>`, `<=>`.

### `semantica.js` — semántica

`Semantica.evaluar(nodo, asignacion)`, `tablaVerdad(nodo)`,
`tablaVerdadCompleta(nodo)`, `clasificar(nodo)` y `tablaHtml(datos)`.
Límite de 5 átomos por tabla (2ⁿ filas).

### `ml.js` — clasificador

1. `features`: vector de 12 números (nº de variables, negaciones, cada
   conectivo, profundidad, nodos, parejas complementarias `A`/`¬A`, ratio de
   negaciones).
2. `dataset`: ~1000 FBF **balanceadas** generadas con semilla 42. Las
   tautologías se construyen como `F ∨ ¬F` y las contradicciones como `F ∧ ¬F`.
3. `modelo`: **k-NN (k=5)** con normalización z-score, propio y en JS.
4. Entrenamiento **perezoso**: la primera llamada a `ML.info()` o
   `ML.predecir()` entrena en memoria; `ML.reentrenar(n)` rehace el dataset.

### `nlp.js` — español → FBF

```
"p si y solo si q" → p ↔ q
"si p entonces q"  → p → q
"p solo si q"      → p → q
"y" → ∧   "o" → ∨   "no" → ¬
```

---

## 6. Ejecutar en local

```bash
python -m http.server 8000 --directory web    # http://localhost:8000
```

También vale cualquier servidor estático (VS Code Live Server, `npx serve web`).
Abre `http://localhost:8000/`: entrarás al login. Entra con `admin` / `1234` o
crea una cuenta.

> Abrir `index.html` con doble clic (protocolo `file://`) **no funciona**: el
> login necesita `localStorage` y un origen web.

---

## 7. Desplegar en GitHub Pages

El workflow `.github/workflows/pages.yml` sube la carpeta `web/` en cada push a
`master` y publica el sitio. Configuración una sola vez:

```bash
gh api -X PUT /repos/Sureshum/logica-proposicional/pages -f build_type=workflow
```

Alternativa manual: *Settings → Pages → Source: "GitHub Actions"*.

---

## 8. Ideas para estudiar / extender

1. **Más conectivos** (NAND `↑`, NOR `↓`): toca `SIMBOLOS`, los nombres de
   operadores, la gramática de `parser.js` y `evaluar` en `semantica.js`.
2. **Reglas de inferencia** (Modus Ponens…): recorre el AST con
   `LogicaParser.parsear` y reconstruye con `NegNode` / `BinNode`.
3. **Más características ML**: añade una columna al vector de `features.js`; el
   dataset y el modelo la adoptan solos.
4. **De Morgan**: transforma el AST (`¬(p ∧ q)` → `¬p ∨ ¬q`) recorriéndolo y
   reconstruyéndolo.
5. **Borrar la cuenta**: `localStorage.removeItem("logica.usuarios")` desde la
   consola del navegador.

---

<a href="https://github.com/Sureshum">
  <img src="https://media1.tenor.com/m/ki07u04jVnwAAAAC/gigi-murin-hololive-english.gif" width="100%" alt="Header Banner" />
</a>
