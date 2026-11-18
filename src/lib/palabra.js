"use client";
// =====================================================================
//  La palabra gigante, pintada en la pared del 3D.
//  Para que quede IDÉNTICA a la de antes (Instrument Serif itálica, minúscula, letter-spacing,
//  cada letra en su propia caja, recorte del overflow) no se "imita": se arma el mismo HTML con
//  las mismas clases (.palabra > .palabra-linea > .letra), se mide dónde cae cada letra y la línea
//  de base, y se pinta letra por letra en un canvas con la misma fuente y el mismo rasterizador.
//  El canvas va a la GPU como textura de un canal (cobertura); el color tono sobre tono lo pone el
//  shader de la pared, así la luz de ventana y la sombra de la planta le pasan por encima.
// =====================================================================

const MED = 200; // tamaño de fuente para medir (px); todo se guarda en "em"
const memoMedidas = new Map();
let fuenteLista = null;

export function cargarFuente() {
  if (!fuenteLista) {
    fuenteLista = (document.fonts?.load ? document.fonts.load(`italic 400 ${MED}px "Instrument Serif"`, "abcdefghijklmnñopqrstuvwxyzáéíóú") : Promise.resolve())
      .then(() => document.fonts?.ready)
      .catch(() => {});
  }
  return fuenteLista;
}

// Mide el layout real de la palabra (en em). Fuerza un layout chiquito, fuera de pantalla.
export function medirPalabra(palabra) {
  if (memoMedidas.has(palabra)) return memoMedidas.get(palabra);
  const caja = document.createElement("div");
  caja.className = "palabra";
  caja.setAttribute("aria-hidden", "true");
  Object.assign(caja.style, { position: "fixed", left: "0", top: "0", transform: "none", fontSize: MED + "px", visibility: "hidden", animation: "none" });
  const linea = document.createElement("span");
  linea.className = "palabra-linea";
  const letras = [...palabra].map((l) => {
    const s = document.createElement("span");
    s.className = "letra";
    s.textContent = l;
    linea.appendChild(s);
    return s;
  });
  const sonda = document.createElement("span");
  Object.assign(sonda.style, { display: "inline-block", width: "0", height: "0", verticalAlign: "baseline" });
  linea.appendChild(sonda);
  caja.appendChild(linea);
  document.body.appendChild(caja);
  const rc = caja.getBoundingClientRect();
  const rl = linea.getBoundingClientRect();
  const base = sonda.getBoundingClientRect().top;
  const r = {
    w: rl.width / MED,
    h: rl.height / MED,
    // centro de la línea respecto del centro de la caja .palabra (la que se centra en la pantalla)
    cx: (rl.left + rl.width / 2 - (rc.left + rc.width / 2)) / MED,
    cy: (rl.top + rl.height / 2 - (rc.top + rc.height / 2)) / MED,
    base: (base - rl.top) / MED,
    letras: letras.map((s) => ({ x: (s.getBoundingClientRect().left - rl.left) / MED, t: s.textContent })),
  };
  caja.remove();
  if (r.w > 0) memoMedidas.set(palabra, r);
  return r;
}

// Canvas con la palabra en blanco sobre negro (canal rojo = cobertura).
// fuentePx: tamaño de la letra en la textura (resolución). Devuelve { canvas, m }.
export function pintarPalabra(palabra, fuentePx, maxAncho = 4096) {
  const m = medirPalabra(palabra);
  const F = Math.max(32, Math.min(fuentePx, maxAncho / Math.max(m.w, 0.1)));
  const c = document.createElement("canvas");
  c.width = Math.max(4, Math.ceil(m.w * F));
  c.height = Math.max(4, Math.ceil(m.h * F));
  const x = c.getContext("2d");
  x.fillStyle = "#000";
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#fff";
  x.textBaseline = "alphabetic";
  x.textAlign = "left";
  x.font = `italic 400 ${F}px "Instrument Serif", "Times New Roman", serif`;
  const sx = c.width / (m.w * F), sy = c.height / (m.h * F);
  x.scale(sx, sy);
  for (const l of m.letras) x.fillText(l.t.toLocaleLowerCase("es"), l.x * F, m.base * F);
  return { canvas: c, m };
}

// Tamaño de la letra en px de pantalla: el mismo de antes
// (min(94vw / (letras × 0.46), 30dvh, 340px), con un mínimo de 4 letras)
export const tamPalabra = (palabra, W, H) => Math.min((0.94 * W) / (Math.max([...palabra].length, 4) * 0.46), 0.3 * H, 340);
