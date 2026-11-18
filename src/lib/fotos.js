// Fotos en dos tamaños: 1600 (la protagonista y sus vecinas en la escena) y 800 (las lejanas,
// las miniaturas y el arranque en el celular).
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
