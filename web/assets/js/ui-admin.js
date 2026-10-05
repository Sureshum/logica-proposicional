"use strict";

(function (global) {
  const AdminUI = {
    async init() {
      await Storage.listo();
      const ajustes = await Storage.ajustesGetTodos({
        maxGenerar: 0,
        maxTarjetas: 0,
        permitirBorrarHistorial: true,
        tema: "claro"
      });
      this.render(ajustes);
      this.bind();
      App.aplicarTema(ajustes.tema);
      const sel = document.getElementById("admin-tema");
      if (sel) sel.value = ajustes.tema;
    },
    render(a) {
      const root = document.getElementById("panel-admin");
      if (!root) return;
      root.innerHTML = `
        <section class="caja p-4 mt-6">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 class="pixel-titulo text-slate-700">Panel Administrador</h2>
            <span class="text-xs text-slate-400">solo visible para admin</span>
          </div>
          <div class="grid md:grid-cols-2 gap-4">
            <div class="border border-dashed border-slate-300 p-3">
              <h3 class="font-semibold mb-2">Límites</h3>
              <label class="text-xs text-slate-500">Máx. proposiciones por "Generar todas" (0 = sin límite)</label>
              <input id="admin-max-generar" type="number" min="0" class="mt-1 w-full px-2 py-1 border border-slate-300" value="${a.maxGenerar||0}">
              <label class="text-xs text-slate-500 mt-2 block">Máx. tarjetas en construcción (0 = sin límite)</label>
              <input id="admin-max-tarjetas" type="number" min="0" class="mt-1 w-full px-2 py-1 border border-slate-300" value="${a.maxTarjetas||0}">
            </div>
            <div class="border border-dashed border-slate-300 p-3">
              <h3 class="font-semibold mb-2">Apariencia</h3>
              <label class="text-xs text-slate-500">Tema predeterminado</label>
              <select id="admin-tema" class="mt-1 w-full px-2 py-1 border border-slate-300">
                <option value="claro">Claro</option>
                <option value="oscuro">Oscuro</option>
                <option value="neon">Neón</option>
                <option value="retro">Retro</option>
                <option value="contraste">Alto contraste</option>
              </select>
              <button id="admin-aplicar-tema" class="btn-pixel btn-gris mt-2">Aplicar tema</button>
            </div>
            <div class="border border-dashed border-slate-300 p-3 md:col-span-2">
              <h3 class="font-semibold mb-2">Historial</h3>
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="admin-permitir-borrar" ${a.permitirBorrarHistorial!==false?'checked':''}> Permitir borrar historial a participante</label>
              <div class="flex flex-wrap gap-2 mt-2">
                <button id="admin-ver-historial" class="btn-pixel btn-azul">Ver historial</button>
                <button id="admin-limpiar-historial" class="btn-pixel btn-rojo">Limpiar historial</button>
              </div>
            </div>
          </div>
          <p class="text-xs text-slate-400 mt-3">Estos ajustes se guardan por dispositivo (IndexedDB/localStorage).</p>
        </section>
      `;
    },
    bind() {
      const root = document.getElementById("panel-admin");
      if (!root) return;
      root.querySelector("#admin-aplicar-tema").onclick = async function(){
        const v = root.querySelector("#admin-tema").value;
        await Storage.ajustesSet("tema", v);
        App.aplicarTema(v);
        App.toast("Tema aplicado", "ok");
      };
      root.querySelector("#admin-max-generar").onchange = async function(){
        await Storage.ajustesSet("maxGenerar", parseInt(this.value)||0);
      };
      root.querySelector("#admin-max-tarjetas").onchange = async function(){
        await Storage.ajustesSet("maxTarjetas", parseInt(this.value)||0);
      };
      root.querySelector("#admin-permitir-borrar").onchange = async function(){
        await Storage.ajustesSet("permitirBorrarHistorial", this.checked);
      };
      root.querySelector("#admin-ver-historial").onclick = async function(){
        const lista = await Storage.historialListar(100);
        let html = '<div class="max-h-[60vh] overflow-auto"><table class="tabla-verdad text-xs"><thead><tr><th>Fecha</th><th>Tipo</th><th>Fórmula</th><th>Lectura</th></tr></thead><tbody>';
        lista.forEach(h=>{
          const f = new Date(h.fecha).toLocaleString();
          html += `<tr><td>${esc(f)}</td><td>${esc(h.tipo)}</td><td class="texto-fbf">${esc(h.formula)}</td><td>${esc(h.lectura)}</td></tr>`;
        });
        html += '</tbody></table></div>';
        const modal = document.getElementById("modal-historial");
        document.getElementById("modal-historial-contenido").innerHTML = html;
        App.abrirModal("modal-historial");
      };
      root.querySelector("#admin-limpiar-historial").onclick = async function(){
        if (!Auth.esAdmin()) return App.toast("Solo admin", "error");
        const a = await Storage.ajustesGet("permitirBorrarHistorial", true);
        if (!a && !Auth.esAdmin()) return App.toast("No permitido", "error");
        if (!confirm("¿Limpiar todo el historial de este dispositivo?")) return;
        await Storage.historialLimpiar();
        App.toast("Historial limpiado", "ok");
      };
    }
  };
  global.AdminUI = AdminUI;
  document.addEventListener("DOMContentLoaded", function(){ AdminUI.init(); });
})(window);
