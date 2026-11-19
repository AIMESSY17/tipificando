// Mapa de profundidad "cilíndrico" desde la transparencia del PNG: cada fila se trata como
// un cilindro (la cerámica casi siempre es redonda). Devuelve un canal (0–255) por píxel.
// Función pura: la usan el Web Worker y el respaldo en el hilo principal.
//
// Perfil "plano" (piezas rectangulares, como la budinera): el cilindro estira y aplasta las puntas
// (la profundidad cae de 1 a 0 en los extremos y el parallax corre el centro respecto de los
// filos). Con el perfil plano el cuerpo queda casi parejo en 0,55 y baja suave a 0,3 solo en el
// último ~10 % de cada fila: la pieza se mueve entera y las puntas no se deforman.
const PLANO = /budinera/i;
export const perfilDe = (src) => (PLANO.test(String(src || "")) ? "plano" : "cilindro");

export function calcularProfundidad(rgba, w, h, perfil = "cilindro") {
  const plano = perfil === "plano";
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let a = -1, b = -1;
    const fila = y * w;
    for (let i = 0; i < w; i++) if (rgba[(fila + i) * 4 + 3] > 24) { if (a < 0) a = i; b = i; }
    if (a < 0 || b <= a) continue;
    for (let i = a; i <= b; i++) {
      if (rgba[(fila + i) * 4 + 3] <= 24) continue;
      const t = ((i - a) / (b - a)) * 2 - 1;
      const v = plano ? 0.3 + 0.25 * Math.sqrt(Math.max(0, 1 - t ** 8)) : Math.sqrt(Math.max(0, 1 - t * t));
      out[fila + i] = Math.round(v * 255);
    }
  }
  return out;
}

export const anchoProfundidad = (w) => Math.min(320, w);
