// Genera la versión chica (800 px en el lado más largo) de cada foto de public/productos.
// Uso: npm run tamanos
// La tienda usa estas en celulares (ancho < 700 px y DPR <= 2) y las de 1600 en compu.
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "productos");
const destino = path.join(raiz, "800");
await mkdir(destino, { recursive: true });

const fotos = (await readdir(raiz)).filter((f) => f.endsWith(".webp"));
for (const f of fotos) {
  const info = await sharp(path.join(raiz, f))
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84, alphaQuality: 90, effort: 5 })
    .toFile(path.join(destino, f));
  console.log(`${f} → 800/${f} (${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB)`);
}
