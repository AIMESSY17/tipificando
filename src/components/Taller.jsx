"use client";
import { useEffect, useRef } from "react";
import { input, escuchar } from "@/lib/inclinacion";
import { prepararFoto } from "@/lib/profundidad";
import { cargarImagen } from "@/lib/fotos";
import { Recorrido, modN } from "@/lib/recorrido";
import { cargarFuente, pintarPalabra, medirPalabra, tamPalabra } from "@/lib/palabra";
import { vivoLab, hexAOklab, mezclaOklch, oklabARgb } from "@/lib/color";

// =====================================================================
//  EL TALLER: una MESA REDONDA GIRATORIA con todas las piezas paradas en el borde.
//
//  La cámara está quieta, un poco elevada (~20° hacia abajo). Cambiar de pieza ES girar la mesa:
//  `recorrido.s` (lib/recorrido.js) es el ángulo de la mesa medido en piezas (s = 3 → la pieza 3
//  adelante al centro). El dedo lo mueve 1:1, al soltar hay inercia + resorte a la pieza más cercana.
//
//  Un solo WebGL dibuja todo:
//  - PARED y PISO: un shader cada uno (color de la pieza activa, degradé de luz, palabra pintada,
//    esmalte líquido que nace detrás de la pieza que llega y se derrama según el ángulo, mezcla
//    en OKLab, luz de ventana y sombra de planta proyectadas, sombras reales, grano y viñeta).
//  - La mesa 3D (disco de travertino con canto biselado, o cabezal de torno gigante sobre su base),
//    con sombra real sobre el piso. La tapa gira con el ángulo.
//  - Las piezas 2.5D (parallax por profundidad + brillo de esmalte), cada una mirando a cámara con
//    una leve rotación hacia la tangente (máx. ~30°). La activa (adelante) más grande, nítida y con
//    luz de recorte; las del fondo más chicas, oscuras y desenfocadas.
//  - Si hay muchas piezas, solo las cercanas al frente tienen la foto en la GPU; el resto se
//    dibuja como siluetas tenues (miniatura de 96 px) o no se dibuja.
//  - Haces de luz y polvo; profundidad de campo barata (mipmaps); calidad adaptativa.
//
//  El bucle llama a recorrido.paso() y dibuja con ese mismo valor: mesa, esmalte, palabra y textos
//  salen del mismo cuadro (cero retraso con el dedo).
// =====================================================================

const PITCH = (20 * Math.PI) / 180; // la cámara mira 20° hacia abajo
const PITCH_ZOOM = (9 * Math.PI) / 180; // y un poco menos cuando se acerca a la pieza
const HT = 1;            // altura de la tapa de la mesa
const TH = 0.3;          // espesor del disco
const RP0 = 2.6, RP_MAX = 4.4; // radio del círculo de piezas (crece con la cantidad, hasta un tope)
const BORDE = 0.45;      // la mesa sobresale esto del círculo de piezas
const GAP_PARED = 8;     // de la mesa a la pared
const BOOST = 0.5;       // cuánto más grande se ve la pieza activa
const PIEZA_B = 1.3;     // "superficie" de cada pieza (misma área visual sin importar la forma)
const ALTO_REF = 1.45, ANCHO_REF = 1.2; // pieza "típica" para encuadrar
const NVENT = 11, VENT = 5; // hasta 11 piezas: todas con foto; si hay más, solo ±5 alrededor del frente
const ZOOM_MS = 450;     // push-in al tocar la pieza (ease-out)
const MX = 0.16, MY = 0.14; // margen del halo alrededor de la pieza
const SOL = [-7, 9, 7].map((v) => v * 1.7); // posición del sol respecto del centro de la mesa
const DL = (() => { const n = Math.hypot(...SOL); return SOL.map((v) => -v / n); })(); // dirección de la luz
const VY0 = -7, VY1 = 10; // alto que cubre la textura de ventana + planta (en la pared)

// Calidad adaptativa. Si el gesto no llega a 60 fps se baja de a un escalón, y el orden es a
// propósito: primero se apagan los efectos (polvo, rayos, desenfoque), después se achica la sombra
// y recién al final la resolución. La respuesta al dedo no se toca nunca.
const NIVELES = {
  alto: { pr: 2, prT: 2, sombra: 2048, haces: 1, polvo: 110, dof: 1 },
  medio: { pr: 2, prT: 2, sombra: 2048, haces: 0.6, polvo: 40, dof: 1 },
  liviano: { pr: 2, prT: 2, sombra: 1024, haces: 0, polvo: 0, dof: 0 },
  bajo: { pr: 1.5, prT: 1.5, sombra: 512, haces: 0, polvo: 0, dof: 0 },
  minimo: { pr: 1, prT: 1.2, sombra: 512, haces: 0, polvo: 0, dof: 0 },
};
const ORDEN = ["minimo", "bajo", "liviano", "medio", "alto"];

const suave = (x) => x * x * (3 - 2 * x);
const envolver = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------------
//  Texturas dibujadas una vez
// ---------------------------------------------------------------------
function canvasTex(T, w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function rnd(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function texTravertino(T) {
  const r = rnd(7);
  return canvasTex(T, 2048, 1024, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#eee5d6");
    g.addColorStop(1, "#e6dccb");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      const y = r() * h, hh = 1 + r() * 10;
      x.fillStyle = `rgba(${170 + r() * 50},${150 + r() * 45},${120 + r() * 35},${0.04 + r() * 0.08})`;
      x.beginPath();
      x.moveTo(0, y);
      for (let px = 0; px <= w; px += 64) x.lineTo(px, y + Math.sin(px * 0.004 + i) * 4 + (r() - 0.5) * 2);
      x.lineTo(w, y + hh);
      x.lineTo(0, y + hh);
      x.fill();
    }
    for (let i = 0; i < 700; i++) {
      const px = r() * w, py = r() * h, rw = 1 + r() * 6, rh = 0.4 + r() * 1.2;
      x.fillStyle = `rgba(${130 + r() * 40},${110 + r() * 35},${85 + r() * 25},${0.18 + r() * 0.25})`;
      x.beginPath();
      x.ellipse(px, py, rw, rh, 0, 0, Math.PI * 2);
      x.fill();
    }
  });
}

function texTorno(T) {
  const r = rnd(11);
  return canvasTex(T, 1024, 1024, (x, w) => {
    const c = w / 2;
    const g = x.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, "#c9ced3");
    g.addColorStop(1, "#9aa1a8");
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
    for (let i = 0; i < 160; i++) {
      x.strokeStyle = `rgba(255,255,255,${r() * 0.12})`;
      x.lineWidth = 0.6 + r() * 1.4;
      x.beginPath();
      x.arc(c, c, r() * c, 0, Math.PI * 2);
      x.stroke();
    }
    // marcas de barro (arcos concéntricos): con la mesa girando se ve que gira
    for (let i = 0; i < 34; i++) {
      x.strokeStyle = `rgba(${120 + r() * 40},${70 + r() * 25},${45 + r() * 20},${0.25 + r() * 0.4})`;
      x.lineWidth = 3 + r() * 20;
      const rad = c * (0.2 + r() * 0.76), a0 = r() * Math.PI * 2;
      x.beginPath();
      x.arc(c, c, rad, a0, a0 + 0.4 + r() * 2.2);
      x.stroke();
    }
    // salpicaduras de barro
    for (let i = 0; i < 90; i++) {
      x.fillStyle = `rgba(${115 + r() * 40},${68 + r() * 25},${44 + r() * 20},${0.2 + r() * 0.35})`;
      const rad = c * (0.15 + r() * 0.8), a = r() * Math.PI * 2;
      x.beginPath();
      x.ellipse(c + Math.cos(a) * rad, c + Math.sin(a) * rad, 2 + r() * 7, 1 + r() * 3, a + Math.PI / 2, 0, Math.PI * 2);
      x.fill();
    }
    x.fillStyle = "#6f7378";
    x.beginPath();
    x.arc(c, c, 14, 0, Math.PI * 2);
    x.fill();
  });
}

// La mesa: un Group con sus piezas (geometrías propias, se rearma si cambia el tipo o el radio)
function armarMesa(T, tipo, RM, cache) {
  const g = new T.Group();
  const geos = [];
  const add = (geo, mat) => {
    geos.push(geo);
    const m = new T.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  if (tipo === "torno") {
    // cabezal de torno gigante: disco de metal con marcas de barro, sobre la base del torno
    cache.metalTapa ||= new T.MeshStandardMaterial({ map: texTorno(T), metalness: 0.7, roughness: 0.38 });
    cache.metalLado ||= new T.MeshStandardMaterial({ color: "#9ea5ab", metalness: 0.85, roughness: 0.3 });
    cache.plastico ||= new T.MeshStandardMaterial({ color: "#57514c", roughness: 0.5, metalness: 0.05 });
    const e = 0.16;
    const cab = new T.CylinderGeometry(RM, RM * 0.985, e, 160);
    cab.translate(0, HT - e / 2, 0);
    add(cab, [cache.metalLado, cache.metalTapa, cache.metalLado]);
    // aro de la bandeja (el "pan" del torno) por debajo del cabezal
    const pan = new T.LatheGeometry(
      [[RM * 0.62, HT - 0.42], [RM * 0.9, HT - 0.4], [RM * 0.93, HT - 0.24], [RM * 0.9, HT - 0.22], [RM * 0.62, HT - 0.3]].map(([a, b]) => new T.Vector2(a, b)),
      120
    );
    add(pan, cache.plastico);
    const base = new T.LatheGeometry(
      [[0, 0], [RM * 0.6, 0], [RM * 0.62, 0.04], [RM * 0.55, HT - 0.4], [RM * 0.2, HT - 0.18], [0, HT - 0.18]].map(([a, b]) => new T.Vector2(a, b)),
      96
    );
    add(base, cache.plastico);
  } else {
    // disco de travertino con canto biselado, sobre un zócalo más chico
    if (!cache.trav) {
      const tex = texTravertino(T);
      const lado = tex.clone();
      lado.wrapS = T.RepeatWrapping;
      lado.repeat.set(6, 0.25);
      lado.needsUpdate = true;
      cache.trav = new T.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.35, roughness: 0.78, metalness: 0 });
      cache.travLado = new T.MeshStandardMaterial({ map: lado, bumpMap: lado, bumpScale: 0.35, roughness: 0.8, metalness: 0 });
      cache.travZocalo = new T.MeshStandardMaterial({ map: lado, color: "#d9cdb9", roughness: 0.85, metalness: 0 });
    }
    const b = 0.07;
    const tapa = new T.CircleGeometry(RM - b, 160);
    tapa.rotateX(-Math.PI / 2);
    tapa.translate(0, HT, 0);
    add(tapa, cache.trav);
    const canto = new T.LatheGeometry(
      [[RM * 0.8, HT - TH], [RM - 0.05, HT - TH], [RM, HT - TH + 0.05], [RM, HT - b], [RM - b * 0.3, HT - b * 0.3], [RM - b, HT]].map(([a, c]) => new T.Vector2(a, c)),
      160
    );
    add(canto, cache.travLado);
    const zocalo = new T.CylinderGeometry(RM * 0.8, RM * 0.82, HT - TH, 96, 1, true);
    zocalo.translate(0, (HT - TH) / 2, 0);
    add(zocalo, cache.travZocalo);
  }
  g.userData.dispose = () => geos.forEach((x) => x.dispose());
  return g;
}

