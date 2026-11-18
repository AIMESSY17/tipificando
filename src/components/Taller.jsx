"use client";
import { useEffect, useRef } from "react";
import { medidas, anchoPed } from "@/lib/medir";
import { input, escuchar } from "@/lib/inclinacion";
import { prepararFoto } from "@/lib/profundidad";
import { Recorrido, modN } from "@/lib/recorrido";
import { cargarFuente, pintarPalabra, medirPalabra, tamPalabra } from "@/lib/palabra";
import { vivoLab, hexAOklab, mezclaOklch, oklabARgb } from "@/lib/color";

// =====================================================================
//  EL TALLER: un set de fotos 3D continuo por el que se mueve la CÁMARA.
//
//  Cada pieza tiene su "estación" a lo largo de un pasillo apenas curvo (arco cóncavo):
//  su pedestal, su tramo de pared con sus colores y su palabra pintada. Cambiar de pieza ES
//  mover la cámara (travelling lateral con un leve giro); nada se anima "después".
//
//  Un solo WebGL dibuja todo:
//  - PARED y MESA: un shader cada una (color de la estación, degradé de luz, palabra pintada,
//    esmalte líquido entre estaciones mezclado en OKLab, luz de ventana y sombra de planta
//    proyectadas en la dirección del sol, sombras reales de pedestal y pieza, grano y viñeta).
//  - Estaciones (pool de 5, se reciclan): pedestal 3D (travertino o torno), pieza 2.5D
//    (parallax por profundidad + brillo de esmalte, mira siempre a la cámara), haces de luz y polvo.
//  - Profundidad de campo barata: las vecinas se ven con mipmaps más bajos (sin postproceso).
//  - Calidad adaptativa (alto / medio / bajo) según el tiempo de cuadro.
//
//  `recorrido` (lib/recorrido.js) es la posición de la cámara: el bucle llama a paso() y dibuja
//  con ese mismo valor, así cámara, esmalte, palabra y textos salen del mismo cuadro.
// =====================================================================

const ALTO = 1.1;        // altura del pedestal
const PARED = 3;         // la pared está 3 unidades detrás de cada pedestal
const DIST = 21;         // distancia de la cámara al pedestal
const CAM_Y = 4.6, MIRA_Y = 1.8, FOV = 32;
const DELTA = 0.085;     // giro entre estaciones (rad): el leve giro del travelling (~5°)
const ZOOM_MS = 450;     // push-in al tocar la pieza (ease-out)
const MX = 0.16, MY = 0.14; // margen del halo alrededor de la pieza
const NSLOT = 5;         // estaciones armadas a la vez (±2)
const SOL = [-7, 9, 7];  // posición del sol respecto del pedestal (local)
const DL = (() => { const n = Math.hypot(...SOL); return SOL.map((v) => -v / n); })(); // dirección de la luz
const VY0 = -7, VY1 = 10; // alto que cubre la textura de ventana + planta (en la pared)

// Calidad adaptativa. Si el gesto no llega a 60 fps se baja de a un escalón, y el orden es a
// propósito: primero se apagan los efectos (polvo, rayos, desenfoque), después se achica la sombra
// y recién al final la resolución. La respuesta al dedo no se toca nunca.
const NIVELES = {
  alto: { pr: 2, prT: 2, sombra: 2048, haces: 1, polvo: 110, dof: 1, max: 3 },
  medio: { pr: 2, prT: 2, sombra: 1024, haces: 0.6, polvo: 40, dof: 1, max: 3 },
  liviano: { pr: 2, prT: 2, sombra: 1024, haces: 0, polvo: 0, dof: 0, max: 2 },
  bajo: { pr: 1.5, prT: 1.5, sombra: 512, haces: 0, polvo: 0, dof: 0, max: 2 },
  minimo: { pr: 1, prT: 1.2, sombra: 512, haces: 0, polvo: 0, dof: 0, max: 2 },
};
const ORDEN = ["minimo", "bajo", "liviano", "medio", "alto"];

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
    for (let i = 0; i < 26; i++) {
      x.strokeStyle = `rgba(${120 + r() * 40},${70 + r() * 25},${45 + r() * 20},${0.25 + r() * 0.4})`;
      x.lineWidth = 3 + r() * 22;
      const rad = c * (0.25 + r() * 0.72), a0 = r() * Math.PI * 2;
      x.beginPath();
      x.arc(c, c, rad, a0, a0 + 0.4 + r() * 2.2);
      x.stroke();
    }
    x.fillStyle = "#6f7378";
    x.beginPath();
    x.arc(c, c, 14, 0, Math.PI * 2);
    x.fill();
  });
}

// Recursos de cada tipo de pedestal: se arman una vez y los comparten todas las estaciones
function recursosPedestal(T, tipo) {
  if (tipo === "torno") {
    const pan = new T.LatheGeometry(
      [[0, 0.02], [1.2, 0.02], [1.27, 0.07], [1.29, 0.42], [1.24, 0.44], [1.19, 0.16], [0.3, 0.14], [0, 0.14]].map(([a, b]) => new T.Vector2(a, b)),
      96
    );
    const plastico = new T.MeshStandardMaterial({ color: "#57514c", roughness: 0.5, metalness: 0.05 });
    const col = new T.CylinderGeometry(0.2, 0.24, ALTO - 0.12, 32);
    col.translate(0, (ALTO - 0.12) / 2, 0);
    const cab = new T.CylinderGeometry(1, 0.97, 0.12, 96);
    cab.translate(0, ALTO - 0.06, 0);
    const metalLado = new T.MeshStandardMaterial({ color: "#9ea5ab", metalness: 0.85, roughness: 0.3 });
    const metalTapa = new T.MeshStandardMaterial({ map: texTorno(T), metalness: 0.7, roughness: 0.38 });
    return { partes: [[pan, plastico], [col, plastico], [cab, [metalLado, metalTapa, metalLado]]], velocidad: 0.9, radioMax: 1.29 };
  }
  const pts = [[0, 0], [0.985, 0], [1, 0.015], [1, ALTO - 0.05], [0.99, ALTO - 0.012], [0.955, ALTO], [0, ALTO]].map(([a, b]) => new T.Vector2(a, b));
  const tex = texTravertino(T);
  tex.wrapS = T.RepeatWrapping;
  const mat = new T.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.35, roughness: 0.78, metalness: 0 });
  return { partes: [[new T.LatheGeometry(pts, 128), mat]], velocidad: 0.12, radioMax: 1 };
}

