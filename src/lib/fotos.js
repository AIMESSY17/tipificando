// Fotos en dos tamaños: la de 1600 (compu) y la de 800 (celular).
// - Fotos del repo: /productos/x.webp  → /productos/800/x.webp  (las genera `npm run tamanos`)
// - Fotos subidas desde el admin: .../x.webp → .../x-800.webp     (el admin sube las dos)
// Si la chica no existe (fotos viejas), quien la carga vuelve a la grande.

export function fotoChica(url) {
  if (!url) return url;
  const local = url.match(/^\/productos\/([^/?#]+\.webp)$/);
  if (local) return `/productos/800/${local[1]}`;
  if (/-800\.webp(\?|#|$)/.test(url)) return url;
  if (!/\.webp(\?|#|$)/.test(url)) return url;
  return url.replace(/\.webp(?=(\?|#|$))/, "-800.webp");
}

// Celular: pantalla angosta y densidad normal. Solo en el navegador.
export function usarChica() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 700 && (window.devicePixelRatio || 1) <= 2;
}

export const fotoPara = (url) => (usarChica() ? fotoChica(url) : url);

// Carga y decodifica una imagen (lista para pintar o subir a la GPU). Si falla, prueba la de respaldo.
export function cargarImagen(src, respaldo) {
  const una = (u) =>
    new Promise((ok, mal) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.decoding = "async";
      im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => ok(im));
      im.onerror = () => mal(new Error("No se pudo cargar " + u));
      im.src = u;
    });
  return una(src).catch((e) => (respaldo && respaldo !== src ? una(respaldo) : Promise.reject(e)));
}
