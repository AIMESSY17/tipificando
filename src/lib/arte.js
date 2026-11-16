"use client";
// =====================================================================
//  Dirección de arte automática: mira la pieza recortada y elige
//  pared + mesa de una paleta curada, detecta si tiene luces y avisa
//  si la foto tiene problemas. Así el cliente obtiene el mismo nivel
//  que las piezas originales sin saber nada de diseño.
// =====================================================================

export const PARES = [
  { nombre: "Terracota", pared: "#c46a4c", mesa: "#e9d2bf", h: 16 },
  { nombre: "Ladrillo", pared: "#9e4b3e", mesa: "#e3cfc0", h: 8 },
  { nombre: "Rojo pochoclo", pared: "#b5261d", mesa: "#ddbba8", h: 2 },
  { nombre: "Bordó vino", pared: "#6e1a22", mesa: "#c9a48a", h: 354 },
  { nombre: "Rosa arcilla", pared: "#d19a8f", mesa: "#efe0d6", h: 10 },
  { nombre: "Mostaza", pared: "#c79a3e", mesa: "#ece2cf", h: 40 },
  { nombre: "Topo", pared: "#a8907e", mesa: "#ddd5c8", h: 26 },
  { nombre: "Salvia", pared: "#8fa595", mesa: "#dcd4c4", h: 140 },
  { nombre: "Eucalipto", pared: "#9db0a0", mesa: "#dcd4c4", h: 128 },
  { nombre: "Petróleo", pared: "#4f7c80", mesa: "#e0d8ca", h: 185 },
  { nombre: "Cielo", pared: "#a8cde0", mesa: "#ece4d4", h: 200 },
  { nombre: "Gris azulado", pared: "#8c9aae", mesa: "#ddd5c8", h: 216 },
  { nombre: "Lavanda", pared: "#b4a3c8", mesa: "#e6ded2", h: 270 },
];

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
const distH = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

// canvas: la pieza ya recortada (con transparencia)
export function analizar(canvas, { evitar = [] } = {}) {
  const w = 96, h = Math.max(1, Math.round((96 * canvas.height) / canvas.width));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(canvas, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;

  // primero: el tono del cuerpo de la pieza (casi siempre el crudo del esmalte)
  const px = [];
  let luces = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 160) continue;
    const [hh, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2]);
    const C = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    px.push([hh, s, l, C]);
    // luz cálida: muy brillante, amarilla/naranja y saturada (los agujeritos del pino)
    if (l > 0.5 && l < 0.82 && s > 0.85 && hh > 25 && hh < 55 && d[i] > 225 && d[i + 2] < 150) luces++;
  }
  const opacos = px.length || 1;
  const conLuces = luces / opacos > 0.012;
  // tono del cuerpo (casi siempre el crudo del esmalte)
  const hb = new Array(36).fill(0);
  for (const [hh, , , C] of px) if (C > 12) hb[Math.floor(hh / 10) % 36]++;
  const cuerpo = hb.indexOf(Math.max(...hb)) * 10 + 5;
  // acentos: colores fuertes distintos al cuerpo, tintes fríos, y rayas/motas oscuras
  const fuerte = new Array(36).fill(0);
  let nFuerte = 0, nFrio = 0, nOscuro = 0;
  for (const [hh, , l, C] of px) {
    if (C > 40 && l < 0.88 && distH(hh, cuerpo) > 15) { fuerte[Math.floor(hh / 10) % 36]++; nFuerte++; }
    if (C > 5 && hh > 170 && hh < 270 && l < 0.75) nFrio++;
    if (l < 0.42 && C < 30) nOscuro++;
  }
  const hue = fuerte.indexOf(Math.max(...fuerte)) * 10 + 5;

  const lista = PARES.filter((p) => !evitar.includes(p.pared));
  const pool = lista.length ? lista : PARES;
  const masCerca = (h) => [...pool].sort((a, b) => distH(a.h, h) - distH(b.h, h))[0];
  let elegido, razon;
  if (conLuces) {
    elegido = PARES.find((p) => p.nombre === "Bordó vino");
    razon = "Tiene luces: va sobre pared oscura y le activamos el brillo.";
  } else if (nFuerte / opacos > 0.006) {
    elegido = masCerca(hue);
    razon = `Tiene detalles de color, así que elegimos ${elegido.nombre.toLowerCase()} para que combine.`;
  } else if (nFrio / opacos > 0.02) {
    elegido = masCerca(210);
    razon = `Tiene tonos fríos, así que elegimos ${elegido.nombre.toLowerCase()}.`;
  } else if (nOscuro / opacos > 0.03) {
    elegido = masCerca(216);
    razon = `Tiene rayas o motas oscuras: ${elegido.nombre.toLowerCase()} las hace resaltar.`;
  } else {
    const neutros = ["Terracota", "Salvia", "Lavanda", "Topo", "Rosa arcilla", "Mostaza", "Eucalipto"];
    elegido = pool.find((p) => neutros.includes(p.nombre)) || pool[0];
    razon = `Es lisa, así que la pusimos sobre ${elegido.nombre.toLowerCase()} para que resalte.`;
  }

  // controles de calidad
  const avisos = [];
  if (Math.max(canvas.width, canvas.height) < 450) avisos.push("La foto es chica: puede verse borrosa. Si podés, subila en mejor calidad.");
  let arriba = 0;
  for (let i = 0; i < w; i++) if (d[i * 4 + 3] > 200) arriba++;
  if (arriba / w > 0.85) avisos.push("Parece que la pieza quedó cortada arriba. Probá con una foto donde entre entera.");

  return { pared: elegido.pared, mesa: elegido.mesa, nombre: elegido.nombre, conLuces, razon, avisos };
}