// Luz de ventana (canal rojo) + sombra de la planta (canal verde), en el espacio de la pared.
// Dibujado en chico y agrandado: el suavizado hace de desenfoque.
const PLANTA = [
  "M60 60 C110 40 160 70 170 120 C120 140 75 115 60 60Z",
  "M45 110 C0 100 -30 140 -20 180 C25 185 50 150 45 110Z",
  "M100 190 C160 170 215 205 220 260 C160 275 110 245 100 190Z",
  "M95 240 C45 235 15 275 25 320 C75 320 100 285 95 240Z",
  "M140 320 C200 310 245 350 240 405 C180 410 140 375 140 320Z",
  "M135 380 C90 380 60 420 70 465 C120 462 140 425 135 380Z",
];
const TALLO = "M30 -10 C40 80 60 160 110 250 C140 300 150 360 140 430";
const VENTANA = [
  [250, 0, 410, 0, 300, 420, 110, 420],
  [430, 0, 600, 0, 520, 420, 320, 420],
  [105, 440, 295, 440, 170, 900, -60, 900],
  [315, 440, 515, 440, 420, 900, 190, 900],
];
// caja de la ventana y de la planta, en fracciones del ancho de la luz (u: 0..1, v: VY0..VY1)
const CAJA_VENTANA = { u0: 0.5, u1: 0.98, y0: -6.5, y1: 9.6 };
const CAJA_PLANTA = { u0: 0.0, u1: 0.4, y0: 3.6, y1: 11 };

function texCookie(T) {
  const N = 256;
  const canal = (res, color, dibujar) => {
    const c = document.createElement("canvas");
    c.width = c.height = res;
    const x = c.getContext("2d");
    x.scale(res / N, res / N);
    x.fillStyle = x.strokeStyle = color;
    dibujar(x);
    return c;
  };
  const vy = (y) => ((VY1 - y) / (VY1 - VY0)) * N; // y de la pared → y del canvas (arriba = VY1)
  const win = canal(N / 6, "#f00", (k) => {
    const { u0, u1, y0, y1 } = CAJA_VENTANA;
    const bw = (u1 - u0) * N, bh = vy(y0) - vy(y1);
    k.translate(u0 * N + bw / 2, vy(y1) + bh / 2);
    k.transform(1, 0, Math.tan((-8 * Math.PI) / 180), 1, 0, 0);
    k.translate(-bw / 2, -bh / 2);
    k.scale(bw / 600, bh / 900);
    for (const p of VENTANA) {
      k.beginPath();
      k.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) k.lineTo(p[i], p[i + 1]);
      k.closePath();
      k.fill();
    }
  });
  const pl = canal(N / 2.5, "#0f0", (k) => {
    const { u0, u1, y0, y1 } = CAJA_PLANTA;
    k.translate(u0 * N, vy(y1));
    k.scale(((u1 - u0) * N) / 420, (vy(y0) - vy(y1)) / 520);
    k.lineWidth = 5;
    k.stroke(new Path2D(TALLO));
    for (const p of PLANTA) k.fill(new Path2D(p));
  });
  const t = canvasTex(T, N, N, (x) => {
    x.fillStyle = "#000";
    x.fillRect(0, 0, N, N);
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = "high";
    x.globalCompositeOperation = "lighter";
    x.drawImage(win, 0, 0, N, N);
    x.drawImage(pl, 0, 0, N, N);
  });
  t.colorSpace = T.NoColorSpace;
  t.generateMipmaps = false;
  t.minFilter = T.LinearFilter;
  return t;
}

// Grano del revoque / el piso (50% oscuro, 50% claro, alfa 0–15)
function texGrano(T) {
  const N = 256, d = new Uint8Array(N * N * 4);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.random() < 0.5 ? 24 : 255;
    d[i] = v;
    d[i + 1] = Math.max(0, v - 6);
    d[i + 2] = Math.max(0, v - 12);
    d[i + 3] = Math.random() * 15;
  }
  const t = new T.DataTexture(d, N, N);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.magFilter = T.NearestFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------
//  Shaders
// ---------------------------------------------------------------------
const GLSL_COLOR = /* glsl */ `
vec3 lab2rgb(vec3 c){
  float l_ = c.x + 0.3963377774*c.y + 0.2158037573*c.z;
  float m_ = c.x - 0.1055613458*c.y - 0.0638541728*c.z;
  float s_ = c.x - 0.0894841775*c.y - 1.2914855480*c.z;
  vec3 q = vec3(l_*l_*l_, m_*m_*m_, s_*s_*s_);
  vec3 L = vec3(4.0767416621*q.x - 3.3077115913*q.y + 0.2309699292*q.z,
               -1.2684380046*q.x + 2.6097574011*q.y - 0.3413193965*q.z,
               -0.0041960863*q.x - 0.7034186147*q.y + 1.7076147010*q.z);
  L = clamp(L, 0.0, 1.0);
  return mix(L * 12.92, 1.055 * pow(L, vec3(1.0/2.4)) - 0.055, step(0.0031308, L));
}
// mezcla en OKLab solo donde hace falta (en el borde del esmalte); el resto usa el sRGB ya calculado
vec3 mezcla(vec3 aRgb, vec3 bRgb, vec3 aLab, vec3 bLab, float m){
  if (m <= 0.0) return aRgb;
  if (m >= 1.0) return bRgb;
  return lab2rgb(mix(aLab, bLab, m));
}
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0 - 2.0*f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
`;