// Luz de ventana (canal rojo) + sombra de la planta (canal verde), en el espacio de la pared de
// UNA estación (se repite en cada una). Dibujado en chico y agrandado: el suavizado hace de desenfoque.
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
// caja de la ventana y de la planta, en fracciones de la estación (u: 0..1 a lo ancho, v: VY0..VY1)
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
  t.wrapS = T.RepeatWrapping;
  // sin mipmaps: es suave de por sí y así no aparece una costura donde se repite
  t.generateMipmaps = false;
  t.minFilter = T.LinearFilter;
  return t;
}

// Grano del revoque / la mesa (mismo grano que antes: 50% oscuro, 50% claro, alfa 0–15)
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

// Pared (cilindro visto desde adentro) y mesa (disco) comparten este shader; MESA cambia lo propio.
const FS_SET = /* glsl */ `
#include <common>
#include <bsdfs>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
${GLSL_COLOR}
varying vec3 vW;
uniform float uS, uDelta, uRW, uSw, uPR, uHor, uTime, uSombra;
uniform vec2 uRes, uVista;
uniform vec3 uParA, uParB, uParAL, uParBL;   // pared: sRGB y OKLab de la estación actual (A) y la siguiente (B)
uniform vec3 uLuzA, uLuzB, uLuzAL, uLuzBL;   // color de la luz de ventana del degradé
uniform vec3 uSomA, uSomB, uSomAL, uSomBL;   // color de la sombra del degradé
uniform vec3 uTonA, uTonB, uTonAL, uTonBL;   // color de la palabra (tono sobre tono)
uniform vec3 uMesA, uMesB, uMesAL, uMesBL;   // mesa
uniform vec4 uEsm;      // x: progreso t, y: radio del frente, z: altura del centro de la pieza B, w: estación B
uniform float uK0;      // estación del primer lugar de palabra
uniform sampler2D uPal0, uPal1, uPal2, uPal3;
uniform vec4 uPalR[4];  // centro x (en la pared, desde la estación), centro y, medio ancho, medio alto
uniform vec4 uPalX[4];  // x: desenfoque (bias), y: brillo cálido (pino), z: altura del centro de la pieza
uniform sampler2D uCookie, uGrano;
uniform vec3 uDL;       // dirección de la luz (local de la estación)

// gradientes calculados fuera de los if (las derivadas no valen dentro de ramas divergentes)
float letra(int j, vec2 p){
  int jc = clamp(j, 0, 3);
  vec4 R = uPalR[jc];
  vec2 uv = (p - R.xy) / (2.0 * max(R.zw, vec2(1e-4))) + 0.5;
  float sc = exp2(uPalX[jc].x);
  vec2 gx = dFdx(uv) * sc, gy = dFdy(uv) * sc;
  if (j != jc || R.z <= 0.0 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  if (jc == 0) return textureGrad(uPal0, uv, gx, gy).r;
  if (jc == 1) return textureGrad(uPal1, uv, gx, gy).r;
  if (jc == 2) return textureGrad(uPal2, uv, gx, gy).r;
  return textureGrad(uPal3, uv, gx, gy).r;
}

// Frente del esmalte en el plano desplegado (q.x: distancia a la estación B, q.y: altura).
// Gravedad: hacia arriba sube más lento, hacia abajo cae más rápido. El borde ondula en grande
// (forma de mancha, no de círculo) y se mueve apenas con el tiempo.
float frente(vec2 q){
  float dy = q.y - uEsm.z;
  float d = length(vec2(q.x, dy * (dy > 0.0 ? 1.15 : 0.82)));
  float ond = vnoise(q * 0.17 + vec2(uTime * 0.012, 0.0)) * 0.65 + vnoise(q * 0.43 + 7.3) * 0.35;
  return d + (ond - 0.5) * 1.1 - uEsm.y;
}
float smin(float a, float b, float k){
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

void main(){
  vec3 P = vW;
  float r = length(P.xz);
  float phi = atan(P.x, -P.z);
  float dphi = phi - uS * uDelta;
  dphi = atan(sin(dphi), cos(dphi));
  float sigma = uS + dphi / uDelta;            // posición a lo largo del pasillo, en estaciones
#ifdef MESA
  float Y = 0.0, Z = max(uRW - r, 0.0);
#else
  float Y = P.y, Z = 0.0;
#endif
  vec2 fc = vec2(gl_FragCoord.x, uRes.y * uPR - gl_FragCoord.y) / uPR; // px CSS, y hacia abajo

  // ---------- esmalte líquido: nace en la pieza de la estación B y avanza con el gesto ----------
  // El frente (ver frente()) crece con un radio que sale directo de s: 1:1 con el dedo, sin
  // animación propia, y al soltar sigue al mismo resorte que la cámara.
  // Chorreadas: en columnas angostas y espaciadas, el mismo frente corrido hacia abajo un largo
  // distinto en cada una → lenguas verticales con la punta redondeada, unidas al borde con una
  // curva suave (smin). Sin ruido fino: todo sale de ruido de baja frecuencia.
  float X = (sigma - uEsm.w) * uSw;
  float e = 10.0, m = 0.0, borde = 0.0;
  if (uEsm.x > 0.0){                           // en reposo no hay esmalte: no se calcula el ruido
    vec2 q = vec2(X, Y - Z * 0.45);            // pared + mesa "desplegadas" en un plano
    float eM = frente(q);
    // una columna cada 2.4 unidades; cada una (al azar) tiene o no chorreada, con su ancho y su largo
    float id = floor(X / 2.4 + 0.5);
    float h1 = hash(vec2(id, 3.7)), h2 = hash(vec2(id, 8.1)), h3 = hash(vec2(id, 1.9));
    float rr = 0.14 + 0.16 * h2;                               // medio ancho de la lengua
    float lado = abs(X - (id + (h3 - 0.5) * 0.5) * 2.4) - rr;  // distancia al costado de la lengua
    float largo = step(0.4, h1) * (0.7 + 2.3 * h2) * smoothstep(0.0, 0.4, uEsm.x);
    float abajo = frente(q + vec2(0.0, largo));                // el frente corrido hacia abajo
    // intersección redondeada (radio = medio ancho): la punta queda semicircular
    vec2 w2 = vec2(abajo, lado) + rr;
    float eD = length(max(w2, 0.0)) + min(max(w2.x, w2.y), 0.0) - rr;
    e = smin(eM, eD, 0.35);
    borde = exp(-e * e / 0.02);
  }
  float aa = fwidth(e) * 1.5 + 0.012;
  m = 1.0 - smoothstep(-aa, aa, e);

#ifdef MESA
  vec3 col = mezcla(uMesA, uMesB, uMesAL, uMesBL, m);
  // mesa-luz: degradé vertical desde el horizonte
  float f = clamp((fc.y - uHor) / max(1.0, uRes.y - uHor), 0.0, 1.0);
  vec3 cl; float al;
  if (f < 0.12){ cl = vec3(f / 0.12); al = 0.10; }
  else if (f < 0.40){ cl = vec3(1.0); al = 0.10 * (1.0 - (f - 0.12) / 0.28); }
  else { cl = vec3(0.0); al = 0.10 * (f - 0.40) / 0.60; }
  col = mix(col, cl, al);
  // canto de la mesa contra la pared
  float canto = 1.0 - smoothstep(1.5, 2.5, Z / max(fwidth(Z), 1e-5));
  col = mix(col, vec3(1.0), 0.45 * canto);
  vec4 gr = texture2D(uGrano, vec2(sigma * uSw, Z) * 0.42);
  col = mix(col, gr.rgb, gr.a);
#else
  vec3 col = mezcla(uParA, uParB, uParAL, uParBL, m);
  // degradé de la luz de ventana (115°, igual que antes): luz a la izquierda, sombra a la derecha
  vec2 dir = vec2(0.9063, 0.4226);
  float Lg = uRes.x * dir.x + uHor * dir.y;
  float tg = 0.5 + dot(fc - vec2(uRes.x, uHor) * 0.5, dir) / Lg;
  col = mix(col, mezcla(uLuzA, uLuzB, uLuzAL, uLuzBL, m), 0.55 * clamp(1.0 - tg / 0.42, 0.0, 1.0));
  col = mix(col, mezcla(uSomA, uSomB, uSomAL, uSomBL, m), 0.55 * clamp((tg - 0.6) / 0.4, 0.0, 1.0));
  // grano del revoque (debajo de la palabra: las letras quedan lisas, como antes)
  vec4 gr = texture2D(uGrano, vec2(sigma * uSw, Y) * 0.42);
  col = mix(col, gr.rgb, gr.a);
  // la palabra de la estación más cercana, pintada sobre el revoque
  float kf = floor(sigma + 0.5);
  int j = int(floor(kf - uK0 + 0.5));
  vec2 pw = vec2((sigma - kf) * uSw, Y);
  float a = letra(j, pw);
  col = mix(col, mezcla(uTonA, uTonB, uTonAL, uTonBL, m), a);
  // filo oscuro de 1 px sobre el canto de la mesa
  col *= 1.0 - 0.08 * (1.0 - smoothstep(0.5, 1.5, Y / max(fwidth(Y), 1e-5)));
#endif

  // borde mojado del esmalte: un brillo fino del lado de adentro y un espesor apenas más oscuro
  // (sin anillos ni bandas: una sola caída suave hacia afuera)
  if (uEsm.x > 0.0){
    col = mix(col, vec3(1.0), 0.12 * borde * smoothstep(0.12, 0.0, -e) * step(e, 0.0));
    col *= 1.0 - 0.05 * smoothstep(0.35, 0.0, abs(e + 0.08)) * m;
  }

  // brillo cálido del pino en su estación
  {
    float kg = floor(sigma + 0.5);
    int jg = int(floor(kg - uK0 + 0.5));
    if (jg >= 0 && jg < 4){
      vec4 xg = uPalX[jg];
      if (xg.y > 0.0){
        vec2 g = vec2((sigma - kg) * uSw / (0.4 * uVista.x), (Y - Z * 0.8 - xg.z) / (0.32 * uVista.y));
        col = mix(col, vec3(1.0, 0.667, 0.275), 0.32 * xg.y * clamp(1.0 - length(g) / 0.7, 0.0, 1.0));
      }
    }
  }

  // sombras reales de pedestal y pieza
  col *= 1.0 - uSombra * (1.0 - getShadowMask());

  // luz de ventana + sombra de la planta, proyectadas en la dirección del sol (pasan por encima de la palabra)
  float zp = Z / -uDL.z;
  float su = sigma + (uDL.x * zp) / uSw;
  float sy = Y + uDL.y * zp;
  vec2 cuv = vec2(fract(su + 0.5), (sy - ${VY0.toFixed(1)}) / ${(VY1 - VY0).toFixed(1)});
  vec2 hoja = vec2(sin(uTime * 0.7 + sy) * 0.004, 0.0);
  vec2 ck = vec2(texture2D(uCookie, cuv).r, texture2D(uCookie, cuv + hoja).g) * step(0.0, cuv.y) * step(cuv.y, 1.0);
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

// La pieza: parallax por profundidad + brillo de esmalte + sombreado (igual que antes).
// `tilt` mezcla el vaivén en reposo / mouse / giroscopio con el ángulo real de la cámara.
// `blur` = profundidad de campo barata (mipmaps más bajos en las estaciones vecinas).
const FS_PIEZA = /* glsl */ `varying vec2 vUv;
uniform sampler2D img; uniform sampler2D dep;
uniform vec2 tilt; uniform float px; uniform float fuerza; uniform float glow; uniform float blur;
void main(){
  float d = texture2D(dep, vUv, blur).r;
  vec2 off = tilt * (d - 0.3) * vec2(0.032, -0.014) * fuerza;
  vec2 u = clamp(vUv - off, 0.0, 1.0);
  vec4 c = texture2D(img, u, blur * 1.3);
  if (c.a < 0.004) discard;
  float dl = texture2D(dep, u - vec2(px, 0.0)).r;
  float dr = texture2D(dep, u + vec2(px, 0.0)).r;
  vec3 n = normalize(vec3((dl - dr) * 7.0, 0.0, 0.55));
  vec3 L = normalize(vec3(-0.35 + tilt.x * 0.9, 0.2, 0.9));
  float spec = pow(max(dot(n, L), 0.0), 30.0) * 0.30;
  float shade = mix(0.86, 1.04, max(dot(n, normalize(vec3(-0.4 + tilt.x * 0.5, 0.0, 1.0))), 0.0));
  vec3 col = c.rgb * shade + spec;
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  col += vec3(1.0, 0.62, 0.26) * smoothstep(0.6, 0.95, lum) * glow * 0.6;
  gl_FragColor = vec4(col, c.a);
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

// Colores de una estación (OKLab), iguales a los del CSS de antes
const LAB_LUZ = hexAOklab("#fff6e6"), LAB_SOM = hexAOklab("#1a0c08"), LAB_OSC = hexAOklab("#1b0d08"), LAB_CLA = hexAOklab("#fbeee0");
function coloresDe(pz) {
  const par = vivoLab(pz?.pared || "#c46a4c", 1.14);
  const ton = pz?.clara ? mezclaOklch(par, LAB_OSC, 0.72) : mezclaOklch(par, LAB_CLA, 0.55);
  return {
    par, luz: mezclaOklch(par, LAB_LUZ, 0.72), som: mezclaOklch(par, LAB_SOM, 0.7), ton,
    mes: vivoLab(pz?.mesa || "#e6ded2", 1.06),
  };
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
      const cam = new T.PerspectiveCamera(FOV, 1, 0.1, 400);
      const ref0 = new T.PerspectiveCamera(FOV, 1, 0.1, 400); // cámara de referencia (estación en reposo, local)
      ref0.position.set(0, CAM_Y, DIST);
      ref0.lookAt(0, MIRA_Y, 0);

      const hemi = new T.HemisphereLight("#fff6ea", "#e6ded2", 1.25);
      scene.add(hemi);
      const sol = new T.DirectionalLight("#fff1dc", 2.6);
      sol.castShadow = true;
      sol.shadow.mapSize.set(cal.sombra, cal.sombra);
      sol.shadow.bias = -0.0004;
      sol.shadow.normalBias = 0.02;
      sol.shadow.radius = 5;
      scene.add(sol, sol.target);
      const punto = new T.PointLight("#ffae55", 0, 7, 2);
      scene.add(punto);

      // ---------- Pared + mesa ----------
      const texCk = texCookie(T), texGr = texGrano(T);
      const negro = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
      negro.needsUpdate = true;
      const v3 = () => new T.Vector3();
      const uSet = {
        uS: { value: 0 }, uDelta: { value: DELTA }, uRW: { value: 100 }, uSw: { value: 10 }, uPR: { value: 1 }, uHor: { value: 400 },
        uTime: { value: 0 }, uSombra: { value: 0.16 }, uRes: { value: new T.Vector2(1, 1) }, uVista: { value: new T.Vector2(6, 12) },
        uEsm: { value: new T.Vector4(0, -9, 1.6, 1) }, uK0: { value: -1 }, uDL: { value: new T.Vector3(...DL) },
        uPal0: { value: negro }, uPal1: { value: negro }, uPal2: { value: negro }, uPal3: { value: negro },
        uPalR: { value: [0, 1, 2, 3].map(() => new T.Vector4()) }, uPalX: { value: [0, 1, 2, 3].map(() => new T.Vector4()) },
        uCookie: { value: texCk }, uGrano: { value: texGr },
      };
      for (const n of ["Par", "Luz", "Som", "Ton", "Mes"]) for (const s of ["A", "B", "AL", "BL"]) uSet["u" + n + s] = { value: v3() };
      const vsSet = T.ShaderLib.shadow.vertexShader
        .replace("void main() {", "varying vec3 vW;\nvoid main() {")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n\tvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      const matSet = (mesa) => {
        const u = T.UniformsUtils.merge([T.UniformsLib.lights]);
        Object.assign(u, uSet);
        if (mesa) u.uSombra = { value: 0.26 };
        return new T.ShaderMaterial({ uniforms: u, vertexShader: vsSet, fragmentShader: FS_SET, lights: true, defines: mesa ? { MESA: 1 } : {}, side: mesa ? T.FrontSide : T.BackSide });
      };
      const matPared = matSet(false), matMesa = matSet(true);
      const pared = new T.Mesh(new T.BufferGeometry(), matPared);
      pared.receiveShadow = true;
      pared.frustumCulled = false;
      const mesa = new T.Mesh(new T.BufferGeometry(), matMesa);
      mesa.receiveShadow = true;
      mesa.frustumCulled = false;
      scene.add(pared, mesa);

      // ---------- Haces y polvo (compartidos por todas las estaciones) ----------
      const uHaz = { uTime: { value: 0 }, uInt: { value: 0.06 } };
      const matHaz = new T.ShaderMaterial({ uniforms: uHaz, vertexShader: VS, fragmentShader: FS_HAZ, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false });
      const uPolvo = { uTime: { value: 0 }, uTam: { value: 2 }, uInt: { value: 0.55 } };
      const matPolvo = new T.ShaderMaterial({ uniforms: uPolvo, vertexShader: VS_POLVO, fragmentShader: FS_POLVO, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
      let geoHaz = new T.BufferGeometry(), geoPolvo = new T.BufferGeometry();

      // ---------- Estado ----------
      const peds = {};
      const recPed = (t) => peds[t] || (peds[t] = recursosPedestal(T, t));
      const vacio = new T.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
      vacio.needsUpdate = true;
      const vacioDep = new T.DataTexture(new Uint8Array([0]), 1, 1, T.RedFormat, T.UnsignedByteType);
      vacioDep.unpackAlignment = 1;
      vacioDep.needsUpdate = true;
      const st = {
        W: 0, H: 0, ppuX: 1, ppuY: 1, apoyo: 0, hor: 0, S: 8, Rs: 60, RW: 63, Sw: 8, vistaW: 6, vistaH: 12, vistaEst: 5,
        last: 0, ema: 16.7, muestras: 0, bien: 0, modo: 0, sombraSucia: true, pausado: !!pr.current.pausado, oculto: document.hidden,
        raf: 0, tiltX: 0, tiltY: 0, spin: 0, version: 1, zoom: pr.current.enfoque ? 1 : 0, zoomObj: pr.current.enfoque ? 1 : 0, zoom0: 0, zoomT: 0, medirPend: false,
        listo: false, avisado: false, rectClave: "", fundido: 0, techo: 0,
      };

      // ---------- Fotos en memoria (por URL): ±2 estaciones alrededor de la cámara ----------
      const fotos = new Map();
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
        if (e) return e;
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
          if (urgente) subir(e);
          else idle(() => vivo && fotos.get(pz.src) === e && subir(e), { timeout: 600 });
        })().catch((err) => {
          console.warn("Taller:", err);
          e.error = true;
          st.version++;
        });
        return e;
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
        // mientras se rehace (otro tamaño), queda la anterior si es la misma palabra
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

      const precargar = () => {
        const piezas = pr.current.piezas || [];
        const N = piezas.length;
        if (!N) return;
        const base = Math.round(rec.s);
        const cerca = new Set();
        for (let d = 0; d <= 2; d++) for (const sg of d ? [1, -1] : [1]) cerca.add(modN(base + d * sg, N));
        for (const i of cerca) {
          cargarFoto(piezas[i], i === modN(base, N));
          palabraDe(i, false);
        }
        const srcs = new Set([...cerca].map((i) => piezas[i]?.src));
        for (const sl of slots) if (sl.foto && sl.grupo.visible) srcs.add(sl.src);
        for (const [src, e] of fotos) {
          if (srcs.has(src) || !e.listo) continue;
          liberarFoto(e);
          fotos.delete(src);
        }
        for (const [i, e] of palabras) {
          if (cerca.has(i)) continue;
          if (e.tex) e.tex.dispose();
          palabras.delete(i);
        }
      };

      // ---------- Estaciones (pool) ----------
      const geoPieza = new T.PlaneGeometry(1, 1);
      geoPieza.translate(0, 0.5, 0);
      const geoHalo = new T.PlaneGeometry(1 / (1 - 2 * MX), 1 / (1 - MY));
      geoHalo.translate(0, 0.5 / (1 - MY), 0);
      const slots = [];
      for (let n = 0; n < NSLOT; n++) {
        const grupo = new T.Group();
        const uni = {
          img: { value: vacio }, dep: { value: vacioDep }, tilt: { value: new T.Vector2() },
          px: { value: 0.005 }, fuerza: { value: 1 }, glow: { value: 0 }, blur: { value: 0 },
        };
        const pieza = new T.Mesh(geoPieza, new T.ShaderMaterial({ uniforms: uni, vertexShader: VS, fragmentShader: FS_PIEZA, transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
        pieza.renderOrder = 10;
        pieza.castShadow = true;
        const matSombra = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, alphaTest: 0.5, map: vacio, side: T.DoubleSide });
        pieza.customDepthMaterial = matSombra;
        const uniHalo = { dep: uni.dep, glow: { value: 0 } };
        const halo = new T.Mesh(geoHalo, new T.ShaderMaterial({ uniforms: uniHalo, vertexShader: VS, fragmentShader: FS_HALO, transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
        halo.renderOrder = 9;
        halo.visible = false;
        const pz = new T.Group(); // la pieza + su halo, gira para mirar a la cámara
        pz.add(halo, pieza);
        pz.visible = false;
        const giro = new T.Group(); // el pedestal (gira despacio)
        const haces = new T.Mesh(geoHaz, matHaz);
        haces.renderOrder = 20;
        haces.frustumCulled = false;
        const polvo = new T.Points(geoPolvo, matPolvo);
        polvo.renderOrder = 21;
        polvo.frustumCulled = false;
        grupo.add(giro, pz, haces, polvo);
        grupo.visible = false;
        scene.add(grupo);
        slots.push({ n, k: null, i: -1, grupo, giro, pz, pieza, halo, uni, uniHalo, matSombra, haces, polvo, tipo: null, clave: "", lay: null, foto: null, src: null, glow: false, pal: null });
      }
      const slotDe = (k) => slots[modN(k, NSLOT)];

      // posición de la estación k en el arco
      const marco = (k, out) => {
        const a = k * DELTA;
        out.pos.set(Math.sin(a) * st.Rs, 0, -Math.cos(a) * st.Rs);
        out.ang = a;
        return out;
      };
      const tmpM = { pos: new T.Vector3(), ang: 0 };

      // ---------- Medidas ----------
      const vtmp = new T.Vector3();
      const proyRef = (x, y, z) => {
        vtmp.set(x, y, z).project(ref0);
        return [((vtmp.x + 1) / 2) * st.W, ((1 - vtmp.y) / 2) * st.H];
      };
      // punto de la pared (z = -PARED en la estación) que cae en el píxel (px, py) con la cámara de referencia
      const enPared = (px, py) => {
        vtmp.set((px / st.W) * 2 - 1, -(py / st.H) * 2 + 1, 0.5).unproject(ref0);
        const o = ref0.position, d = vtmp.sub(o).normalize();
        const t = (-PARED - o.z) / d.z;
        return [o.x + d.x * t, o.y + d.y * t];
      };

      // Diseño de una estación: tamaño de la pieza, pedestal y palabra (en unidades 3D)
      const disenar = (pz, foto) => {
        const { vista, pedMin = 120 } = pr.current;
        const ok = foto?.listo;
        const ratio = ok ? foto.ratio : 1, cx = ok ? foto.cx ?? 0.5 : 0.5;
        const VW = vista?.w || st.W, VH = vista?.h || st.H;
        const d = medidas(ratio, cx, VW, VH);
        const r = recPed(pz?.tipo || "travertino");
        const tope = (st.W * 0.42) / (r.radioMax * st.ppuX);
        const escala = Math.max(0.3, Math.min(anchoPed(d.width, cx, pedMin) / 2 / st.ppuX, tope));
        const wU = d.width / st.ppuX, hU = d.height / st.ppuY, shiftU = d.shift / st.ppuX;
        const lay = { d, escala, wU, hU, shiftU, pal: null };
        // palabra: misma posición que antes (centro al 29% del alto), pero si la pieza la tapa
        // demasiado sube (y si no entra, se achica): la pieza tapa como mucho la parte de abajo.
        const pal = pz?.palabra;
        if (pal && fuenteOk) {
          const m = medirPalabra(pal);
          let F = tamPalabra(pal, st.W, st.H);
          const centro = 0.29 * st.H;
          let base = centro + m.cy * F - (m.h * F) / 2 + m.base * F;
          const topePieza = st.apoyo - d.height;
          const margen = 0.12;
          if (base > topePieza + margen * F) {
            base = topePieza + margen * F;
            if (base - m.base * F < st.techo) {
              F = Math.max(24, Math.min(F, (topePieza - st.techo) / (m.base - margen)));
              base = topePieza + margen * F;
            }
          }
          const top = base - m.base * F, bot = top + m.h * F;
          const [, yTop] = enPared(st.W / 2, top);
          const [, yBot] = enPared(st.W / 2, bot);
          const [x0] = enPared(st.W / 2 + m.cx * F - (m.w * F) / 2, (top + bot) / 2);
          const [x1] = enPared(st.W / 2 + m.cx * F + (m.w * F) / 2, (top + bot) / 2);
          lay.pal = { cx: (x0 + x1) / 2, cy: (yTop + yBot) / 2, hw: (x1 - x0) / 2, hh: (yTop - yBot) / 2 };
        }
        return lay;
      };

      const geomPared = () => {
        const media = Math.min(Math.PI * 0.9, (st.vistaW * 0.75 + 8) / st.RW);
        pared.geometry.dispose();
        pared.geometry = new T.CylinderGeometry(st.RW, st.RW, 18, 96, 1, true, Math.PI - media, media * 2);
        pared.geometry.translate(0, 9, 0);
        mesa.geometry.dispose();
        mesa.geometry = new T.CircleGeometry(st.RW, 360);
        mesa.geometry.rotateX(-Math.PI / 2);
      };

      // Haces y polvo en el espacio local de una estación (las ventanas de la textura de luz)
      const geomLuz = () => {
        const { u0, u1, y0, y1 } = CAJA_VENTANA;
        const Sw = st.Sw, ux = (u) => (u - 0.5) * Sw;
        const zW = -PARED;
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
        geoHaz.dispose();
        geoHaz = new T.BufferGeometry();
        geoHaz.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        geoHaz.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
        geoHaz.setIndex(idx);
        // polvo
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
        geoPolvo.dispose();
        geoPolvo = new T.BufferGeometry();
        geoPolvo.setAttribute("position", new T.BufferAttribute(pp, 3));
        geoPolvo.setAttribute("semilla", new T.BufferAttribute(se, 4));
        for (const sl of slots) {
          sl.haces.geometry = geoHaz;
          sl.polvo.geometry = geoPolvo;
        }
        aplicarNivel();
      };

      const aplicarNivel = () => {
        uHaz.uInt.value = 0.065 * cal.haces;
        geoPolvo.setDrawRange(0, cal.polvo);
        for (const sl of slots) {
          sl.haces.visible = cal.haces > 0;
          sl.polvo.visible = cal.polvo > 0;
        }
      };

      const medir = () => {
        const W = canvas.clientWidth, H = canvas.clientHeight;
        if (!W || !H) return;
        st.W = W;
        st.H = H;
        const prMax = tactil ? cal.prT : cal.pr;
        const pxr = Math.min(window.devicePixelRatio || 1, prMax);
        renderer.setPixelRatio(pxr);
        renderer.setSize(W, H, false);
        cam.aspect = ref0.aspect = W / H;
        cam.updateProjectionMatrix();
        ref0.updateProjectionMatrix();
        ref0.updateMatrixWorld();
        const [ax] = proyRef(0, ALTO, 0), [bx] = proyRef(1, ALTO, 0);
        st.ppuX = bx - ax;
        const [, ay] = proyRef(0, ALTO, 0), [, by] = proyRef(0, ALTO + 1, 0);
        st.ppuY = ay - by;
        st.apoyo = ay;
        st.hor = proyRef(0, 0, -PARED)[1];
        st.vistaEst = W / st.ppuX;
        const [xl, yt] = enPared(0, 0), [xr] = enPared(W, 0), [, yb] = enPared(0, st.hor);
        st.vistaW = xr - xl;
        st.vistaH = yt - yb;
        st.techo = pr.current.techo ?? (W > 700 ? 0.1 * H : 0.125 * H);
        // separación entre estaciones: que no se vea la vecina en reposo y que entre la palabra más ancha
        let maxPal = 0;
        if (fuenteOk) for (const pz of pr.current.piezas || []) {
          if (!pz.palabra) continue;
          const m = medirPalabra(pz.palabra);
          maxPal = Math.max(maxPal, (m.w * tamPalabra(pz.palabra, W, H)) / (W / st.vistaW));
        }
        st.S = Math.max(st.vistaEst * 1.12 + 1.5, maxPal + 1.6, 6);
        st.Rs = st.S / DELTA;
        st.RW = st.Rs + PARED;
        st.Sw = DELTA * st.RW;
        rec.pxPorEstacion = st.S * st.ppuX;
        uSet.uRW.value = st.RW;
        uSet.uSw.value = st.Sw;
        uSet.uPR.value = pxr;
        uSet.uHor.value = st.hor;
        uSet.uRes.value.set(W, H);
        uSet.uVista.value.set(st.vistaW, st.vistaH);
        uPolvo.uTam.value = 2.2 * pxr;
        geomPared();
        geomLuz();
        const lado = st.vistaEst * 0.6 + 3.5;
        Object.assign(sol.shadow.camera, { left: -lado, right: lado, top: 8, bottom: -5, near: 1, far: 45 });
        sol.shadow.camera.updateProjectionMatrix();
        const parent = canvas.closest(".tienda, .adm-escena") || canvas.parentElement;
        parent?.style.setProperty("--apoyo", st.apoyo.toFixed(1) + "px");
        parent?.style.setProperty("--horizonte", st.hor.toFixed(1) + "px");
        st.version++;
        st.sombraSucia = true;
        st.rectClave = "";
        precargar();
        pedirCuadro();
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

      // ---------- Una estación: qué pieza muestra y cómo (solo trabaja si algo cambió) ----------
      const refrescar = (sl) => {
        const piezas = pr.current.piezas || [];
        const N = piezas.length;
        const i = N ? modN(sl.k, N) : -1;
        const pz = piezas[i];
        const foto = pz?.src ? cargarFoto(pz, Math.abs(sl.k - rec.s) < 1.5) : null;
        if (foto && !foto.listo && foto.tex && Math.abs(sl.k - rec.s) < 1.2) subir(foto);
        const pal = i >= 0 ? palabraDe(i, Math.abs(sl.k - rec.s) < 1.6) : null;
        const clave = [sl.k, i, pz?.src, foto?.listo, foto?.error, pz?.tipo, pz?.glow, pz?.palabra, pal?.clave, st.version > 0 && st.W, st.H, st.Rs, pr.current.pedMin, pr.current.vista?.w].join("|");
        if (clave === sl.clave) return;
        sl.clave = clave;
        sl.i = i;
        sl.pal = pal;
        marco(sl.k, tmpM);
        sl.grupo.position.copy(tmpM.pos);
        sl.grupo.rotation.y = -tmpM.ang;
        // pedestal
        const tipo = pz?.tipo || "travertino";
        if (sl.tipo !== tipo) {
          sl.giro.clear();
          for (const [g, m] of recPed(tipo).partes) {
            const me = new T.Mesh(g, m);
            me.castShadow = me.receiveShadow = true;
            sl.giro.add(me);
          }
          sl.tipo = tipo;
          sl.vel = recPed(tipo).velocidad;
        }
        const lay = disenar(pz, foto);
        sl.lay = lay;
        sl.giro.scale.set(lay.escala, 1, lay.escala);
        sl.glow = !!pz?.glow;
        sl.colores = coloresDe(pz);
        st.sombraSucia = true;
        st.rectClave = "";
        if (!foto?.listo) {
          sl.pz.visible = false;
          sl.foto = null;
          sl.src = null;
          return;
        }
        sl.pz.position.set(0, ALTO, 0);
        sl.pieza.scale.set(lay.wU, lay.hU, 1);
        sl.pieza.position.set(lay.shiftU, 0, 0);
        sl.halo.scale.set(lay.wU, lay.hU, 1);
        sl.halo.position.set(lay.shiftU, 0, 0);
        sl.uni.img.value = foto.tex;
        sl.uni.dep.value = foto.dep;
        sl.uni.px.value = foto.px;
        sl.uniHalo.dep.value = foto.dep;
        sl.matSombra.map = foto.tex;
        sl.halo.visible = sl.glow;
        sl.pz.visible = true;
        sl.foto = foto;
        sl.src = pz.src;
      };

      // colores en los uniforms (sRGB + OKLab)
      const ponerColor = (nombre, lab, AoB) => {
        uSet["u" + nombre + AoB + "L"].value.set(lab[0], lab[1], lab[2]);
        const c = oklabARgb(lab);
        uSet["u" + nombre + AoB].value.set(c[0], c[1], c[2]);
      };
      const colEst = { A: null, B: null };
      const ponerEstaciones = (cA, cB) => {
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
      const camPos = new T.Vector3(), camMira = new T.Vector3(), adelante = new T.Vector3(), adentro = new T.Vector3(), tmp = new T.Vector3(), acV = new T.Vector3();
      const colHemi = new T.Color(), colA = new T.Color(), colB = new T.Color();

      // zona de la pantalla donde tiene que entrar la pieza entera con la ficha abierta (px CSS)
      const zonaLibre = () => {
        if (st.W >= 900) {
          const libre = st.W - Math.min(460, st.W * 0.4);
          return { cx: libre / 2, cy: st.H * 0.5, w: libre * 0.7, h: st.H * 0.6 };
        }
        const arriba = Math.max(st.H * 0.07, 66), abajo = st.H * 0.42 - 16; // debajo del logo; la ficha mide como mucho 58dvh
        return { cx: st.W / 2, cy: (arriba + abajo) / 2, w: st.W * 0.8, h: (abajo - arriba) * 0.9 };
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

        // estaciones armadas: round(s) ± 2
        const base = Math.round(s);
        for (let k = base - 2; k <= base + 2; k++) {
          const sl = slotDe(k);
          if (sl.k !== k) {
            sl.k = k;
            sl.clave = "";
          }
          refrescar(sl);
        }
        if (base !== st.base) {
          st.base = base;
          precargar();
        }

        // push-in (tocar la pieza): ZOOM_MS con ease-out cúbico, desde donde esté (se puede interrumpir)
        if (red) st.zoom = st.zoomObj;
        else if (st.zoom !== st.zoomObj) {
          const p = Math.min(1, (now - (st.zoomT || now)) / ZOOM_MS);
          st.zoom = p >= 1 ? st.zoomObj : st.zoom0 + (st.zoomObj - st.zoom0) * (1 - Math.pow(1 - p, 3));
        }
        const z = Math.max(0, Math.min(1, st.zoom));

        // cámara: en el arco, mirando hacia afuera; un pelín más lejos a mitad de camino
        const frac = Math.abs(s - base);
        const fc = s * DELTA;
        adelante.set(Math.sin(fc), 0, -Math.cos(fc));
        adentro.copy(adelante).negate();
        const ac = acV.copy(adelante).multiplyScalar(st.Rs);
        const slC = slotDe(base);
        const lay = slC.lay;
        let dist = DIST * (1 + 0.02 * Math.sin(frac * Math.PI));
        let miraY = MIRA_Y, camY = CAM_Y;
        // Encuadre del push-in: la pieza entera dentro de la zona libre que deja la ficha
        // (celu: franja de arriba, la ficha ocupa hasta el 58% de abajo; compu: a la izquierda de la ficha).
        const encuadre = z > 0 && lay ? zonaLibre() : null;
        if (encuadre) {
          const hC = ALTO + lay.hU * 0.5;
          const tg = 2 * Math.tan((FOV * Math.PI) / 360);
          const porAlto = lay.hU / (tg * (encuadre.h / st.H));
          const porAncho = lay.wU / (tg * (st.W / st.H) * (encuadre.w / st.W));
          const d1 = Math.max(5.5, Math.min(DIST, Math.max(porAlto, porAncho)));
          dist = dist + (d1 - dist) * z;
          miraY = MIRA_Y + (hC - MIRA_Y) * z;
          camY = CAM_Y + (hC + (CAM_Y - MIRA_Y) * (d1 / DIST) - CAM_Y) * z;
        }
        camPos.copy(ac).addScaledVector(adentro, dist).setY(camY);
        camMira.copy(ac).setY(miraY);
        cam.position.copy(camPos);
        cam.lookAt(camMira);
        if (encuadre) cam.setViewOffset(st.W, st.H, (st.W / 2 - encuadre.cx) * z, (st.H / 2 - encuadre.cy) * z, st.W, st.H);
        else if (cam.view?.enabled) cam.clearViewOffset();
        cam.updateMatrixWorld();

        // sol: sigue al marco de la estación (misma luz en todas)
        const lx = SOL[0], ly = SOL[1], lz = SOL[2];
        const right = [Math.cos(fc), 0, Math.sin(fc)];
        sol.target.position.copy(ac);
        sol.position.set(ac.x + right[0] * lx + adentro.x * lz, ly, ac.z + right[2] * lx + adentro.z * lz);
        sol.target.updateMatrixWorld();

        pared.rotation.y = -fc;

        // estaciones: visibles, mirando a la cámara, desenfoque y brillo
        const mitad = st.vistaEst / 2 + 4;
        const orden = slots.filter((sl) => sl.k != null).sort((a, b) => Math.abs(a.k - s) - Math.abs(b.k - s));
        const quieto = now - input.t > 2500;
        const tx = red ? 0 : quieto ? Math.sin(tiempo * 0.55) * 0.9 : input.x;
        const ty = red ? 0 : quieto ? Math.sin(tiempo * 0.33) * 0.25 : input.y;
        const kk = 1 - Math.pow(0.94, dt / 16.67);
        st.tiltX += (tx - st.tiltX) * kk;
        st.tiltY += (ty - st.tiltY) * kk;
        if (!red) st.spin += dt / 1000;
        const pulso = 0.5 + 0.5 * Math.sin(tiempo * 2.42);
        let glowSlot = null;
        orden.forEach((sl, n) => {
          const dk = Math.abs(sl.k - s);
          const ve = n < cal.max && dk * st.S < mitad;
          sl.grupo.visible = ve;
          if (!ve) return;
          sl.giro.rotation.y = st.spin * (sl.vel || 0.12);
          // la pieza mira a la cámara; el ángulo real alimenta el parallax 2.5D
          sl.grupo.worldToLocal(tmp.copy(camPos));
          const yaw = Math.atan2(tmp.x - (sl.lay?.shiftU || 0), tmp.z);
          sl.pz.rotation.y = yaw;
          sl.uni.tilt.value.set(st.tiltX + yaw * 3.2, st.tiltY);
          sl.uni.blur.value = cal.dof ? Math.min(2.6, Math.max(0, (dk - 0.12) * 3.2)) * (1 - z) : 0;
          const g = sl.glow ? pulso : 0;
          sl.uni.glow.value = sl.glow ? 0.35 + 0.45 * g : 0;
          sl.uniHalo.glow.value = sl.glow ? 0.55 + 0.4 * g : 0;
          if (sl.glow && (!glowSlot || dk < Math.abs(glowSlot.k - s))) glowSlot = sl;
        });
        if (glowSlot?.lay) {
          glowSlot.grupo.localToWorld(punto.position.set(0, ALTO + glowSlot.lay.hU * 0.45, 0.8));
          punto.intensity = 1.2 + 1.6 * pulso;
        } else punto.intensity = 0;

        // pared + mesa: estación A (floor) y B (la siguiente), esmalte según el progreso
        const kA = Math.floor(s), t = s - kA;
        const slA = slotDe(kA), slB = slotDe(kA + 1);
        if (slA.colores && slB.colores) ponerEstaciones(slA.colores, slB.colores);
        uSet.uS.value = s;
        uSet.uTime.value = tiempo;
        const hcB = ALTO + (slB.lay?.hU || 1.5) * 0.5;
        const cubre = Math.hypot(st.vistaW * 0.5 + 1, 9) + 2.2;
        // radio lineal en t: el frente avanza 1:1 con el dedo (y al soltar sigue al mismo resorte que la cámara)
        uSet.uEsm.value.set(t, t <= 0 ? -20 : -1.2 + (cubre + 1.2) * t, hcB, kA + 1);
        uSet.uK0.value = kA - 1;
        for (let j = 0; j < 4; j++) {
          const sl = slotDe(kA - 1 + j);
          const pl = sl.k === kA - 1 + j ? sl.lay?.pal : null;
          const tex = pl && sl.pal?.tex;
          uSet["uPal" + j].value = tex || negro;
          if (tex) uSet.uPalR.value[j].set(pl.cx, pl.cy, pl.hw, pl.hh);
          else uSet.uPalR.value[j].set(0, 0, 0, 0);
          const dk = Math.abs(sl.k - s);
          uSet.uPalX.value[j].set(cal.dof ? Math.min(3, Math.max(0, (dk - 0.12) * 3.4)) * (1 - z) : 0, sl.glow && sl.k === kA - 1 + j ? 0.75 + 0.25 * pulso : 0, ALTO + (sl.lay?.hU || 1.5) * 0.45, 0);
        }
        if (slA.colores && slB.colores) {
          colA.setRGB(...oklabARgb(slA.colores.mes), T.SRGBColorSpace);
          colB.setRGB(...oklabARgb(slB.colores.mes), T.SRGBColorSpace);
          hemi.groundColor.copy(colHemi.copy(colA).lerp(colB, Math.min(1, Math.max(0, (t - 0.25) * 2))));
        }
        uHaz.uTime.value = tiempo;
        uPolvo.uTime.value = tiempo;
        uPolvo.uInt.value = 0.32 * (cal.polvo > 0 ? 1 : 0);

        // sombras: solo cuando algo cambió (la cámara se mueve → la luz la sigue)
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

        // rectángulo de la pieza central (para tocarla) y aviso de "lista"
        if (!moviendo && !zoomando && slC.foto && lay) {
          const clave = [base, st.W, st.H, z.toFixed(2), lay.wU].join("|");
          if (clave !== st.rectClave) {
            st.rectClave = clave;
            const pts = [[-0.5, 0], [0.5, 0], [-0.5, 1], [0.5, 1]].map(([u, v]) => {
              slC.pieza.localToWorld(tmp.set(u, v, 0)).project(cam);
              return [((tmp.x + 1) / 2) * st.W, ((1 - tmp.y) / 2) * st.H];
            });
            const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
            const parent = canvas.closest(".tienda, .adm-escena") || canvas.parentElement;
            const l = Math.min(...xs), tp = Math.min(...ys);
            parent?.style.setProperty("--pz-l", l.toFixed(1) + "px");
            parent?.style.setProperty("--pz-t", tp.toFixed(1) + "px");
            parent?.style.setProperty("--pz-w", (Math.max(...xs) - l).toFixed(1) + "px");
            parent?.style.setProperty("--pz-h", (Math.max(...ys) - tp).toFixed(1) + "px");
          }
        }
        if (!st.avisado && slC.foto && (slC.pal || !piezas[modN(base, N)]?.palabra)) {
          st.avisado = true;
          pr.current.onListo?.();
        }
      };

      // ---------- Eventos ----------
      const offRec = rec.escuchar((tipo) => {
        if (tipo === "indice" && (pr.current.reducido || mqReducido.matches)) {
          // sin travelling: corte directo con un fundido corto
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
        for (const sl of slots) sl.clave = "";
        medir();
      });
      // los pedestales que se usan, armados cuando el navegador está libre
      idle(() => {
        if (!vivo) return;
        for (const t of new Set((pr.current.piezas || []).map((x) => x.tipo || "travertino"))) recPed(t);
      }, { timeout: 3000 });

      cleanup = () => {
        cancelAnimationFrame(st.raf);
        ro.disconnect();
        offRec();
        document.removeEventListener("visibilitychange", visibilidad);
        canvas.removeEventListener("webglcontextlost", perdido);
        for (const e of fotos.values()) liberarFoto(e);
        fotos.clear();
        for (const e of palabras.values()) e.tex?.dispose();
        palabras.clear();
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
  useEffect(() => { motor.current?.actualizar(); }, [props.piezas, props.vista?.w, props.vista?.h]);

  return (
    <div className="escena3d" aria-hidden>
      <canvas ref={ref} />
    </div>
  );
}
