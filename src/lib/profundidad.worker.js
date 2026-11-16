// Web Worker: decodifica la foto y calcula el mapa de profundidad fuera del hilo principal.
// Devuelve el bitmap ya invertido (listo para subir a la GPU) y la profundidad.
import { calcularProfundidad, anchoProfundidad } from "./profundidad-calc";

self.onmessage = async (e) => {
  const { id, blob, conProf } = e.data;
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "none" });
    let prof = null;
    if (conProf) {
      const w = anchoProfundidad(bmp.width);
      const h = Math.max(1, Math.round((w * bmp.height) / bmp.width));
      const c = new OffscreenCanvas(w, h);
      const x = c.getContext("2d", { willReadFrequently: true });
      x.drawImage(bmp, 0, 0, w, h);
      prof = { w, h, data: calcularProfundidad(x.getImageData(0, 0, w, h).data, w, h) };
    }
    self.postMessage({ id, bmp, prof }, prof ? [bmp, prof.data.buffer] : [bmp]);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