// Pared (plano detrás de la mesa) y piso comparten este shader; MESA (el piso) cambia lo propio.
const FS_SET = /* glsl */ `
#include <common>
#include <bsdfs>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
${GLSL_COLOR}
varying vec3 vW;
uniform float uZW, uSw, uPR, uHor, uTime, uSombra;
uniform vec2 uRes, uVista;
uniform vec3 uParA, uParB, uParAL, uParBL;   // pared: sRGB y OKLab de la pieza activa (A) y la que llega (B)
uniform vec3 uLuzA, uLuzB, uLuzAL, uLuzBL;   // color de la luz de ventana del degradé
uniform vec3 uSomA, uSomB, uSomAL, uSomBL;   // color de la sombra del degradé
uniform vec3 uTonA, uTonB, uTonAL, uTonBL;   // color de la palabra (tono sobre tono)
uniform vec3 uMesA, uMesB, uMesAL, uMesBL;   // piso (color "mesa" de la pieza)
uniform vec4 uEsm;      // x: progreso t, y: radio del frente, zw: dónde nace (detrás de la pieza que llega)
uniform sampler2D uPal0, uPal1;
uniform vec4 uPalR[2];  // palabra actual (0) y la que llega (1): centro x, centro y, medio ancho, medio alto
uniform vec4 uPalM[2];  // x: corrimiento horizontal, y: opacidad, z: desenfoque (bias)
uniform vec4 uGlow;     // brillo cálido del pino: xy dónde, z cuánto
uniform sampler2D uCookie, uGrano;
uniform vec3 uDL;       // dirección de la luz

// gradientes calculados fuera de los if (las derivadas no valen dentro de ramas divergentes)
float letra(int j, vec2 p){
  vec4 R = uPalR[j];
  vec2 uv = (p - R.xy) / (2.0 * max(R.zw, vec2(1e-4))) + 0.5;
  float sc = exp2(uPalM[j].z);
  vec2 gx = dFdx(uv) * sc, gy = dFdy(uv) * sc;
  if (R.z <= 0.0 || uPalM[j].y <= 0.0 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  if (j == 0) return textureGrad(uPal0, uv, gx, gy).r;
  return textureGrad(uPal1, uv, gx, gy).r;
}

// Frente del esmalte en el plano desplegado (pared + piso). Gravedad: hacia arriba sube más
// lento, hacia abajo cae más rápido. El borde ondula en grande (forma de mancha, no de círculo).
float frente(vec2 q){
  vec2 dq = q - uEsm.zw;
  float d = length(vec2(dq.x, dq.y * (dq.y > 0.0 ? 1.15 : 0.82)));
  float ond = vnoise(q * 0.17 + vec2(uTime * 0.012, 0.0)) * 0.65 + vnoise(q * 0.43 + 7.3) * 0.35;
  return d + (ond - 0.5) * 1.1 - uEsm.y;
}
float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

void main(){
  vec3 P = vW;
  float X = P.x;
#ifdef MESA
  float Y = 0.0, Z = max(P.z + uZW, 0.0);
#else
  float Y = P.y, Z = 0.0;
#endif
  vec2 fc = vec2(gl_FragCoord.x, uRes.y * uPR - gl_FragCoord.y) / uPR; // px CSS, y hacia abajo

  // ---------- esmalte líquido: nace detrás de la pieza que llega y avanza con el ángulo ----------
  // El radio sale directo del ángulo de la mesa: 1:1 con el dedo, sin animación propia.
  // Chorreadas: en columnas angostas y espaciadas, el mismo frente corrido hacia abajo un largo
  // distinto en cada una → lenguas verticales con la punta redondeada, unidas al borde (smin).
  float e = 10.0, m = 0.0, borde = 0.0;
  if (uEsm.x > 0.0){                           // en reposo no hay esmalte: no se calcula el ruido
    vec2 q = vec2(X, Y - Z * 0.45);            // pared + piso "desplegados" en un plano
    float eM = frente(q);
    float id = floor(X / 2.4 + 0.5);
    float h1 = hash(vec2(id, 3.7)), h2 = hash(vec2(id, 8.1)), h3 = hash(vec2(id, 1.9));
    float rr = 0.14 + 0.16 * h2;                               // medio ancho de la lengua
    float lado = abs(X - (id + (h3 - 0.5) * 0.5) * 2.4) - rr;  // distancia al costado de la lengua
    float largo = step(0.4, h1) * (0.7 + 2.3 * h2) * smoothstep(0.0, 0.4, uEsm.x);
    float abajo = frente(q + vec2(0.0, largo));                // el frente corrido hacia abajo
    vec2 w2 = vec2(abajo, lado) + rr;
    float eD = length(max(w2, 0.0)) + min(max(w2.x, w2.y), 0.0) - rr;
    e = smin(eM, eD, 0.35);
    borde = exp(-e * e / 0.02);
  }
  float aa = fwidth(e) * 1.5 + 0.012;
  m = 1.0 - smoothstep(-aa, aa, e);

#ifdef MESA
  vec3 col = mezcla(uMesA, uMesB, uMesAL, uMesBL, m);
  // luz del piso: degradé vertical desde el horizonte
  float f = clamp((fc.y - uHor) / max(1.0, uRes.y - uHor), 0.0, 1.0);
  vec3 cl; float al;
  if (f < 0.12){ cl = vec3(f / 0.12); al = 0.10; }
  else if (f < 0.40){ cl = vec3(1.0); al = 0.10 * (1.0 - (f - 0.12) / 0.28); }
  else { cl = vec3(0.0); al = 0.10 * (f - 0.40) / 0.60; }
  col = mix(col, cl, al);
  // canto del piso contra la pared
  float canto = 1.0 - smoothstep(1.5, 2.5, Z / max(fwidth(Z), 1e-5));
  col = mix(col, vec3(1.0), 0.45 * canto);
  vec4 gr = texture2D(uGrano, vec2(X, Z) * 0.42);
  col = mix(col, gr.rgb, gr.a);
#else
  vec3 col = mezcla(uParA, uParB, uParAL, uParBL, m);
  // degradé de la luz de ventana (115°): luz a la izquierda, sombra a la derecha
  vec2 dir = vec2(0.9063, 0.4226);
  float Lg = uRes.x * dir.x + uHor * dir.y;
  float tg = 0.5 + dot(fc - vec2(uRes.x, uHor) * 0.5, dir) / Lg;
  col = mix(col, mezcla(uLuzA, uLuzB, uLuzAL, uLuzBL, m), 0.55 * clamp(1.0 - tg / 0.42, 0.0, 1.0));
  col = mix(col, mezcla(uSomA, uSomB, uSomAL, uSomBL, m), 0.55 * clamp((tg - 0.6) / 0.4, 0.0, 1.0));
  // grano del revoque (debajo de la palabra: las letras quedan lisas)
  vec4 gr = texture2D(uGrano, vec2(X, Y) * 0.42);
  col = mix(col, gr.rgb, gr.a);
  // la palabra actual se va en el sentido del giro y la nueva entra del otro lado (ligadas al ángulo)
  vec3 ton = mezcla(uTonA, uTonB, uTonAL, uTonBL, m);
  float a0 = letra(0, vec2(X - uPalM[0].x, Y));
  float a1 = letra(1, vec2(X - uPalM[1].x, Y));
  col = mix(col, ton, a0 * uPalM[0].y);
  col = mix(col, ton, a1 * uPalM[1].y);
  // filo oscuro de 1 px sobre el canto del piso
  col *= 1.0 - 0.08 * (1.0 - smoothstep(0.5, 1.5, Y / max(fwidth(Y), 1e-5)));
#endif

  // borde mojado del esmalte: un brillo fino del lado de adentro y un espesor apenas más oscuro
  if (uEsm.x > 0.0){
    col = mix(col, vec3(1.0), 0.12 * borde * smoothstep(0.12, 0.0, -e) * step(e, 0.0));
    col *= 1.0 - 0.05 * smoothstep(0.35, 0.0, abs(e + 0.08)) * m;
  }

  // brillo cálido del pino
  if (uGlow.z > 0.0){
    vec2 g = vec2((X - uGlow.x) / (0.4 * uVista.x), (Y - Z * 0.8 - uGlow.y) / (0.32 * uVista.y));
    col = mix(col, vec3(1.0, 0.667, 0.275), 0.32 * uGlow.z * clamp(1.0 - length(g) / 0.7, 0.0, 1.0));
  }

  // sombras reales de la mesa y las piezas
  col *= 1.0 - uSombra * (1.0 - getShadowMask());

  // luz de ventana + sombra de la planta, proyectadas en la dirección del sol (pasan por encima de la palabra)
  float zp = Z / -uDL.z;
  float su = X + uDL.x * zp;
  float sy = Y + uDL.y * zp;
  vec2 cuv = vec2(su / uSw + 0.5, (sy - ${VY0.toFixed(1)}) / ${(VY1 - VY0).toFixed(1)});
  vec2 hoja = vec2(sin(uTime * 0.7 + sy) * 0.004, 0.0);
  float dentro = step(0.0, cuv.y) * step(cuv.y, 1.0) * step(0.0, cuv.x) * step(cuv.x, 1.0);
  vec2 ck = vec2(texture2D(uCookie, cuv).r, texture2D(uCookie, cuv + hoja).g) * dentro;
  col = mix(col, vec3(1.0, 0.965, 0.91), 0.13 * ck.x);
  col = mix(col, vec3(0.118, 0.063, 0.035), 0.24 * ck.y);

  // viñeta
  vec2 vg = (fc - uRes * vec2(0.45, 0.40)) / (uRes * vec2(1.3, 0.95));
  col = mix(col, vec3(0.071, 0.031, 0.016), 0.3 * clamp((length(vg) - 0.58) / 0.42, 0.0, 1.0));

  // dither de ±½ nivel: los degradés largos (esmalte, viñeta, luz) no hacen escalones
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

const VS = /* glsl */ `varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// La pieza: parallax por profundidad + brillo de esmalte + sombreado.
// `tilt` mezcla el vaivén en reposo / mouse / giroscopio con el ángulo real respecto de la cámara.
// `blur` = profundidad de campo barata (mipmaps más bajos); `luz` oscurece las del fondo;
// `rim` = luz de recorte de la activa (un filo claro arriba y a la izquierda); `alfa` = siluetas.
const FS_PIEZA = /* glsl */ `varying vec2 vUv;
uniform sampler2D img; uniform sampler2D dep;
uniform vec2 tilt; uniform float px; uniform float fuerza; uniform float glow; uniform float blur;
uniform float luz; uniform float rim; uniform float alfa;
void main(){
  float d = texture2D(dep, vUv, blur).r;
  vec2 off = tilt * (d - 0.3) * vec2(0.032, -0.014) * fuerza;
  vec2 u = clamp(vUv - off, 0.0, 1.0);
  vec4 c = texture2D(img, u, blur * 1.3);
  float al = c.a * alfa;
  if (al < 0.004) discard;
  float dl = texture2D(dep, u - vec2(px, 0.0)).r;
  float dr = texture2D(dep, u + vec2(px, 0.0)).r;
  vec3 n = normalize(vec3((dl - dr) * 7.0, 0.0, 0.55));
  vec3 L = normalize(vec3(-0.35 + tilt.x * 0.9, 0.2, 0.9));
  float spec = pow(max(dot(n, L), 0.0), 30.0) * 0.30;
  float shade = mix(0.86, 1.04, max(dot(n, normalize(vec3(-0.4 + tilt.x * 0.5, 0.0, 1.0))), 0.0));
  vec3 col = (c.rgb * shade + spec) * luz;
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  col += vec3(1.0, 0.62, 0.26) * smoothstep(0.6, 0.95, lum) * glow * 0.6;
  if (rim > 0.0){
    float r = px * 2.2;
    float aL = texture2D(img, u + vec2(-r, 0.0)).a;
    float aU = texture2D(img, u + vec2(0.0, r * 1.4)).a;
    float filo = clamp(c.a - min(aL, aU), 0.0, 1.0);
    col += vec3(1.0, 0.95, 0.88) * filo * rim * 0.42;
  }
  gl_FragColor = vec4(col, al);
}`;

const FS_HALO = /* glsl */ `varying vec2 vUv;
uniform sampler2D dep; uniform float glow;
void main(){
  vec2 u = vec2((vUv.x - ${MX.toFixed(3)}) / ${(1 - 2 * MX).toFixed(3)}, vUv.y / ${(1 - MY).toFixed(3)});
  vec2 q = clamp(u, 0.0, 1.0);
  float s = textureLod(dep, q, 3.0).r * 0.5 + textureLod(dep, q, 4.6).r * 0.5;
  s *= exp(-length(u - q) * 9.0);
  gl_FragColor = vec4(1.0, 0.68, 0.32, smoothstep(0.0, 0.45, s) * glow * 0.8);
}`;

// Haces de luz: quads a lo largo de la dirección del sol, sumados (rayos volumétricos baratos)
const FS_HAZ = /* glsl */ `varying vec2 vUv;
uniform float uTime, uInt;
void main(){
  float t = vUv.y;
  float a = smoothstep(0.0, 0.1, t) * pow(1.0 - t, 1.7);
  float w = smoothstep(0.0, 0.42, vUv.x) * smoothstep(1.0, 0.58, vUv.x);
  float n = 0.72 + 0.28 * sin(t * 9.0 - uTime * 0.35 + vUv.x * 5.0) * sin(t * 4.0 + uTime * 0.21);
  gl_FragColor = vec4(vec3(1.0, 0.95, 0.86), a * w * n * uInt);
}`;

// Polvo flotando dentro de los haces
const VS_POLVO = /* glsl */ `attribute vec4 semilla;
uniform float uTime, uTam;
varying float vA;
void main(){
  vec3 p = position;
  float t = uTime;
  p += vec3(sin(t * 0.13 + semilla.x * 6.28), sin(t * 0.09 + semilla.y * 6.28) * 0.7, sin(t * 0.11 + semilla.z * 6.28)) * 0.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vA = (0.45 + 0.55 * sin(t * (0.5 + semilla.w) + semilla.x * 20.0)) * semilla.w;
  gl_PointSize = uTam * (0.6 + semilla.z) * (20.0 / -mv.z);
}`;
const FS_POLVO = /* glsl */ `varying float vA;
uniform float uInt;
void main(){
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(vec3(1.0, 0.94, 0.84), smoothstep(0.5, 0.05, d) * max(vA, 0.0) * uInt);
}`;

// ---------------------------------------------------------------------
//  Centro de la base de la pieza (sin el asa), desde el bitmap ya cargado
// ---------------------------------------------------------------------
function centroDe(bmp, invertida) {
  try {
    const W0 = bmp.width || bmp.naturalWidth, H0 = bmp.height || bmp.naturalHeight;
    const w = 120, h = Math.max(1, Math.round((w * H0) / W0));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(bmp, 0, 0, w, h);
    const n = h - Math.floor(h * 0.85);
    const y0 = invertida ? 0 : h - n; // en el bitmap invertido la base está arriba
    const d = x.getImageData(0, y0, w, n).data;
    let a = w, b = -1;
    for (let y = 0; y < n; y++)
      for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 40) { if (i < a) a = i; if (i > b) b = i; }
    return b > a ? (a + b) / 2 / w : 0.5;
  } catch {
    return 0.5;
  }
}

