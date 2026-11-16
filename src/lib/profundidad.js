"use client";
// Foto lista para la GPU + mapa de profundidad.
// - Con Web Worker + OffscreenCanvas: la foto se baja como blob y el worker la decodifica,
//   calcula la profundidad y devuelve un ImageBitmap ya invertido. El hilo principal no decodifica nada.
// - Sin eso: <img> con img.decode() y la profundidad en el hilo principal cuando está libre.
// La profundidad se calcula UNA vez por imagen y queda en memoria (Map por URL).
// Las filas salen de abajo hacia arriba, igual que la textura de la pieza.
import { calcularProfundidad, anchoProfundidad } from "./profundidad-calc";
import { cargarImagen } from "./fotos";

const memo = new Map(); // url → Promise<{ w, h, data }>
let worker = null;
let sinWorker = false;
let sig = 0;
const pendientes = new Map();

function elWorker() {
  if (sinWorker) return null;
  if (worker) return worker;
  try {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") throw 0;
    worker = new Worker(new URL("./profundidad.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const p = pendientes.get(e.data.id);
      if (!p) return;
      pendientes.delete(e.data.id);
      if (e.data.error) p.mal(new Error(e.data.error));
      else p.ok(e.data);
    };
    worker.onerror = () => {
      sinWorker = true;
      for (const p of pendientes.values()) p.mal(new Error("worker"));
      pendientes.clear();
    };
    return worker;
  } catch {
    sinWorker = true;
    return null;
  }
}

async function bajar(src, respaldo) {
  const r = await fetch(src, { mode: "cors", credentials: "omit" });
  if (r.ok) return r.blob();
  if (respaldo && respaldo !== src) return bajar(respaldo);
  throw new Error("No se pudo cargar " + src);
}

function enWorker(src, respaldo) {
  const wk = elWorker();
  if (!wk) return Promise.reject(new Error("sin worker"));
  return bajar(src, respaldo).then((blob) => {
    const id = ++sig;
    const conProf = !memo.has(src);
    return new Promise((ok, mal) => {
      pendientes.set(id, { ok, mal });
      wk.postMessage({ id, blob, conProf });
    }).then(({ bmp, prof }) => {
      if (prof) memo.set(src, Promise.resolve(prof));
      return { bmp, flipY: false, ratio: bmp.width / bmp.height, prof: memo.get(src) };
    });
  });
}

function profEnHiloPrincipal(img) {
  return new Promise((ok, mal) => {
    const correr = () => {
      try {
        const w = anchoProfundidad(img.naturalWidth);
        const h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth));
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.translate(0, h);
        x.scale(1, -1);
        x.drawImage(img, 0, 0, w, h);
        ok({ w, h, data: calcularProfundidad(x.getImageData(0, 0, w, h).data, w, h) });
      } catch (e) {
        mal(e);
      }
    };
    if (typeof requestIdleCallback === "function") requestIdleCallback(correr, { timeout: 300 });
    else setTimeout(correr, 0);
  });
}

async function enHiloPrincipal(src, respaldo) {
  const img = await cargarImagen(src, respaldo); // ya decodificada (img.decode())
  if (!memo.has(src)) {
    const p = profEnHiloPrincipal(img);
    p.catch(() => memo.delete(src));
    memo.set(src, p);
  }
  return { bmp: img, flipY: true, ratio: img.naturalWidth / img.naturalHeight, prof: memo.get(src) };
}

// → { bmp (ImageBitmap o <img>), flipY, ratio, prof: Promise<{ w, h, data }> }
export function prepararFoto(src, respaldo) {
  return enWorker(src, respaldo).catch(() => enHiloPrincipal(src, respaldo));
}
