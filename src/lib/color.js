// Colores en OKLab / OKLCH, iguales a los que calcula el CSS:
// - vivo(hex, boost)            → mismo tono con más croma (ver format.js)
// - color-mix(in oklch, a p%, b) → mezclaOklch(a, b, p)
// El 3D recibe los colores ya calculados (OKLab) y los mezcla en el shader.

const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const gam = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function hexARgb(hex = "#888888") {
  let h = String(hex).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

// sRGB (0–1, con gamma) → OKLab [L, a, b]
export function rgbAOklab([R, G, B]) {
  const r = lin(R), g = lin(G), b = lin(B);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

// OKLab → sRGB (0–1, con gamma), recortado a la gama sRGB
export function oklabARgb([L, A, B]) {
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
  const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
  const s_ = L - 0.0894841775 * A - 1.291485548 * B;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [
    clamp01(gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp01(gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp01(gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
}

export const hexAOklab = (hex) => rgbAOklab(hexARgb(hex));

// Igual que vivo() de format.js, pero devuelve OKLab
export function vivoLab(hex, boost = 1.14) {
  const [L, a, b] = hexAOklab(hex);
  return [L, a * boost, b * boost];
}

// color-mix(in oklch, A p, B) con A y B en OKLab (matiz por el camino más corto, como el CSS)
export function mezclaOklch(A, B, p) {
  const C1 = Math.hypot(A[1], A[2]), C2 = Math.hypot(B[1], B[2]);
  let H1 = Math.atan2(A[2], A[1]), H2 = Math.atan2(B[2], B[1]);
  if (C1 < 1e-4) H1 = H2;
  if (C2 < 1e-4) H2 = H1;
  let d = H2 - H1;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  const q = 1 - p;
  const L = A[0] * p + B[0] * q, C = C1 * p + C2 * q, H = H1 + d * q;
  return [L, C * Math.cos(H), C * Math.sin(H)];
}

export const rgbACss = ([r, g, b]) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