// Miniatura (96 px) para las siluetas de las piezas lejanas
function miniDe(T, bmp, flipY) {
  const W0 = bmp.width || bmp.naturalWidth, H0 = bmp.height || bmp.naturalHeight;
  const w = 96, h = Math.max(1, Math.round((w * H0) / W0));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  const t = new T.CanvasTexture(c);
  t.flipY = flipY;
  t.colorSpace = T.NoColorSpace;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return { tex: t, ratio: W0 / H0 };
}

// Tamaño de una pieza en unidades 3D: misma "superficie visual" sin importar la forma de la foto,
// corrida para que la base (no el asa) quede sobre su lugar del círculo.
function tamPieza(ratio = 1, cx = 0.5) {
  let hh = Math.sqrt((PIEZA_B * PIEZA_B * 0.68) / ratio), ww = ratio * hh;
  if (ww > 1.5) { ww = 1.5; hh = ww / ratio; }
  if (hh > 1.6) { hh = 1.6; ww = hh * ratio; }
  return { wU: ww, hU: hh, shiftU: (0.5 - cx) * ww };
}

// Colores de una pieza (OKLab), iguales a los del CSS
const LAB_LUZ = hexAOklab("#fff6e6"), LAB_SOM = hexAOklab("#1a0c08"), LAB_OSC = hexAOklab("#1b0d08"), LAB_CLA = hexAOklab("#fbeee0");
const memoCol = new WeakMap();
function coloresDe(pz) {
  if (pz && memoCol.has(pz)) return memoCol.get(pz);
  const par = vivoLab(pz?.pared || "#c46a4c", 1.14);
  const ton = pz?.clara ? mezclaOklch(par, LAB_OSC, 0.72) : mezclaOklch(par, LAB_CLA, 0.55);
  const r = {
    par, luz: mezclaOklch(par, LAB_LUZ, 0.72), som: mezclaOklch(par, LAB_SOM, 0.7), ton,
    mes: vivoLab(pz?.mesa || "#e6ded2", 1.06),
  };
  if (pz) memoCol.set(pz, r);
  return r;
}

