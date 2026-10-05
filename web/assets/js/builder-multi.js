"use strict";

(function(global){
  let modoMulti = false;
  let seleccion = new Set();

  function el(id){ return document.getElementById(id); }

  global.BuilderMulti = {
    init: function(){
      this.renderToggle();
    },
    renderToggle: function(){
      const cont = el('multi-toggle');
      if(!cont) return;
      cont.innerHTML = '<label class="flex items-center gap-2 text-sm"><input type="checkbox" id="chk-multi"> Modo selección múltiple (combinar N)</label>';
      el('chk-multi').onchange = function(){
        modoMulti = this.checked;
        seleccion.clear();
        const bar = el('multi-bar');
        if(bar) bar.classList.toggle('hidden', !modoMulti);
        renderTodo();
      };
      const bar = document.createElement('div');
      bar.id = 'multi-bar';
      bar.className = 'hidden mt-3 border-2 border-emerald-300 bg-emerald-50 p-3 flex flex-wrap items-center gap-2';
      bar.innerHTML = `
        <span class="text-xs text-emerald-700">Seleccionadas: <span id="multi-count">0</span></span>
        <button class="btn-insertar" onclick="BuilderMulti.combinar('∧')">Combinar ∧</button>
        <button class="btn-insertar" onclick="BuilderMulti.combinar('∨')">Combinar ∨</button>
        <button class="btn-insertar" onclick="BuilderMulti.combinar('→')">Combinar →</button>
        <button class="btn-insertar" onclick="BuilderMulti.combinar('↔')">Combinar ↔</button>
        <button class="btn-insertar" onclick="BuilderMulti.limpiar()">Limpiar selección</button>
      `;
      const sec = el('panel-multi');
      if(sec) sec.appendChild(bar);
    },
    toggle: function(id){
      if(!modoMulti) return false;
      if(seleccion.has(id)) seleccion.delete(id); else seleccion.add(id);
      el('multi-count').textContent = seleccion.size;
      renderTodo();
      return true;
    },
    limpiar: function(){
      seleccion.clear();
      el('multi-count').textContent = '0';
      renderTodo();
    },
    combinar: async function(op){
      if(seleccion.size < 2){ App.toast('Selecciona al menos 2 tarjetas', 'error'); return; }
      const lista = tarjetas.filter(t=>seleccion.has(t.id));
      if(lista.length<2){ App.toast('Selecciona al menos 2 tarjetas', 'error'); return; }
      let nodo = LogicaParser.parsear(lista[0].formula);
      for(let i=1;i<lista.length;i++){
        nodo = new LogicaParser.BinNode(op, nodo, LogicaParser.parsear(lista[i].formula));
      }
      const desc = herramientas().unirDescripciones(lista);
      /* Se reutiliza el alta centralizada para respetar los límites del
         administrador y registrar la tarjeta en el historial. */
      const creado = await crearTarjeta({
        formula: LogicaParser.aCadena(nodo),
        lectura: LogicaParser.renderEs(nodo, desc),
        descripciones: desc,
        tipo: 'combinacion_multi'
      });
      if(!creado) return;
      BuilderMulti.limpiar();
      if(typeof mostrarEstado==='function') mostrarEstado('Combinadas '+lista.length+' con '+op, 'green');
    },
    getSeleccion: function(){ return new Set(seleccion); },
    estaSeleccionado: function(id){ return seleccion.has(id); },
    enModoMulti: function(){ return modoMulti; }
  };
})(window);
