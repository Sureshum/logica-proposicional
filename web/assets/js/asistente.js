
(function () {
  "use strict";

  var PAGINA = (document.body && document.body.getAttribute("data-pagina")) || "";


  var GUION = {
    login: {
      saludo: "¡Hola! Soy BÓOLE, tu guía 8-bits. Esto es la puerta de acceso del sistema.",
      pasos: [
        "Escribe tu usuario y tu clave, y pulsa ENTRAR AL SISTEMA.",
        "¿Primera vez aquí? Pulsa CREAR CUENTA y rellena nombre, usuario y clave.",
        "Si solo quieres mirar, usa la cuenta de prueba: admin / 1234.",
      ],
      consejos: [
        {
          texto: "¿Dónde se guarda mi cuenta?",
          msg: "En este navegador, en localStorage. No hay servidor: nadie más ve tus datos.",
        },
        {
          texto: "¿Cuenta por defecto?",
          msg: "El sistema trae admin / 1234. Si prefieres, crea tu propia cuenta en REGISTRO.",
        },
        {
          texto: "¿Qué hay dentro?",
          msg: "Tres módulos: construir FBF (Directo), analizar FBF (Inverso) y un asistente de Machine Learning.",
        },
      ],
    },
    registro: {
      saludo: "¡Vamos a crear tu cuenta! Tarda menos que un comando de salto en un videojuego.",
      pasos: [
        "El nombre es opcional: es lo que veras saludado dentro del sistema.",
        "El usuario necesita al menos 3 caracteres y no puede tener espacios.",
        "La clave necesita al menos 4 caracteres y hay que repetirla igual.",
        "Al pulsar CREAR CUENTA Y ENTRAR entras directo al panel principal.",
      ],
      consejos: [
        {
          texto: "¿Y si ya tengo cuenta?",
          msg: "Entonces vuelve al acceso con el boton de abajo. El usuario admin / 1234 siempre existe.",
        },
      ],
    },
    panel: {
      saludo: "¡Bienvenido! Este es el cuartel general: desde aquí saltas a los 3 módulos.",
      pasos: [
        "Módulo DIRECTO: defines proposiciones simples y las combinas con conectivos para construir una FBF.",
        "Módulo INVERSO: pegas una FBF y el sistema la interpreta (tabla de verdad, árbol, clasificación).",
        "ASISTENTE IA: clasifica proposiciones y traduce español a símbolos con Machine Learning.",
        "Abajo tienes un vistazo de los símbolos lógicos que usa todo el sistema.",
      ],
      consejos: [
        {
          texto: "¿Qué es una FBF?",
          msg: "Una Fórmula Bien Formada: proposiciones atómicas unidas por conectivos (¬, ∧, ∨, →, ↔) con paréntesis correctos.",
        },
        {
          texto: "¿Por dónde empiezo?",
          msg: "Te recomiendo el Módulo Directo primero: es el que mejor enseña cómo se construye una fórmula.",
        },
        {
          texto: "¿Qué hace cada conectivo?",
          msg: "¬ niega, ∧ es 'y', ∨ es 'o', → es 'si... entonces' y ↔ es 'si y solo si'. Míralos en la tabla inferior.",
        },
      ],
    },
    directo: {
      saludo: "¡Estás en el taller! Aquí construyes fórmulas paso a paso, como un puzzle.",
      pasos: [
        "PASO 1 · Escribe una variable (p, q...) y su significado (ej. p = Llueve) y pulsa + AÑADIR.",
        "PASO 2 · Con ⚡ GENERAR puedes pedir una proposición aleatoria lista para usar.",
        "PASO 3 · En cada tarjeta pulsa A y B para elegir qué vas a combinar.",
        "PASO 4 · Usa los botones de conectivos: ¬ niega A, y ∧ ∨ → ↔ combinan A con B.",
        "La FBF resultante aparece arriba con su lectura en español.",
      ],
      consejos: [
        {
          texto: "¿A y B son obligatorias?",
          msg: "Para combinar necesitas dos tarjetas DISTINTAS: pulsa A en una y B en la otra.",
        },
        {
          texto: "¿Cómo funciona ¬?",
          msg: "Niega la tarjeta A (o la más reciente si no eliges ninguna). Cada tarjeta guarda su lectura.",
        },
        {
          texto: "¿Para qué sirve ⚡ Generar?",
          msg: "Crea al azar una proposición simple o molecular y la añade como tarjeta, perfecta para practicar.",
        },
      ],
    },
    inverso: {
      saludo: "¡Buena elección! Aquí escribes una fórmula y el sistema la disecciona por completo.",
      pasos: [
        "Escribe una FBF en el campo (ej. (p ∧ q) → ¬r). Puedes usar los botones de símbolos.",
        "Opcional: indica el significado de cada letra, p: Llueve, q: Hace frío.",
        "Pulsa ANALIZAR FBF y obtendrás: forma canónica, átomos e interpretación en español.",
        "Además verás la clasificación, la tabla de verdad y el árbol sintáctico.",
        "Carga ejemplos o genera una fórmula aleatoria con ⚡ para probar al instante.",
      ],
      consejos: [
        {
          texto: "¿Qué es una Tautología?",
          msg: "Una fórmula siempre verdadera, pase lo que pase (p ∨ ¬p). El sistema lo colorea en verde.",
        },
        {
          texto: "¿Qué es la tabla de verdad?",
          msg: "Prueba todas las combinaciones posibles de verdadero/falso de sus letras y muestra el resultado final.",
        },
        {
          texto: "¿Los símbolos unicode?",
          msg: "Acepta ¬ ∧ ∨ → ↔ y también sus versiones ASCII: ~ & | => <=>. Todos valen.",
        },
      ],
    },
    ml: {
      saludo: "¡Aquí la máquina piensa por ti! Dos superpoderes: clasificar y traducir.",
      pasos: [
        "CLASIFICADOR: escribe una FBF (ej. p ∨ ¬p) y pulsa CLASIFICAR FÓRMULA.",
        "El modelo predice si es Tautología, Contradicción o Contingencia, con barras de confianza.",
        "LENGUAJE NATURAL → FBF: escribe una oración (Llueve y hace frío) y pulsa TRADUCIR A FBF.",
        "El sistema la convierte en símbolos y además la clasifica.",
        "Arriba puedes ver el estado del modelo y re-entrenarlo con ↻ RE-ENTRENAR.",
      ],
      consejos: [
        {
          texto: "¿Cómo aprende el modelo?",
          msg: "Usa características de la fórmula (nº de conectivos, negaciones, parejas A y ¬A) para adivinar su clase.",
        },
        {
          texto: "¿Qué significa re-entrenar?",
          msg: "Genera 1500 fórmulas nuevas y vuelve a entrenar desde cero. Tarda unos segundos.",
        },
        {
          texto: "¿Qué modelo usa esta versión?",
          msg: "Todo corre en JavaScript en tu navegador, sin servidor. El clasificador es k-NN (k=5).",
        },
      ],
    },
  };

  var porDefecto = {
    saludo: "¡Hola! Soy BÓOLE, tu guía de este sistema de lógica proposicional.",
    pasos: [
      "Usa la barra superior para navegar entre módulos.",
      "El módulo DIRECTO construye Fórmulas Bien Formadas.",
      "El módulo INVERSO las analiza (tabla de verdad, árbol...).",
      "El ASISTENTE IA las clasifica y traduce del español.",
    ],
    consejos: [
      { texto: "¿Quién soy?", msg: "Soy BÓOLE, un programa de ayuda. Pulsa los chips para obtener consejos rápidos." },
    ],
  };

  var guion = GUION[PAGINA] || porDefecto;

  var EXPRESIONES = ["feliz", "piensa", "sorprendido", "preocupado"];
  var ROTULO = {
    feliz: "★ DE BUEN HUMOR",
    piensa: "✦ PENSANDO...",
    sorprendido: "!! SORPRESA",
    preocupado: "? ALGO DUDOSO",
  };

  var boton = null;
  var rotulo = null;
  var finExpr = null;
  var finAlegre = null;
  var proximoGestito = null;

  function sinMovimiento() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }


  function construir() {
    var caja = document.createElement("div");
    caja.className = "asiste-caja";
    caja.innerHTML =
      '<div class="asiste-aviso" id="asiste-aviso">¡Hola! Soy BOOLE.<br>Pulsa mi cabeza.</div>' +
      '<button class="asiste-btn" id="asiste-btn" type="button" aria-label="Ayuda">' +
      '  <span class="asiste-cara">' +
      '    <span class="asiste-ojo izq"><i></i></span>' +
      '    <span class="asiste-ojo der"><i></i></span>' +
      '    <span class="asiste-boca"></span>' +
      '    <span class="asiste-pens"><i></i><i></i><i></i></span>' +
      "  </span>" +
      "</button>";
    document.body.appendChild(caja);


    var panel = document.createElement("aside");
    panel.className = "asiste-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML =
      '<div class="asiste-titulo">' +
      '  <span class="mini"><i></i><i></i></span>' +
      "  <span>" +
      "    <b>BOOLE</b><br>" +
      '    <span class="estado">&#9642; EN LINEA</span>' +
      "  </span>" +
      '  <button class="asiste-cerrar" id="asiste-cerrar" type="button" aria-label="Cerrar">X</button>' +
      "</div>" +
      '<div class="asiste-cuerpo">' +
      '  <div class="asiste-burbuja" id="asiste-burbuja"></div>' +
      '  <div class="asiste-pasos"><h4>&#9733; COMO FUNCIONA ESTA PAGINA</h4>' +
      "    <div id=\"asiste-pasos\"></div>" +
      "  </div>" +
      '  <div class="asiste-consejos"><h4>&#8986; CONSEJOS RAPIDOS</h4>' +
      "    <div id=\"asiste-consejos\"></div>" +
      "  </div>" +
      "</div>" +
      '<div class="asiste-pie"><span class="asiste-barra-vida"><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
      "BOOLE v1.1 - solo abro si me presionas la cabeza</div>";
    document.body.appendChild(panel);


    var pasos = document.getElementById("asiste-pasos");
    guion.pasos.forEach(function (paso, i) {
      var fila = document.createElement("div");
      fila.className = "asiste-paso";
      fila.innerHTML = '<span class="num">' + (i + 1) + "</span><span>" + paso + "</span>";
      pasos.appendChild(fila);
    });


    var chips = document.getElementById("asiste-consejos");
    guion.consejos.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "asiste-chip";
      b.textContent = c.texto;
      b.addEventListener("click", function () {
        escribirTexto(c.msg);
      });
      chips.appendChild(b);
    });


    var btn = document.getElementById("asiste-btn");
    var aviso = document.getElementById("asiste-aviso");
    var cerrar = document.getElementById("asiste-cerrar");

    boton = btn;
    rotulo = panel.querySelector(".estado");

    function ocultarAviso() {
      if (aviso) aviso.style.display = "none";
    }

    function abrir() {
      panel.classList.add("visible");
      panel.setAttribute("aria-hidden", "false");
      btn.classList.add("abierto");
      ocultarAviso();
      clearTimeout(proximoGestito);
      escribirTexto(guion.saludo);
    }
    function cerrarPanel() {
      panel.classList.remove("visible");
      panel.setAttribute("aria-hidden", "true");
      btn.classList.remove("abierto");
      expresion("preocupado", 1200);
      programarGestito();
    }

    btn.addEventListener("click", function () {
      if (panel.classList.contains("visible")) cerrarPanel();
      else abrir();
    });
    cerrar.addEventListener("click", cerrarPanel);
    if (aviso) {
      aviso.addEventListener("click", abrir);
      setTimeout(ocultarAviso, 14000);
    }

    programarGestito();
  }


  function expresion(nueva, ms) {
    if (!boton) return;
    clearTimeout(finExpr);
    EXPRESIONES.forEach(function (e) {
      boton.classList.remove("expr-" + e);
    });
    if (rotulo) rotulo.textContent = nueva ? ROTULO[nueva] : "▫ EN LINEA";
    if (!nueva) return;
    boton.classList.add("expr-" + nueva);
    if (ms) {
      finExpr = setTimeout(function () {
        expresion("");
      }, ms);
    }
  }


  function programarGestito() {
    clearTimeout(proximoGestito);
    if (sinMovimiento()) return;
    proximoGestito = setTimeout(function () {
      expresion(Math.random() < 0.55 ? "sorprendido" : "preocupado", 1100);
      programarGestito();
    }, 9000 + Math.random() * 9000);
  }


  function escribirTexto(texto) {
    var el = document.getElementById("asiste-burbuja");
    if (!el) return;
    el.innerHTML = "";
    var i = 0;
    var cursor = document.createElement("span");
    cursor.className = "asiste-cursor";
    cursor.textContent = "▌";
    el.appendChild(cursor);
    clearTimeout(finAlegre);
    expresion("piensa");
    var temporizador = setInterval(function () {
      if (i >= texto.length) {
        clearInterval(temporizador);
        cursor.remove();
        finAlegre = setTimeout(function () {
          expresion("feliz", 1100);
        }, 320);
        return;
      }
      cursor.insertAdjacentText("beforebegin", texto[i]);
      i += 1;
    }, 22);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", construir);
  } else {
    construir();
  }
})();