// =====================================================================
export default function Taller(props) {
  const ref = useRef(null);
  const pr = useRef(props);
  pr.current = props;
  const motor = useRef(null);

  useEffect(() => {
    let vivo = true;
    let cleanup = () => {};
    (async () => {
      let T;
      try {
        T = await import("three");
      } catch {
        return pr.current.onFalla?.();
      }
      const canvas = ref.current;
      if (!vivo || !canvas) return;
      let renderer;
      try {
        renderer = new T.WebGLRenderer({ canvas, alpha: false, antialias: true, powerPreference: "high-performance" });
      } catch {
        return pr.current.onFalla?.();
      }
      const rec = pr.current.recorrido || new Recorrido(0);
      const tactil = window.matchMedia("(pointer: coarse)").matches;
      const mqReducido = window.matchMedia("(prefers-reduced-motion: reduce)");
      const flojo = (navigator.deviceMemory && navigator.deviceMemory <= 3) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
      // arranca en alto (nítido); si el cuadro no da, la calidad adaptativa baja sola
      const nivelIni = pr.current.nivel || (flojo ? "medio" : "alto");
      const cal = { nivel: nivelIni, techo: nivelIni, ...NIVELES[nivelIni] };

      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFShadowMap;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new T.Scene();
      const cam = new T.PerspectiveCamera(40, 1, 0.1, 500);
      const ref0 = new T.PerspectiveCamera(40, 1, 0.1, 500); // cámara en reposo (encuadre, medidas)

      const hemi = new T.HemisphereLight("#fff6ea", "#e6ded2", 1.25);
      scene.add(hemi);
      const sol = new T.DirectionalLight("#fff1dc", 2.6);
      sol.castShadow = true;
      sol.shadow.mapSize.set(cal.sombra, cal.sombra);
      sol.shadow.bias = -0.0004;
      sol.shadow.normalBias = 0.02;
      sol.shadow.radius = 5;
      sol.position.set(SOL[0], HT + SOL[1], SOL[2]);
      sol.target.position.set(0, HT, 0);
      scene.add(sol, sol.target);
      const punto = new T.PointLight("#ffae55", 0, 7, 2);
      scene.add(punto);

      // ---------- Pared + piso ----------
      const texCk = texCookie(T), texGr = texGrano(T);
      const negro = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
      negro.needsUpdate = true;
      const v3 = () => new T.Vector3();
      const uSet = {
        uZW: { value: 6 }, uSw: { value: 14 }, uPR: { value: 1 }, uHor: { value: 400 },
        uTime: { value: 0 }, uSombra: { value: 0.16 }, uRes: { value: new T.Vector2(1, 1) }, uVista: { value: new T.Vector2(6, 12) },
        uEsm: { value: new T.Vector4(0, -9, 0, 1.6) }, uDL: { value: new T.Vector3(...DL) },
        uPal0: { value: negro }, uPal1: { value: negro },
        uPalR: { value: [new T.Vector4(), new T.Vector4()] }, uPalM: { value: [new T.Vector4(), new T.Vector4()] },
        uGlow: { value: new T.Vector4() },
        uCookie: { value: texCk }, uGrano: { value: texGr },
      };
      for (const n of ["Par", "Luz", "Som", "Ton", "Mes"]) for (const s of ["A", "B", "AL", "BL"]) uSet["u" + n + s] = { value: v3() };
      const vsSet = T.ShaderLib.shadow.vertexShader
        .replace("void main() {", "varying vec3 vW;\nvoid main() {")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n\tvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      const matSet = (piso) => {
        const u = T.UniformsUtils.merge([T.UniformsLib.lights]);
        Object.assign(u, uSet);
        if (piso) u.uSombra = { value: 0.3 };
        return new T.ShaderMaterial({ uniforms: u, vertexShader: vsSet, fragmentShader: FS_SET, lights: true, defines: piso ? { MESA: 1 } : {} });
      };
      const geoPared = new T.PlaneGeometry(400, 90);
      geoPared.translate(0, 45, 0);
      const pared = new T.Mesh(geoPared, matSet(false));
      pared.receiveShadow = true;
      pared.frustumCulled = false;
      const geoPiso = new T.PlaneGeometry(400, 160);
      geoPiso.rotateX(-Math.PI / 2);
      geoPiso.translate(0, 0, 80);
      const piso = new T.Mesh(geoPiso, matSet(true));
      piso.receiveShadow = true;
      piso.frustumCulled = false;
      scene.add(pared, piso);

      // ---------- La mesa (gira con el ángulo) ----------
      const cacheMesa = {};
      let mesa = null, mesaClave = "";
      const ponerMesa = () => {
        const tipo = pr.current.mesa || pr.current.piezas?.[0]?.tipo || "travertino";
        const clave = tipo + "|" + st.RM.toFixed(3);
        if (clave === mesaClave) return;
        mesaClave = clave;
        if (mesa) {
          scene.remove(mesa);
          mesa.userData.dispose();
        }
        mesa = armarMesa(T, tipo, st.RM, cacheMesa);
        scene.add(mesa);
        st.sombraSucia = true;
      };

      // ---------- Haces y polvo ----------
      const uHaz = { uTime: { value: 0 }, uInt: { value: 0.06 } };
      const matHaz = new T.ShaderMaterial({ uniforms: uHaz, vertexShader: VS, fragmentShader: FS_HAZ, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false });
      const uPolvo = { uTime: { value: 0 }, uTam: { value: 2 }, uInt: { value: 0.55 } };
      const matPolvo = new T.ShaderMaterial({ uniforms: uPolvo, vertexShader: VS_POLVO, fragmentShader: FS_POLVO, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
      const haces = new T.Mesh(new T.BufferGeometry(), matHaz);
      haces.renderOrder = 5000;
      haces.frustumCulled = false;
      const polvo = new T.Points(new T.BufferGeometry(), matPolvo);
      polvo.renderOrder = 5001;
      polvo.frustumCulled = false;
      scene.add(haces, polvo);

      // ---------- Estado ----------
      const vacio = new T.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
      vacio.needsUpdate = true;
      const vacioDep = new T.DataTexture(new Uint8Array([0]), 1, 1, T.RedFormat, T.UnsignedByteType);
      vacioDep.unpackAlignment = 1;
      vacioDep.needsUpdate = true;
      const st = {
        W: 0, H: 0, fov: 40, dist: 20, off: [0, 0], yBase: 0, ppuF: 1, ppuYF: 1, apoyo: 0, hor: 0, backTop: 0,
        boost: BOOST, RP: RP0, RM: RP0 + BORDE, ZW: RP0 + BORDE + GAP_PARED, alfa: Math.PI / 5, N: 0, vistaW: 10, vistaH: 10, zMax: 30,
        last: 0, ema: 16.7, muestras: 0, bien: 0, modo: 0, sombraSucia: true, pausado: !!pr.current.pausado, oculto: document.hidden,
        raf: 0, tiltX: 0, tiltY: 0, version: 1, zoom: pr.current.enfoque ? 1 : 0, zoomObj: pr.current.enfoque ? 1 : 0, zoom0: 0, zoomT: 0, medirPend: false,
        avisado: false, rectClave: "", fundido: 0, techo: 0, k0: Math.round(rec.s), base: null,
      };

      // ---------- Fotos en memoria (por URL) ----------
      const fotos = new Map();
      const minis = new Map(); // src → { tex, ratio } (siluetas)
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 50));
      const liberarFoto = (e) => {
        e.tex?.image?.close?.();
        e.tex?.dispose();
        e.dep?.dispose();
      };
      const subir = (e) => {
        if (e.listo || !e.tex) return;
        renderer.initTexture(e.tex);
        renderer.initTexture(e.dep);
        e.listo = true;
        st.version++;
        pedirCuadro();
      };
      const cargarFoto = (pz, urgente) => {
        if (!pz?.src) return null;
        let e = fotos.get(pz.src);
        if (e) {
          if (urgente && !e.listo && e.tex) subir(e);
          return e;
        }
        e = { listo: false, error: false };
        fotos.set(pz.src, e);
        (async () => {
          const foto = await prepararFoto(pz.src, pz.grande);
          const pd = await foto.prof;
          if (!vivo || fotos.get(pz.src) !== e) return foto.bmp.close?.();
          const tex = new T.Texture(foto.bmp);
          tex.flipY = foto.flipY;
          tex.colorSpace = T.NoColorSpace;
          tex.premultiplyAlpha = false;
          tex.minFilter = T.LinearMipmapLinearFilter;
          tex.magFilter = T.LinearFilter;
          tex.anisotropy = 4;
          tex.needsUpdate = true;
          const dep = new T.DataTexture(pd.data, pd.w, pd.h, T.RedFormat, T.UnsignedByteType);
          dep.unpackAlignment = 1;
          dep.minFilter = T.LinearMipmapLinearFilter;
          dep.magFilter = T.LinearFilter;
          dep.generateMipmaps = true;
          dep.needsUpdate = true;
          Object.assign(e, { tex, dep, px: 1.5 / pd.w, ratio: foto.ratio || 1, cx: centroDe(foto.bmp, !foto.flipY) });
          if (!minis.has(pz.src) && st.N > NVENT) minis.set(pz.src, { ...miniDe(T, foto.bmp, foto.flipY), cx: e.cx });
          if (urgente) subir(e);
          else idle(() => vivo && fotos.get(pz.src) === e && subir(e), { timeout: 600 });
        })().catch((err) => {
          console.warn("Taller:", err);
          e.error = true;
          st.version++;
        });
        return e;
      };
      // silueta de una pieza lejana: solo la miniatura (sin profundidad ni foto grande en la GPU)
      const cargarMini = (pz) => {
        if (!pz?.src || minis.has(pz.src)) return;
        minis.set(pz.src, null);
        cargarImagen(pz.src, pz.grande)
          .then((img) => {
            if (!vivo) return;
            minis.set(pz.src, { ...miniDe(T, img, true), cx: centroDe(img, false) });
            st.version++;
            pedirCuadro();
          })
          .catch(() => {});
      };

      // ---------- Palabras: textura por pieza, generadas con anticipación (±2) ----------
      const palabras = new Map(); // índice de pieza → { clave, tex, m }
      let fuenteOk = false;
      const resPalabra = (pz) => {
        const F = tamPalabra(pz.palabra || "", st.W, st.H);
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        return Math.round((F * dpr * 1.35) / 24) * 24;
      };
      const palabraDe = (i, ya) => {
        const pz = (pr.current.piezas || [])[i];
        if (!pz?.palabra || !fuenteOk || !st.W) return null;
        const clave = pz.palabra + "|" + resPalabra(pz);
        const e = palabras.get(i);
        if (e?.clave === clave) return e.tex ? e : null;
        const vieja = e?.tex && e.clave?.split("|")[0] === pz.palabra ? e : null;
        if (e?.pendiente === clave && !ya) return vieja;
        const hacer = () => {
          if (!vivo) return;
          const viejo = palabras.get(i);
          if (viejo?.clave === clave && viejo.tex) return;
          const { canvas: c, m } = pintarPalabra(pz.palabra, resPalabra(pz), tactil ? 2048 : 4096);
          const tex = new T.CanvasTexture(c);
          tex.format = T.RedFormat;
          tex.colorSpace = T.NoColorSpace;
          tex.minFilter = T.LinearMipmapLinearFilter;
          tex.magFilter = T.LinearFilter;
          tex.generateMipmaps = true;
          tex.anisotropy = 8;
          tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
          renderer.initTexture(tex);
          viejo?.tex?.dispose();
          palabras.set(i, { clave, tex, m });
          st.version++;
          pedirCuadro();
        };
        if (ya) {
          hacer();
          return palabras.get(i)?.tex ? palabras.get(i) : null;
        }
        palabras.set(i, { ...(e || {}), pendiente: clave });
        idle(hacer, { timeout: 500 });
        return vieja;
      };

      // distancia (en piezas) de la pieza i al frente, por el camino más corto
      const distFrente = (i, s, N) => {
        let d = modN(i - s, N);
        if (d > N / 2) d -= N;
        return d;
      };
      const enVentana = (i, s, N) => N <= NVENT || Math.abs(distFrente(i, s, N)) <= VENT + 0.5;

      // Precarga: fotos de las piezas cercanas al frente (las dos de al lado, urgentes), palabras ±2.
      // Con muchas piezas se liberan las fotos lejanas y se cargan miniaturas para las siluetas.
      const precargar = () => {
        const piezas = pr.current.piezas || [];
        const N = piezas.length;
        if (!N) return;
        const s = rec.s, base = Math.round(s);
        const cerca = [];
        const R = N <= NVENT ? Math.ceil(N / 2) : VENT + 1;
        for (let d = 0; d <= R; d++) for (const sg of d ? [1, -1] : [1]) cerca.push([modN(base + d * sg, N), d]);
        const quedan = new Set();
        for (const [i, d] of cerca) {
          cargarFoto(piezas[i], d <= 1);
          quedan.add(piezas[i]?.src);
        }
        for (let d = -2; d <= 2; d++) palabraDe(modN(base + d, N), false);
        if (N > NVENT) {
          for (const [src, e] of fotos) {
            if (quedan.has(src) || !e.listo) continue;
            liberarFoto(e);
            fotos.delete(src);
          }
          let n = 0;
          for (let i = 0; i < N; i++) if (!minis.has(piezas[i]?.src)) idle(() => vivo && cargarMini(piezas[i]), { timeout: 1500 + 120 * n++ });
        }
        for (const [i, e] of palabras) {
          if (Math.abs(distFrente(i, s, N)) <= 2.5) continue;
          e.tex?.dispose();
          palabras.delete(i);
        }
      };

      // ---------- Piezas (un lugar por pieza; con foto, silueta u oculta) ----------
      const geoPieza = new T.PlaneGeometry(1, 1);
      geoPieza.translate(0, 0.5, 0);
      const geoHalo = new T.PlaneGeometry(1 / (1 - 2 * MX), 1 / (1 - MY));
      geoHalo.translate(0, 0.5 / (1 - MY), 0);
      const slots = [];
      const nuevoSlot = () => {
        const grupo = new T.Group();
        const uni = {
          img: { value: vacio }, dep: { value: vacioDep }, tilt: { value: new T.Vector2() },
          px: { value: 0.005 }, fuerza: { value: 1 }, glow: { value: 0 }, blur: { value: 0 },
          luz: { value: 1 }, rim: { value: 0 }, alfa: { value: 1 },
        };
        const pieza = new T.Mesh(geoPieza, new T.ShaderMaterial({ uniforms: uni, vertexShader: VS, fragmentShader: FS_PIEZA, transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
        const matSombra = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, alphaTest: 0.5, map: vacio, side: T.DoubleSide });
        pieza.customDepthMaterial = matSombra;
        const uniHalo = { dep: uni.dep, glow: { value: 0 } };
        const halo = new T.Mesh(geoHalo, new T.ShaderMaterial({ uniforms: uniHalo, vertexShader: VS, fragmentShader: FS_HALO, transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
        halo.visible = false;
        const pz = new T.Group(); // la pieza + su halo: mira a la cámara (con su leve giro)
        pz.add(halo, pieza);
        grupo.add(pz);
        grupo.visible = false;
        scene.add(grupo);
        return { i: -1, grupo, pz, pieza, halo, uni, uniHalo, matSombra, clave: "", lay: null, foto: null, modo: "", glow: false };
      };

      // Una pieza: qué textura usa (foto o miniatura) y su tamaño. Solo trabaja si algo cambió.
      const refrescar = (sl, i, ventana, urgente) => {
        const pz = (pr.current.piezas || [])[i];
        const foto = ventana && pz?.src ? cargarFoto(pz, urgente) : null;
        const mini = !foto?.listo && pz?.src ? minis.get(pz.src) : null;
        const modo = foto?.listo ? "foto" : mini ? "sil" : "";
        const clave = [i, pz?.src, modo, foto?.error, pz?.glow, st.version].join("|");
        if (clave === sl.clave) return;
        sl.clave = clave;
        sl.i = i;
        sl.modo = modo;
        sl.glow = !!pz?.glow && modo === "foto";
        if (!modo) {
          sl.grupo.visible = false;
          sl.foto = null;
          sl.lay = sl.lay || tamPieza();
          return;
        }
        const fuente = modo === "foto" ? foto : mini;
        const lay = tamPieza(fuente.ratio, fuente.cx ?? 0.5);
        sl.lay = lay;
        sl.pieza.scale.set(lay.wU, lay.hU, 1);
        sl.pieza.position.set(lay.shiftU, 0, 0);
        sl.halo.scale.set(lay.wU, lay.hU, 1);
        sl.halo.position.set(lay.shiftU, 0, 0);
        sl.uni.img.value = fuente.tex;
        sl.uni.dep.value = modo === "foto" ? foto.dep : vacioDep;
        sl.uni.px.value = modo === "foto" ? foto.px : 0.01;
        sl.uniHalo.dep.value = sl.uni.dep.value;
        sl.matSombra.map = modo === "foto" ? foto.tex : vacio;
        sl.pieza.castShadow = modo === "foto";
        sl.halo.visible = sl.glow;
        sl.foto = modo === "foto" ? foto : null;
        st.sombraSucia = true;
        st.rectClave = "";
      };

      // ---------- Encuadre ----------
      const vtmp = new T.Vector3();
      const proy = (c, x, y, z) => {
        vtmp.set(x, y, z).project(c);
        return [((vtmp.x + 1) / 2) * st.W, ((1 - vtmp.y) / 2) * st.H];
      };
      // punto de la pared (z = -ZW) que cae en el píxel (px, py) con la cámara en reposo
      const rayo = (px, py) => {
        vtmp.set((px / st.W) * 2 - 1, -(py / st.H) * 2 + 1, 0.5).unproject(ref0);
        const o = ref0.position;
        return [o, vtmp.sub(o).normalize()];
      };
      const enPared = (px, py) => {
        const [o, d] = rayo(px, py);
        const t = (-st.ZW - o.z) / d.z;
        return [o.x + d.x * t, o.y + d.y * t];
      };
      const camaraEn = (c, dist, off) => {
        c.fov = st.fov;
        c.aspect = st.W / st.H;
        c.position.set(0, HT + Math.sin(PITCH) * dist, Math.cos(PITCH) * dist);
        c.lookAt(0, HT, 0);
        if (off) c.setViewOffset(st.W, st.H, off[0], off[1], st.W, st.H);
        else c.clearViewOffset();
        c.updateProjectionMatrix();
        c.updateMatrixWorld();
      };
      // tamaño relativo de una pieza según su ángulo: la de adelante, más grande
      const escalaEn = (a) => 1 + st.boost * suave(Math.max(0, 1 - Math.abs(a) / st.alfa));

      // Con la cámara a `dist`, corrida para que la base de la pieza activa caiga en yBase:
      // cuánto sobresale el círculo a los costados y dónde queda (en pantalla) la pieza más alta del fondo.
      const evaluar = (dist) => {
        camaraEn(ref0, dist, null);
        const off = [0, proy(ref0, 0, HT, st.RP)[1] - st.yBase];
        camaraEn(ref0, dist, off);
        let ext = proy(ref0, st.RM, HT, 0)[0] - st.W / 2, backTop = Infinity;
        for (let n = 0; n <= 48; n++) {
          const a = (n / 48) * Math.PI;
          const sc = escalaEn(a);
          const x = st.RP * Math.sin(a), z = st.RP * Math.cos(a);
          for (const yy of [HT, HT + ALTO_REF * sc]) ext = Math.max(ext, proy(ref0, x + ANCHO_REF * 0.5 * sc, yy, z)[0] - st.W / 2);
          if (st.N > 1 && a >= st.alfa * 0.999) backTop = Math.min(backTop, proy(ref0, x, HT + ALTO_REF * sc, z)[1]);
        }
        if (st.N <= 1) backTop = proy(ref0, 0, HT, -st.RM)[1];
        return { ext, backTop, off };
      };
      const buscar = (ok) => {
        let lo = 3, hi = 260;
        for (let n = 0; n < 32; n++) {
          const mid = (lo + hi) / 2;
          if (ok(evaluar(mid))) hi = mid;
          else lo = mid;
        }
        return hi;
      };

      const medir = () => {
        const W = canvas.clientWidth, H = canvas.clientHeight;
        if (!W || !H) return;
        st.W = W;
        st.H = H;
        const piezas = pr.current.piezas || [];
        const N = Math.max(1, piezas.length);
        st.N = piezas.length;
        const prMax = tactil ? cal.prT : cal.pr;
        const pxr = Math.min(window.devicePixelRatio || 1, prMax);
        renderer.setPixelRatio(pxr);
        renderer.setSize(W, H, false);

        // la mesa: el radio crece con la cantidad de piezas (que entren sin encimarse) hasta un tope
        st.alfa = (Math.PI * 2) / N;
        // con muchas piezas el círculo queda más chico en pantalla: la activa se agranda un poco más
        st.boost = BOOST + 0.3 * Math.min(1, Math.max(0, (N - 10) / 20));
        st.RP = Math.min(RP_MAX, Math.max(RP0, (N * 0.95) / (Math.PI * 2)));
        st.RM = st.RP + BORDE;
        st.ZW = st.RM + GAP_PARED;
        ponerMesa();

        // encuadre: celu → el círculo entero de lado a lado, la activa en el tercio inferior-medio;
        // compu → círculo más abierto, con aire a los costados. Arriba siempre queda lugar para la palabra.
        const previa = !!pr.current.vista;
        const asp = W / H;
        st.fov = Math.min(74, Math.max(30, (2 * Math.atan(Math.tan((38 * Math.PI) / 360) / asp) * 180) / Math.PI));
        st.techo = pr.current.techo ?? (W > 700 ? 0.1 * H : 0.125 * H);
        st.yBase = previa ? 0.8 * H : Math.min(0.655 * H, H - 230);
        const margen = previa ? 10 : W >= 900 ? W * 0.14 : 6;
        const banda = previa ? 0.22 * H : Math.min(210, Math.max(74, (W >= 900 ? 0.21 : 0.15) * H));
        const dH = buscar((r) => r.ext <= W / 2 - margen);
        const dV = buscar((r) => r.backTop >= st.techo + banda);
        st.dist = Math.max(dH, dV);
        const r = evaluar(st.dist);
        st.off = r.off;
        st.backTop = r.backTop;
        cam.copy(ref0);
        st.ppuF = proy(ref0, 1, HT, st.RP)[0] - proy(ref0, 0, HT, st.RP)[0];
        st.ppuYF = proy(ref0, 0, HT, st.RP)[1] - proy(ref0, 0, HT + 1, st.RP)[1];
        // 1:1 con el dedo: lo que se corre la pieza de adelante por cada pieza que gira la mesa
        rec.pxPorEstacion = N > 1 ? Math.min(st.RP * st.alfa * st.ppuF, W * 0.85) : 400;
        st.apoyo = st.yBase;
        st.hor = proy(ref0, 0, 0, -st.ZW)[1];
        const [xl, yt] = enPared(0, 0), [xr] = enPared(W, 0), [, yb] = enPared(0, Math.min(st.hor, H));
        st.vistaW = xr - xl;
        st.vistaH = Math.max(4, yt - yb);
        {
          const [o, d] = rayo(W / 2, H);
          st.zMax = d.y < -1e-3 ? o.z + d.z * (-o.y / d.y) + st.ZW : 40;
        }
        uSet.uZW.value = st.ZW;
        uSet.uSw.value = Math.max(12, Math.min(34, st.vistaW * 1.05));
        uSet.uPR.value = pxr;
        uSet.uHor.value = st.hor;
        uSet.uRes.value.set(W, H);
        uSet.uVista.value.set(st.vistaW, st.vistaH);
        uPolvo.uTam.value = 2.2 * pxr;
        pared.position.z = -st.ZW;
        piso.position.z = -st.ZW;
        geomLuz();
        const lado = st.RM + 2.6;
        Object.assign(sol.shadow.camera, { left: -lado, right: lado, top: lado, bottom: -lado, near: 1, far: 60 });
        sol.shadow.camera.updateProjectionMatrix();
        const parent = canvas.closest(".tienda, .adm-escena") || canvas.parentElement;
        parent?.style.setProperty("--apoyo", st.apoyo.toFixed(1) + "px");
        parent?.style.setProperty("--horizonte", st.hor.toFixed(1) + "px");
        rectPal.clear();
        st.version++;
        st.sombraSucia = true;
        st.rectClave = "";
        precargar();
        pedirCuadro();
      };

      // Dónde va la palabra de la pieza i (en la pared): centrada arriba, debajo del logo; las piezas
      // del fondo del círculo no la pueden tapar y la activa tapa como mucho la parte de abajo.
      const rectPal = new Map();
      const rectPalabra = (i) => {
        const pz = (pr.current.piezas || [])[i];
        if (!pz?.palabra || !fuenteOk) return null;
        const sl = slots[i];
        const hU = sl?.modo === "foto" ? sl.lay.hU : ALTO_REF;
        const clave = pz.palabra + "|" + hU.toFixed(3);
        const memo = rectPal.get(i);
        if (memo?.clave === clave) return memo.r;
        const m = medirPalabra(pz.palabra);
        let F = tamPalabra(pz.palabra, st.W, st.H);
        let hP = m.h * F;
        const centro = (pr.current.vista ? 0.27 : 0.255) * st.H;
        let top = centro + m.cy * F - hP / 2;
        const topeActiva = st.yBase - hU * (1 + st.boost) * st.ppuYF;
        const lim = Math.min(st.backTop - 6, topeActiva + 0.3 * hP);
        if (top + hP > lim) top = lim - hP;
        if (top < st.techo) {
          top = st.techo;
          if (top + hP > lim) {
            F = Math.max(24, (lim - st.techo) / m.h);
            hP = m.h * F;
          }
        }
        const bot = top + hP, cx = st.W / 2 + m.cx * F;
        const [, yTop] = enPared(cx, top);
        const [, yBot] = enPared(cx, bot);
        const [x0] = enPared(cx - (m.w * F) / 2, (top + bot) / 2);
        const [x1] = enPared(cx + (m.w * F) / 2, (top + bot) / 2);
        const r = { cx: (x0 + x1) / 2, cy: (yTop + yBot) / 2, hw: (x1 - x0) / 2, hh: (yTop - yBot) / 2 };
        rectPal.set(i, { clave, r });
        return r;
      };

      // Haces y polvo desde las ventanas de la textura de luz
      const geomLuz = () => {
        const { u0, u1, y0, y1 } = CAJA_VENTANA;
        const Sw = uSet.uSw.value, ux = (u) => (u - 0.5) * Sw;
        const zW = -st.ZW;
        const panes = [
          [ux(u0 + (u1 - u0) * 0.38), y0 + (y1 - y0) * 0.78, (u1 - u0) * Sw * 0.24],
          [ux(u0 + (u1 - u0) * 0.68), y0 + (y1 - y0) * 0.78, (u1 - u0) * Sw * 0.26],
          [ux(u0 + (u1 - u0) * 0.3), y0 + (y1 - y0) * 0.6, (u1 - u0) * Sw * 0.16],
        ];
        const L = 13, back = DL.map((v) => -v);
        const pos = [], uv = [], idx = [];
        panes.forEach(([x, y, w], b) => {
          const o = [x, y, zW];
          const c = [[o[0] - w / 2, o[1], o[2]], [o[0] + w / 2, o[1], o[2]]];
          const f = c.map((p) => [p[0] + back[0] * L, p[1] + back[1] * L, p[2] + back[2] * L]);
          pos.push(...c[0], ...c[1], ...f[1], ...f[0]);
          uv.push(0, 0, 1, 0, 1, 1, 0, 1);
          const i = b * 4;
          idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
        });
        haces.geometry.dispose();
        haces.geometry = new T.BufferGeometry();
        haces.geometry.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        haces.geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
        haces.geometry.setIndex(idx);
        const r = rnd(5), n = 140;
        const pp = new Float32Array(n * 3), se = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
          const [x, y, w] = panes[Math.floor(r() * panes.length)];
          const t = 0.06 + r() * 0.7, a = (r() - 0.5) * w * 0.9, g = (r() - 0.5) * 0.9;
          pp[i * 3] = x + a + back[0] * L * t + g * 0.3;
          pp[i * 3 + 1] = y + back[1] * L * t + g * 0.4;
          pp[i * 3 + 2] = zW + back[2] * L * t + g;
          se.set([r(), r(), r(), 0.3 + r() * 0.7], i * 4);
        }
        polvo.geometry.dispose();
        polvo.geometry = new T.BufferGeometry();
        polvo.geometry.setAttribute("position", new T.BufferAttribute(pp, 3));
        polvo.geometry.setAttribute("semilla", new T.BufferAttribute(se, 4));
        aplicarNivel();
      };

      const aplicarNivel = () => {
        uHaz.uInt.value = 0.065 * cal.haces;
        polvo.geometry.setDrawRange(0, cal.polvo);
        haces.visible = cal.haces > 0;
        polvo.visible = cal.polvo > 0;
      };

      const cambiarNivel = (nuevo) => {
        if (nuevo === cal.nivel) return;
        const antes = cal.sombra, prAntes = tactil ? cal.prT : cal.pr;
        Object.assign(cal, NIVELES[nuevo], { nivel: nuevo });
        if (cal.sombra !== antes) {
          sol.shadow.mapSize.set(cal.sombra, cal.sombra);
          sol.shadow.map?.dispose();
          sol.shadow.map = null;
          st.sombraSucia = true;
        }
        st.muestras = 0;
        st.bien = 0;
        aplicarNivel();
        // efectos y sombra cambian al instante; la resolución (re-armar el lienzo) espera a que el
        // gesto termine, para no meter un tirón debajo del dedo
        if ((tactil ? cal.prT : cal.pr) !== prAntes) {
          if (rec.moviendo) st.medirPend = true;
          else medir();
        }
        pr.current.onNivel?.(nuevo);
      };

      // colores en los uniforms (sRGB + OKLab)
      const ponerColor = (nombre, lab, AoB) => {
        uSet["u" + nombre + AoB + "L"].value.set(lab[0], lab[1], lab[2]);
        const c = oklabARgb(lab);
        uSet["u" + nombre + AoB].value.set(c[0], c[1], c[2]);
      };
      const colEst = { A: null, B: null };
      const ponerColores = (cA, cB) => {
        if (colEst.A !== cA) {
          for (const [n, k] of [["Par", "par"], ["Luz", "luz"], ["Som", "som"], ["Ton", "ton"], ["Mes", "mes"]]) ponerColor(n, cA[k], "A");
          colEst.A = cA;
        }
        if (colEst.B !== cB) {
          for (const [n, k] of [["Par", "par"], ["Luz", "luz"], ["Som", "som"], ["Ton", "ton"], ["Mes", "mes"]]) ponerColor(n, cB[k], "B");
          colEst.B = cB;
        }
      };

      // ---------- Bucle ----------
      const t0 = performance.now();
      const pedirCuadro = () => {
        if (!st.raf && vivo && !st.oculto && (!st.pausado || st.zoomObj !== st.zoom)) st.raf = requestAnimationFrame(cuadro);
      };
      const camPos = new T.Vector3(), camMira = new T.Vector3(), tmp = new T.Vector3(), pc = new T.Vector3();
      const colHemi = new T.Color(), colA = new T.Color(), colB = new T.Color();
      const visibles = [];

      // zona de la pantalla donde tiene que entrar la pieza entera con la ficha abierta (px CSS)
      const zonaLibre = () => {
        if (st.W >= 900) {
          const libre = st.W - Math.min(460, st.W * 0.4);
          return { cx: libre / 2, cy: st.H * 0.5, w: libre * 0.7, h: st.H * 0.6 };
        }
        const arriba = Math.max(st.H * 0.07, 66), abajo = st.H * 0.42 - 16; // debajo del logo; la ficha mide como mucho 58dvh
        return { cx: st.W / 2, cy: (arriba + abajo) / 2, w: st.W * 0.8, h: (abajo - arriba) * 0.9 };
      };

      // dónde cae en la pared (detrás) un punto del espacio visto desde la cámara en reposo
      const detras = (x, y, z) => {
        const o = ref0.position;
        const dx = x - o.x, dy = y - o.y, dz = z - o.z;
        const t = (-st.ZW - o.z) / dz;
        return [o.x + dx * t, o.y + dy * t];
      };

      const cuadro = (now) => {
        st.raf = 0;
        if (!vivo || st.oculto) return;
        const zoomando = st.zoomObj !== st.zoom;
        if (st.pausado && !zoomando) return;
        st.raf = requestAnimationFrame(cuadro);
        const moviendo = rec.moviendo;
        const activo = moviendo || zoomando || now - input.t < 1000 || st.fundido > 0;
        const fps = !activo ? 30 : 60;
        if (fps !== st.modo) {
          st.modo = fps;
          st.muestras = 0;
          st.ema = 1000 / fps;
        }
        if (now - st.last < 1000 / fps - 3) return;
        const dt = st.last ? Math.min(100, now - st.last) : 16.7;
        st.last = now;
        // calidad adaptativa: con 60 fps, si el cuadro promedio pasa ~20 ms se baja un nivel;
        // si va sobrado un buen rato, se vuelve a subir (hasta el nivel inicial)
        if (fps === 60 && !st.pausado) {
          st.ema += (dt - st.ema) * 0.08;
          st.muestras++;
          if (st.muestras > 40 && st.ema > 20.5 && cal.nivel !== "bajo") cambiarNivel(ORDEN[ORDEN.indexOf(cal.nivel) - 1]);
          else if (st.ema < 15.5) {
            if (++st.bien > 600 && cal.nivel !== cal.techo) cambiarNivel(ORDEN[ORDEN.indexOf(cal.nivel) + 1]);
          } else st.bien = 0;
        }

        rec.paso(now);
        const s = rec.s;
        const piezas = pr.current.piezas || [];
        const N = piezas.length;
        const red = pr.current.reducido || mqReducido.matches;
        const tiempo = (now - t0) / 1000;
        if (!N) {
          renderer.render(scene, cam);
          return;
        }

        const base = Math.round(s);
        if (base !== st.base) {
          st.base = base;
          precargar();
        }
        const iF = modN(base, N);

        // push-in (tocar la pieza): ZOOM_MS con ease-out cúbico, desde donde esté (se puede interrumpir)
        if (red) st.zoom = st.zoomObj;
        else if (st.zoom !== st.zoomObj) {
          const p = Math.min(1, (now - (st.zoomT || now)) / ZOOM_MS);
          st.zoom = p >= 1 ? st.zoomObj : st.zoom0 + (st.zoomObj - st.zoom0) * (1 - Math.pow(1 - p, 3));
        }
        const z = Math.max(0, Math.min(1, st.zoom));

        // cámara: quieta en reposo; con la ficha abierta se acerca a la pieza de adelante y la deja
        // entera en la zona libre (celu: franja de arriba; compu: a la izquierda de la ficha)
        while (slots.length < N) slots.push(nuevoSlot());
        const slF = slots[iF];
        camPos.copy(ref0.position);
        camMira.set(0, HT, 0);
        let ox = st.off[0], oy = st.off[1];
        if (z > 0 && slF?.lay) {
          const enc = zonaLibre();
          const sc = 1 + st.boost;
          const hU = slF.lay.hU * sc, wU = slF.lay.wU * sc;
          pc.set(slF.lay.shiftU * sc, HT + hU * 0.5, st.RP);
          const tg = 2 * Math.tan((st.fov * Math.PI) / 360);
          const d1 = Math.max(2.5, hU / (tg * (enc.h / st.H)), wU / (tg * (st.W / st.H) * (enc.w / st.W)));
          tmp.set(pc.x, pc.y + Math.sin(PITCH_ZOOM) * d1, pc.z + Math.cos(PITCH_ZOOM) * d1);
          camPos.lerp(tmp, z);
          camMira.lerp(pc, z);
          ox += (st.W / 2 - enc.cx - ox) * z;
          oy += (st.H / 2 - enc.cy - oy) * z;
        }
        cam.position.copy(camPos);
        cam.lookAt(camMira);
        cam.setViewOffset(st.W, st.H, ox, oy, st.W, st.H);
        cam.updateMatrixWorld();

        // la mesa gira con el ángulo (la pieza i está en (i - s)·α)
        if (mesa) mesa.rotation.y = -s * st.alfa;

        // ---------- piezas ----------
        const quieto = now - input.t > 2500;
        const tx = red ? 0 : quieto ? Math.sin(tiempo * 0.55) * 0.9 : input.x;
        const ty = red ? 0 : quieto ? Math.sin(tiempo * 0.33) * 0.25 : input.y;
        const kk = 1 - Math.pow(0.94, dt / 16.67);
        st.tiltX += (tx - st.tiltX) * kk;
        st.tiltY += (ty - st.tiltY) * kk;
        const pulso = 0.5 + 0.5 * Math.sin(tiempo * 2.42);
        let glowSl = null, glowC = 0;
        visibles.length = 0;
        for (let i = 0; i < slots.length; i++) {
          const sl = slots[i];
          if (i >= N) {
            sl.grupo.visible = false;
            continue;
          }
          const dF = distFrente(i, s, N);
          const ventana = enVentana(i, s, N);
          refrescar(sl, i, ventana, Math.abs(dF) < 1.5);
          if (!sl.modo) continue;
          const a = N > 1 ? envolver(dF * st.alfa) : 0;
          const c = (1 + Math.cos(a)) / 2;                 // 1 adelante, 0 al fondo
          const fe = suave(Math.max(0, 1 - Math.abs(a) / st.alfa)); // 1 la activa, 0 desde la de al lado
          const sc = 1 + st.boost * fe;
          const x = st.RP * Math.sin(a), zz = st.RP * Math.cos(a);
          sl.grupo.visible = true;
          sl.grupo.position.set(x, HT, zz);
          sl.pz.scale.setScalar(sc);
          // mira a la cámara, con una leve rotación hacia la tangente (máx. ~30°) para que se sienta el giro
          const giro = 0.52 * Math.sin(a);
          sl.pz.rotation.y = Math.atan2(camPos.x - x, camPos.z - zz) + giro;
          const vaiven = 0.35 + 0.65 * fe;
          sl.uni.tilt.value.set(st.tiltX * vaiven + giro * 1.6, st.tiltY * vaiven);
          const foto = sl.modo === "foto";
          // siluetas: oscuras y tenues. Con muchas piezas, las fotos del borde de la ventana ya se
          // parecen a una silueta, así el cambio de foto a silueta no se nota.
          const lejos = N > NVENT ? Math.min(1, Math.max(0, (Math.abs(dF) - (VENT - 1.5)) / 1.5)) : 0;
          const luzSil = 0.34 + 0.2 * c, alfaSil = 0.42 + 0.3 * c;
          const luzFoto = 0.5 + 0.5 * Math.pow(c, 1.3);
          sl.uni.luz.value = foto ? luzFoto + (luzSil - luzFoto) * lejos : luzSil;
          sl.uni.alfa.value = foto ? 1 + (alfaSil - 1) * lejos : alfaSil;
          sl.uni.rim.value = foto ? fe * (1 - z * 0.5) : 0;
          // la miniatura ya es borrosa de por sí: casi sin desenfoque extra (si no, queda un rectángulo)
          sl.uni.blur.value = cal.dof ? (foto ? Math.min(1.8, Math.max(0, (1 - c) * 2.4 - 0.12)) * (1 - z) : 0.35) : 0;
          // las de atrás se dibujan primero (transparentes, sin escribir profundidad)
          const orden = 10 + 2 * Math.round((zz + 20) * 8);
          sl.pieza.renderOrder = orden + 1;
          sl.halo.renderOrder = orden;
          const g = sl.glow ? pulso : 0;
          sl.uni.glow.value = sl.glow ? (0.35 + 0.45 * g) * (0.4 + 0.6 * c) : 0;
          sl.uniHalo.glow.value = sl.glow ? (0.55 + 0.4 * g) * (0.3 + 0.7 * c) : 0;
          if (sl.glow && c > glowC) {
            glowSl = sl;
            glowC = c;
          }
          visibles.push(sl);
        }
        let glowX = 0, glowY = 0;
        if (glowSl?.lay) {
          glowSl.grupo.localToWorld(punto.position.set(0, glowSl.lay.hU * 0.45, 0.8));
          punto.intensity = (1.2 + 1.6 * pulso) * glowC;
          [glowX, glowY] = detras(glowSl.grupo.position.x, HT + glowSl.lay.hU * 0.45, glowSl.grupo.position.z);
        } else punto.intensity = 0;
        uSet.uGlow.value.set(glowX, glowY, glowSl ? (0.75 + 0.25 * pulso) * Math.pow(glowC, 2) : 0, 0);

        // ---------- pared + piso: la pieza activa (k0) y la que llega, según el ángulo ----------
        // k0 = la pieza de la que se partió; d = cuánto se giró desde ahí (−1..1). Al cruzar una pieza
        // entera el esmalte ya cubre todo y k0 avanza sin que se note. En reposo, k0 = la de adelante.
        if (!moviendo) st.k0 = base;
        while (s - st.k0 >= 1) st.k0++;
        while (s - st.k0 <= -1) st.k0--;
        const d = s - st.k0, sg = d >= 0 ? 1 : -1, t = Math.abs(d);
        const iA = modN(st.k0, N), iB = modN(st.k0 + sg, N);
        ponerColores(coloresDe(piezas[iA]), coloresDe(piezas[iB]));
        uSet.uTime.value = tiempo;
        // el esmalte nace en la pared, detrás de la pieza que llega (y la sigue mientras gira)
        const aB = N > 1 ? sg * (1 - t) * st.alfa : 0;
        const slB = slots[iB];
        const hB = (slB?.lay?.hU || ALTO_REF) * escalaEn(aB);
        const [cxE, cyE] = detras(st.RP * Math.sin(aB), HT + hB * 0.5, st.RP * Math.cos(aB));
        let cubre = 0;
        for (const [qx, qy] of [[-st.vistaW / 2, 0], [st.vistaW / 2, 0], [-st.vistaW / 2, st.vistaH], [st.vistaW / 2, st.vistaH], [-st.vistaW / 2, -st.zMax * 0.45], [st.vistaW / 2, -st.zMax * 0.45]])
          cubre = Math.max(cubre, Math.hypot(qx - cxE, qy - cyE));
        cubre += 2.2;
        // radio lineal en t: el frente avanza 1:1 con el dedo (y al soltar sigue al mismo resorte que la mesa)
        uSet.uEsm.value.set(N > 1 ? t : 0, t <= 0 ? -20 : -1.2 + (cubre + 1.2) * t, cxE, cyE);

        // la palabra: la actual se desliza en el sentido del giro y se funde; la nueva entra del otro lado
        const L = Math.min(st.vistaW * 0.62, 14);
        const pal = [[iA, -sg * t * L, Math.max(0, 1 - t / 0.56), t * 2.2], [iB, sg * (1 - t) * L, Math.max(0, (t - 0.44) / 0.56), (1 - t) * 2.2]];
        for (let j = 0; j < 2; j++) {
          const [i, dx, op, bl] = pal[j];
          const tex = op > 0 ? palabraDe(i, true)?.tex : null;
          const R = tex ? rectPalabra(i) : null;
          uSet["uPal" + j].value = R ? tex : negro;
          if (R) uSet.uPalR.value[j].set(R.cx, R.cy, R.hw, R.hh);
          else uSet.uPalR.value[j].set(0, 0, 0, 0);
          uSet.uPalM.value[j].set(dx, R ? op : 0, cal.dof ? bl * (1 - z) : 0, 0);
        }
        colA.setRGB(...oklabARgb(coloresDe(piezas[iA]).mes), T.SRGBColorSpace);
        colB.setRGB(...oklabARgb(coloresDe(piezas[iB]).mes), T.SRGBColorSpace);
        hemi.groundColor.copy(colHemi.copy(colA).lerp(colB, Math.min(1, Math.max(0, (t - 0.25) * 2))));
        uHaz.uTime.value = tiempo;
        uPolvo.uTime.value = tiempo;
        uPolvo.uInt.value = 0.32 * (cal.polvo > 0 ? 1 : 0);

        // sombras: solo cuando algo cambió (la mesa gira → las piezas se mueven)
        if (st.sombraSucia || moviendo || zoomando || st.fundido > 0) {
          renderer.shadowMap.needsUpdate = true;
          st.sombraSucia = false;
        }
        renderer.render(scene, cam);
        if (st.fundido > 0) st.fundido--;
        if (st.medirPend && !rec.moviendo) {
          st.medirPend = false;
          medir();
        }

        // rectángulo de la pieza activa (para tocarla y para que vuele al carrito) y aviso de "lista"
        if (!moviendo && !zoomando && slF?.foto) {
          const clave = [base, st.W, st.H, z.toFixed(2), slF.lay.wU].join("|");
          if (clave !== st.rectClave) {
            st.rectClave = clave;
            const b = caja(slF);
            const parent = canvas.closest(".tienda, .adm-escena") || canvas.parentElement;
            parent?.style.setProperty("--pz-l", b[0].toFixed(1) + "px");
            parent?.style.setProperty("--pz-t", b[1].toFixed(1) + "px");
            parent?.style.setProperty("--pz-w", (b[2] - b[0]).toFixed(1) + "px");
            parent?.style.setProperty("--pz-h", (b[3] - b[1]).toFixed(1) + "px");
          }
        }
        if (!st.avisado && slF?.foto && (palabras.get(iF)?.tex || !piezas[iF]?.palabra)) {
          st.avisado = true;
          pr.current.onListo?.();
        }
      };

      // caja en pantalla (px CSS) de una pieza: [izq, arriba, der, abajo]
      const caja = (sl) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [u, v] of [[-0.5, 0], [0.5, 0], [-0.5, 1], [0.5, 1]]) {
          sl.pieza.localToWorld(tmp.set(u, v, 0)).project(cam);
          const px = ((tmp.x + 1) / 2) * st.W, py = ((1 - tmp.y) / 2) * st.H;
          x0 = Math.min(x0, px);
          x1 = Math.max(x1, px);
          y0 = Math.min(y0, py);
          y1 = Math.max(y1, py);
        }
        return [x0, y0, x1, y1];
      };

      // Tocar: ¿qué pieza hay en ese punto? (la de más adelante gana). La tienda la trae al frente.
      rec.tocar = (clientX, clientY) => {
        if (!st.W) return -1;
        const r = canvas.getBoundingClientRect();
        const x = clientX - r.left, y = clientY - r.top;
        const orden = [...visibles].sort((a, b) => b.pieza.renderOrder - a.pieza.renderOrder);
        for (const sl of orden) {
          if (!sl.grupo.visible) continue;
          const [x0, y0, x1, y1] = caja(sl);
          const mx = (x1 - x0) * 0.12; // las fotos tienen aire alrededor: se toca un poco adentro
          if (x >= x0 + mx && x <= x1 - mx && y >= y0 + (y1 - y0) * 0.08 && y <= y1) return sl.i;
        }
        return -1;
      };

      // ---------- Eventos ----------
      const offRec = rec.escuchar((tipo) => {
        if (tipo === "indice" && (pr.current.reducido || mqReducido.matches)) {
          // sin giro: corte directo con un fundido corto
          canvas.style.transition = "none";
          canvas.style.opacity = "0.35";
          requestAnimationFrame(() => {
            canvas.style.transition = "opacity 180ms ease-out";
            canvas.style.opacity = "1";
          });
          st.fundido = 2;
        }
        pedirCuadro();
      });
      const visibilidad = () => {
        st.oculto = document.hidden;
        if (!st.oculto) {
          st.last = 0;
          pedirCuadro();
        }
      };
      const perdido = (ev) => {
        ev.preventDefault();
        pr.current.onFalla?.();
      };
      document.addEventListener("visibilitychange", visibilidad);
      canvas.addEventListener("webglcontextlost", perdido);

      motor.current = {
        pausar(v) {
          st.pausado = v;
          if (!v) st.last = 0;
          pedirCuadro();
        },
        enfocar(v) {
          if (st.zoomObj === (v ? 1 : 0)) return;
          st.zoomObj = v ? 1 : 0;
          st.zoom0 = st.zoom;
          st.zoomT = performance.now();
          st.rectClave = "";
          pedirCuadro();
        },
        actualizar() {
          for (const sl of slots) sl.clave = "";
          rectPal.clear();
          medir();
        },
      };

      escuchar();
      medir();
      const ro = new ResizeObserver(medir);
      ro.observe(canvas);
      pedirCuadro();
      cargarFuente().then(() => {
        if (!vivo) return;
        fuenteOk = true;
        medir();
      });

      cleanup = () => {
        cancelAnimationFrame(st.raf);
        ro.disconnect();
        offRec();
        if (rec.tocar) delete rec.tocar;
        document.removeEventListener("visibilitychange", visibilidad);
        canvas.removeEventListener("webglcontextlost", perdido);
        for (const e of fotos.values()) liberarFoto(e);
        fotos.clear();
        for (const e of minis.values()) e?.tex?.dispose();
        minis.clear();
        for (const e of palabras.values()) e.tex?.dispose();
        palabras.clear();
        mesa?.userData.dispose();
        renderer.dispose();
        renderer.forceContextLoss?.();
      };
    })();
    return () => {
      vivo = false;
      cleanup();
      motor.current = null;
    };
  }, []);

  useEffect(() => { motor.current?.pausar(!!props.pausado); }, [props.pausado]);
  useEffect(() => { motor.current?.enfocar(!!props.enfoque); }, [props.enfoque]);
  useEffect(() => { motor.current?.actualizar(); }, [props.piezas, props.mesa, props.vista?.w, props.vista?.h]);

  return (
    <div className="escena3d" aria-hidden>
      <canvas ref={ref} />
    </div>
  );
}
