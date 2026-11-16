"use client";
// Centro horizontal de la base de la pieza (las tazas tienen el asa a un costado
// y sin esto quedan corridas). Devuelve una fracción del ancho: 0.5 = centrada.
export function centroBase(img) {
  try {
    const w = 120, h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0, w, h);
    const y0 = Math.floor(h * 0.85);
    const d = x.getImageData(0, y0, w, h - y0).data;
    let a = w, b = -1;
    for (let y = 0; y < h - y0; y++)
      for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 40) { if (i < a) a = i; if (i > b) b = i; }
    return b > a ? (a + b) / 2 / w : 0.5;
  } catch {
    return 0.5;
  }
}


// Tamaño de cada pieza: misma "superficie visual" sin importar la forma de la foto,
// y corrida para que la base (no el asa) quede en el centro del pedestal.
export function medidas(a, cx, W, H) {
  const B = Math.min(W * 0.66, H * 0.34, 470);
  let hh = Math.sqrt((B * B * 0.68) / a), ww = a * hh;
  const maxW = Math.min(W * 0.86, B * 1.4), maxH = H * 0.37;
  if (ww > maxW) { ww = maxW; hh = ww / a; }
  if (hh > maxH) { hh = maxH; ww = hh * a; }
  const shift = Math.round((0.5 - cx) * ww);
  return { width: Math.round(ww), height: Math.round(hh), shift, transform: `translate(calc(-50% + ${shift}px), -100%)` };
}

export function anchoPed(w, cx = 0.5, min = 120) {
  return Math.round(Math.max(min, Math.min(w * (Math.abs(cx - 0.5) > 0.04 ? 0.76 : 0.9), 360)));
}

export const estilo = ({ shift, ...resto }) => resto; // sin "shift" para pasarlo como style
