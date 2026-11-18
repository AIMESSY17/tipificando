"use client";
// =====================================================================
//  Quitar el fondo de una foto EN EL NAVEGADOR, gratis y sin APIs.
//  Modelo: U²-Net pequeño (u2netp, licencia Apache 2.0, 4,6 MB) corriendo con
//  onnxruntime-web (MIT). Ambos viven en /public, así que no dependemos de nadie.
//  La primera vez descarga ~20 MB (motor + modelo); después queda en caché.
// =====================================================================

let sesion = null;
let ortMod = null;

async function cargar() {
  if (sesion) return sesion;
  ortMod = await import(/* webpackIgnore: true */ "/ort/ort.wasm.min.mjs");
  ortMod.env.wasm.wasmPaths = "/ort/";
  ortMod.env.wasm.numThreads = 1;
  sesion = await ortMod.InferenceSession.create("/modelos/u2netp.onnx", { executionProviders: ["wasm"] });
  return sesion;
}

// ¿La imagen ya viene sin fondo? (tiene una buena parte transparente)
export function tieneTransparencia(bmp) {
  const w = 64, h = Math.max(1, Math.round((64 * bmp.height) / bmp.width));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(bmp, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  let t = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 200) t++;
  return t / (w * h) > 0.05;
}

const S = 320;
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

// Devuelve un canvas con la pieza recortada (fondo transparente) y encuadrada.
export async function quitarFondo(bmp, onPaso = () => {}) {
  onPaso("Preparando el recortador (la primera vez tarda un poco)…");
  const ses = await cargar();
  const ort = ortMod;

  onPaso("Buscando la pieza en la foto…");
  // 1) Entrada 320×320 normalizada
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(bmp, 0, 0, S, S);
  const px = x.getImageData(0, 0, S, S).data;
  let max = 1;
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2]);
  const input = new Float32Array(3 * S * S);
  for (let i = 0, p = 0; p < S * S; i += 4, p++) {
    for (let ch = 0; ch < 3; ch++) input[ch * S * S + p] = (px[i + ch] / max - MEAN[ch]) / STD[ch];
  }
  const out = await ses.run({ [ses.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, S, S]) });
  const pred = out[ses.outputNames[0]].data;
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < S * S; i++) { mn = Math.min(mn, pred[i]); mx = Math.max(mx, pred[i]); }

  // 2) Máscara chica → tamaño real (máx. 1600 px)
  onPaso("Recortando…");
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const W = Math.round(bmp.width * k), H = Math.round(bmp.height * k);
  const m = document.createElement("canvas");
  m.width = m.height = S;
  const mx2 = m.getContext("2d");
  const md = mx2.createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = (pred[i] - mn) / (mx - mn || 1);
    md.data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, (v - 0.08) / 0.84)) * 255);
  }
  mx2.putImageData(md, 0, 0);
  const big = document.createElement("canvas");
  big.width = W;
  big.height = H;
  const bx = big.getContext("2d", { willReadFrequently: true });
  bx.imageSmoothingQuality = "high";
  bx.drawImage(m, 0, 0, W, H);
  const alpha = bx.getImageData(0, 0, W, H).data;

  const full = document.createElement("canvas");
  full.width = W;
  full.height = H;
  const fx = full.getContext("2d", { willReadFrequently: true });
  fx.drawImage(bmp, 0, 0, W, H);
  const img = fx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < W * H; i++) d[i * 4 + 3] = alpha[i * 4 + 3];

  // 3) Nos quedamos con la pieza (manchas grandes) y sacamos textos/logos sueltos
  limpiarSueltos(d, W, H);
  fx.putImageData(img, 0, 0);
  return encuadrar(full);
}

function limpiarSueltos(d, W, H) {
  // 1) manchas "firmes" (alpha >= 128), achicadas unos px para cortar los puentes finitos
  //    que pegan textos o sombras a la pieza
  let firme = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) firme[p] = d[p * 4 + 3] >= 128 ? 1 : 0;
  const R = Math.max(2, Math.round(Math.max(W, H) / 220));
  for (let it = 0; it < R; it++) {
    const f2 = firme.slice();
    for (let p = 0; p < W * H; p++) {
      if (!firme[p]) continue;
      const x = p % W;
      if (x === 0 || x === W - 1 || p < W || p >= W * (H - 1) || !firme[p - 1] || !firme[p + 1] || !firme[p - W] || !firme[p + W]) f2[p] = 0;
    }
    firme = f2;
  }
  const lab = new Int32Array(W * H);
  const sizes = [0];
  const stack = new Int32Array(W * H);
  let n = 0;
  for (let p = 0; p < W * H; p++) {
    if (lab[p] || !firme[p]) continue;
    n++;
    let top = 0, size = 0;
    stack[top++] = p;
    lab[p] = n;
    while (top) {
      const q = stack[--top];
      size++;
      const qx = q % W, qy = (q / W) | 0;
      if (qx > 0 && !lab[q - 1] && firme[q - 1]) { lab[q - 1] = n; stack[top++] = q - 1; }
      if (qx < W - 1 && !lab[q + 1] && firme[q + 1]) { lab[q + 1] = n; stack[top++] = q + 1; }
      if (qy > 0 && !lab[q - W] && firme[q - W]) { lab[q - W] = n; stack[top++] = q - W; }
      if (qy < H - 1 && !lab[q + W] && firme[q + W]) { lab[q + W] = n; stack[top++] = q + W; }
    }
    sizes.push(size);
  }
  if (!n) return;
  const mayor = Math.max(...sizes);
  // 2) nos quedamos con la pieza (y partes grandes de ella), y le damos unos px de margen para el borde suave
  let keep = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) if (lab[p] && sizes[lab[p]] >= mayor * 0.25) keep[p] = 1;
  for (let it = 0; it < R + 4; it++) {
    const k2 = keep.slice();
    for (let p = 0; p < W * H; p++) {
      if (keep[p]) continue;
      const x = p % W;
      if ((x > 0 && keep[p - 1]) || (x < W - 1 && keep[p + 1]) || (p >= W && keep[p - W]) || (p < W * (H - 1) && keep[p + W])) k2[p] = 1;
    }
    keep = k2;
  }
  for (let p = 0; p < W * H; p++) if (!keep[p]) d[p * 4 + 3] = 0;
}

// Recorta lo transparente de alrededor y deja la pieza en máx. 900 px
export function encuadrar(canvas) {
  const W = canvas.width, H = canvas.height;
  const d = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (d[(y * W + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) throw new Error("No encontramos ninguna pieza en la foto. Probá con otra foto donde se vea bien.");
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  // margen transparente (como scripts/bordes.py): 4% a los costados y arriba, 1,2% abajo. Sin
  // margen, el parallax de la escena estira el píxel del borde y la pieza se ve mochada.
  const lado = Math.max(cw, ch);
  const ml = Math.round(lado * 0.04), mt = ml, mb = Math.round(lado * 0.012);
  const k = Math.min(1, 900 / Math.max(cw + 2 * ml, ch + mt + mb));
  const o = document.createElement("canvas");
  o.width = Math.round((cw + 2 * ml) * k);
  o.height = Math.round((ch + mt + mb) * k);
  const ox = o.getContext("2d");
  ox.imageSmoothingQuality = "high";
  ox.drawImage(canvas, x0, y0, cw, ch, ml * k, mt * k, cw * k, ch * k);
  return o;
}
