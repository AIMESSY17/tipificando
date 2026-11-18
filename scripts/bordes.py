"""
Revisa y arregla los bordes de las fotos de public/productos (las de 1600).

    python scripts/bordes.py                 # solo revisa: qué piezas tocan el borde o no tienen margen
    python scripts/bordes.py --arreglar      # recorta al contorno, deja margen transparente y rellena huecos
    python scripts/bordes.py --arreglar --origen carpeta   # lo mismo, leyendo las fotos de otra carpeta
                                             # (siempre partir de las menos procesadas: recomprimir
                                             # una foto ya comprimida le saca nitidez)
    npm run tamanos                          # después: regenera las de 800

Por qué: en la escena la pieza se dibuja con parallax y el shader repite el último píxel del borde
(clamp). Si la pieza toca el borde de la imagen, ese píxel se "estira" y la pieza se ve mochada.
Con un margen transparente alrededor, lo que se repite es transparente.

- Margen: 4% del lado mayor a los costados y arriba, 1,2% abajo (la base queda casi al ras: la
  escena apoya la pieza en el borde de abajo de la imagen).
- Huecos: el recorte a veces deja semitransparentes las rayas o manchas de color (la pared se ve a
  través). En las piezas sin asa se rellenan todos los huecos internos; el color que falta se toma
  de los vecinos. Las piezas con asa (SIN_RELLENO) no se tocan: su hueco es real.
- Es idempotente: correrlo dos veces da lo mismo (primero recorta al contorno, después agrega margen).
"""
import sys, pathlib
import numpy as np
from PIL import Image, ImageDraw

CARPETA = pathlib.Path("public/productos")
LADO = 1800   # tope del lado mayor (con el margen ya pasa de 1600: no se reescala hacia abajo)
CALIDAD = 96  # WebP casi sin pérdida (el alfa va siempre sin pérdida)
M_LADO, M_ARRIBA, M_ABAJO = 0.04, 0.04, 0.012
SIN_RELLENO = {"taza-clasica", "taza-panzona", "tazon", "pino-navidad"}  # asas / ramas: huecos reales


def huecos(al):
    sil = Image.fromarray(((al > 100) * 255).astype(np.uint8))
    pad = Image.new("L", (sil.width + 2, sil.height + 2), 0)
    pad.paste(sil, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    return np.array(pad)[1:-1, 1:-1] != 128  # adentro de la silueta (incluye huecos)


def rellenar(a):
    a = a.astype(np.float32)
    al = a[..., 3]
    dentro = huecos(al)
    conocido = ~dentro | (al >= 60)
    rgb = a[..., :3].copy()
    for _ in range(600):
        falta = ~conocido
        if not falta.any():
            break
        s = np.zeros_like(rgb)
        c = np.zeros(al.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            k = np.roll(conocido, (dy, dx), (0, 1))
            s += np.roll(rgb, (dy, dx), (0, 1)) * k[..., None]
            c += k
        nuevo = falta & (c > 0)
        rgb[nuevo] = s[nuevo] / c[nuevo][:, None]
        conocido |= nuevo
    a[..., :3] = rgb
    a[..., 3] = np.where(dentro, 255, al)
    return a.clip(0, 255).astype(np.uint8)


def revisar(f):
    a = np.array(Image.open(f).convert("RGBA"))[..., 3]
    h, w = a.shape
    ys, xs = np.nonzero(a > 8)
    m = [xs.min(), w - 1 - xs.max(), ys.min(), h - 1 - ys.max()]  # izq, der, arriba, abajo (px)
    borde = {"arriba": int((a[0] > 128).sum()), "abajo": int((a[-1] > 128).sum()), "izq": int((a[:, 0] > 128).sum()), "der": int((a[:, -1] > 128).sum())}
    toca = {k: v for k, v in borde.items() if v}
    falta = min(m[0], m[1], m[2]) < 0.02 * max(w, h)
    estado = "TOCA EL BORDE " + str(toca) if toca else ("sin margen" if falta else "ok")
    print(f"{f.name:28s} {w}x{h}  margen izq {m[0]} der {m[1]} arriba {m[2]} abajo {m[3]}  -> {estado}")
    return bool(toca) or falta


def arreglar(f):
    a = np.array(Image.open(f).convert("RGBA"))
    if f.stem not in SIN_RELLENO:
        a = rellenar(a)
    im = Image.fromarray(a)
    im = im.crop(Image.fromarray((a[..., 3] > 8).astype(np.uint8) * 255).getbbox())
    w, h = im.size
    lado = max(w, h)
    ml, mt, mb = round(M_LADO * lado), round(M_ARRIBA * lado), round(M_ABAJO * lado)
    out = Image.new("RGBA", (w + 2 * ml, h + mt + mb), (0, 0, 0, 0))
    out.paste(im, (ml, mt))
    k = LADO / max(out.size)
    if k < 1:
        out = out.resize((round(out.width * k), round(out.height * k)), Image.LANCZOS)
    out.save(CARPETA / f.name, "WEBP", quality=CALIDAD, alpha_quality=100, method=6, exact=True)
    print("arreglada", f.name, out.size)


if __name__ == "__main__":
    origen = pathlib.Path(sys.argv[sys.argv.index("--origen") + 1]) if "--origen" in sys.argv else CARPETA
    fotos = sorted(origen.glob("*.webp"))
    if "--arreglar" in sys.argv:
        for f in fotos:
            arreglar(f)
        print()
        fotos = sorted(CARPETA.glob("*.webp"))
    malas = [f.name for f in fotos if revisar(f)]
    sys.exit(1 if malas and "--arreglar" not in sys.argv else 0)
