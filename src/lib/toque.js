// Toque vs arrastre, para botones y tarjetas en pantallas táctiles.
// Un toque = el dedo se movió menos de MOVER px y se levantó antes de TIEMPO ms → ejecuta al
// levantar el dedo (sin esperar al click del navegador). Si se movió más, es arrastre o scroll y no
// selecciona. Con el mouse y el teclado manda el click de siempre. Mientras el dedo está apoyado el
// elemento lleva data-presionado (se achica un poco, ver globals.css).
export const MOVER = 9;
export const TIEMPO = 400;
let g = null; // el toque en curso (uno a la vez)
let ultimoToque = -1e9; // cuándo se levantó el último dedo: el click que genera el navegador se ignora

const soltarMarca = (el) => el && delete el.dataset.presionado;

export function toque(onTap) {
  return {
    onPointerDown(e) {
      if (e.pointerType === "mouse" || e.button > 0) return;
      g = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, el: e.currentTarget };
      e.currentTarget.dataset.presionado = "1";
    },
    onPointerMove(e) {
      if (!g || e.pointerId !== g.id) return;
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > MOVER) {
        soltarMarca(g.el);
        g = null; // ya es arrastre o scroll
      }
    },
    onPointerUp(e) {
      if (e.pointerType === "mouse") return;
      ultimoToque = performance.now();
      if (!g || e.pointerId !== g.id) return;
      const { t, el, x, y } = g;
      g = null;
      soltarMarca(el);
      if (performance.now() - t <= TIEMPO && Math.hypot(e.clientX - x, e.clientY - y) <= MOVER) onTap(e);
    },
    onPointerCancel(e) {
      if (g && e.pointerId === g.id) soltarMarca(g.el);
      g = null;
      ultimoToque = performance.now();
    },
    onClick(e) {
      if (performance.now() - ultimoToque < 800) return; // ya lo resolvió el dedo
      onTap(e);
    },
  };
}
