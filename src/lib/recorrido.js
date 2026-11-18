// =====================================================================
//  El giro de la mesa del taller.
//  `s` es el ángulo de la mesa medido en piezas (0 = primera pieza adelante, 1 = segunda…).
//  No tiene tope: después de la última vuelve la primera (índice = s mod N).
//
//  - Arrastre: s sigue al dedo 1:1 (pxPorEstacion lo calcula la escena: lo que se corre en
//    pantalla la pieza de adelante cuando la mesa gira una pieza).
//  - Al soltar: inercia (la velocidad del dedo proyecta hasta dónde llega) + resorte suave a la
//    pieza entera más cercana a esa proyección. Un flick rápido gira varias.
//  - Flechas, ruedita, botones y tocar una pieza: el mismo resorte, sumando o restando piezas al
//    destino (irAIndice va por el camino más corto).
//  - Todo se puede interrumpir: agarrar en medio del resorte sigue desde donde está.
//  - La escena puede colgar `tocar(x, y)` (qué pieza hay en ese punto de la pantalla).
//
//  No tiene bucle propio: quien dibuja llama a paso(now) al principio de cada cuadro, así la
//  mesa y lo que se ve salen del mismo valor de s en el mismo cuadro (cero retraso).
// =====================================================================

const K = 90;                       // rigidez del resorte (1/s²)
const C = 2 * Math.sqrt(K) * 0.92;  // amortiguación (apenas por debajo de la crítica: asienta suave)
const TAU = 0.3;                    // cuánto "vuela" la inercia (s)

export class Recorrido {
  constructor(s = 0) {
    this.s = s;
    this.v = 0;             // piezas por segundo
    this.obj = s;
    this.modo = "quieto";   // quieto | arrastre | resorte
    this.pxPorEstacion = 400;
    this.reducido = false;
    this.indice = Math.round(s);
    this.subs = new Set();
    this.last = 0;
    this.drag = null;
  }

  // f(evento): "cambio" (s se movió), "indice" (cambió la pieza de adelante), "quieto"
  escuchar(f) {
    this.subs.add(f);
    return () => this.subs.delete(f);
  }
  emitir(tipo) {
    for (const f of this.subs) f(tipo, this);
  }
  setS(s) {
    this.s = s;
    const i = Math.round(s);
    if (i !== this.indice) {
      this.indice = i;
      this.emitir("indice");
    }
    this.emitir("cambio");
  }
  get moviendo() {
    return this.modo !== "quieto";
  }

  // ---------- Dedo / mouse ----------
  agarrar(x, t) {
    this.modo = "arrastre";
    this.v = 0;
    this.drag = { x0: x, s0: this.s, muestras: [{ x, t }] };
    this.emitir("cambio");
  }
  arrastrar(x, t) {
    const g = this.drag;
    if (!g) return;
    g.muestras.push({ x, t });
    while (g.muestras.length > 2 && t - g.muestras[0].t > 90) g.muestras.shift();
    if (this.reducido) return; // sin giro: el cambio se decide al soltar
    this.setS(g.s0 - (x - g.x0) / this.pxPorEstacion);
  }
  soltar(t, cancelado = false) {
    const g = this.drag;
    this.drag = null;
    if (!g) return;
    const m = g.muestras, u = m[m.length - 1];
    const a = m.find((p) => u.t - p.t <= 90) || m[0];
    // velocidad (px/ms) de los últimos 90 ms; si el dedo frenó antes de soltar, no hay inercia
    const vpx = t - u.t < 60 && u.t - a.t > 6 ? (u.x - a.x) / (u.t - a.t) : 0;
    const v = cancelado ? 0 : (-vpx * 1000) / this.pxPorEstacion; // piezas/s
    if (this.reducido) {
      const dx = u.x - g.x0;
      const paso = Math.abs(vpx) > 0.35 ? -Math.sign(vpx) : Math.abs(dx) > this.pxPorEstacion * 0.18 ? -Math.sign(dx) : 0;
      return this.ir(cancelado ? 0 : paso);
    }
    let destino = Math.round(this.s + v * TAU);
    // un gesto rápido siempre avanza al menos una pieza en su sentido
    if (Math.abs(v) > 1.2 && destino === Math.round(this.s) && Math.sign(destino - this.s) !== Math.sign(v)) destino += Math.sign(v);
    this.irA(destino, v);
  }

  // ---------- Resorte ----------
  irA(destino, v = this.v) {
    this.obj = destino;
    if (this.reducido) {
      // corte directo (la escena hace el fundido)
      this.v = 0;
      this.modo = "quieto";
      this.setS(destino);
      this.emitir("quieto");
      return;
    }
    this.v = v;
    this.modo = "resorte";
    this.last = 0;
    this.emitir("cambio");
  }
  // delta piezas desde el destino actual (encadena si ya se estaba moviendo)
  ir(delta) {
    const base = this.modo === "resorte" ? this.obj : Math.round(this.s);
    this.irA(base + delta);
  }
  // ir a un índice de pieza (0..N-1) por el camino más corto
  irAIndice(i, N) {
    const cur = this.modo === "resorte" ? this.obj : Math.round(this.s);
    const actual = ((cur % N) + N) % N;
    let d = i - actual;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    if (d) this.irA(cur + d);
  }

  // Avanza el resorte. Devuelve true si se está moviendo.
  paso(now) {
    if (this.modo !== "resorte") {
      this.last = now;
      return this.modo === "arrastre";
    }
    const dt = this.last ? Math.min(0.05, Math.max(0.001, (now - this.last) / 1000)) : 1 / 60;
    this.last = now;
    let s = this.s, v = this.v;
    const n = 4; // sub-pasos: estable con cualquier fps
    for (let i = 0; i < n; i++) {
      const h = dt / n;
      v += (K * (this.obj - s) - C * v) * h;
      s += v * h;
    }
    this.v = v;
    if (Math.abs(this.obj - s) < 0.0006 && Math.abs(v) < 0.01) {
      this.v = 0;
      this.modo = "quieto";
      this.setS(this.obj);
      this.emitir("quieto");
      return false;
    }
    this.setS(s);
    return true;
  }
}

export const modN = (i, N) => ((i % N) + N) % N;
