// Mapa de profundidad "cilíndrico" desde la transparencia del PNG: cada fila se trata como
// un cilindro (la cerámica casi siempre es redonda). Devuelve un canal (0–255) por píxel.
// Función pura: la usan el Web Worker y el respaldo en el hilo principal.
export function calcularProfundidad(rgba, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let a = -1, b = -1;
    const fila = y * w;
    for (let i = 0; i < w; i++) if (rgba[(fila + i) * 4 + 3] > 24) { if (a < 0) a = i; b = i; }
    if (a < 0 || b <= a) continue;
    for (let i = a; i <= b; i++) {
      if (rgba[(fila + i) * 4 + 3] <= 24) continue;
      const t = ((i - a) / (b - a)) * 2 - 1;
      out[fila + i] = Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * 255);
    }
  }
  return out;
}

export const anchoProfundidad = (w) => Math.min(320, w);
