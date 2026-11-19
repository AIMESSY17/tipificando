"""
Reconstruye la budinera entera a partir de su MITAD DERECHA (la foto original corta el extremo izquierdo).

    python scripts/budinera.py                      # lee la foto original de git (4f36a51)
    python scripts/budinera.py --origen foto.webp   # o de un archivo
    npm run tamanos                                 # después: regenera la de 800
    python scripts/bordes.py                        # y revisar márgenes

La budinera es simétrica de izquierda a derecha, así que:
1. Se rellenan los huecos del recorte (igual que bordes.py).
2. Perspectiva: el lado derecho está más cerca de la cámara (el borde trasero sube y la base baja
   hacia la derecha). Se escala cada columna en vertical alrededor del filo celeste delantero
   (Y_FILO) para que el borde de arriba y la base queden parejos; si no, al espejar se vería un
   pico en el centro.
3. El eje es el centro de la raya azul del medio (EJE): así las rayas espejadas caen donde estaban
   las reales y el borde, el filo celeste y las rayas quedan alineados.
4. Mitad izquierda = mitad derecha espejada (mismo brillo y tono en las dos mitades: son los mismos
   píxeles). Antes se borran dos motitas de la mitad derecha que, repetidas, delatarían el espejo.
   La raya del medio se deja la real (espejada sería una mancha de test de Rorschach): la foto se
   funde con el espejo en el crema que hay entre esa raya y la siguiente, así no hay fantasma.
5. Costura: la punta de la sombra del interior cae justo sobre el eje y espejada forma una cuña
   oscura. Se emparejan los colores del interior alrededor del eje (ganancia suave por canal, sacada
   de un cierre morfológico del color difuminado): la textura queda, la cuña desaparece.
6. Se recorta al contorno con el mismo margen transparente que bordes.py y se guarda en WebP 96.
"""
import sys, io, pathlib, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import bordes  # noqa: E402

EJE = 732          # x del centro de la raya del medio en la foto original (1600×647)
Y_FILO = 283       # y del filo celeste delantero en el centro
# pendientes medidas (ajuste lineal entre x=300 y x=1250) del borde de arriba y de la base
P_ARRIBA, P_ABAJO = -0.0249, 0.0180
MOTAS = [(366, 380, 1162, 1184), (374, 389, 865, 893)]  # (y0, y1, x0, x1) en la foto original
COSTURA = 120      # px a cada lado del eje en los que se emparejan las luces del interior
REAL, FUNDIDO = 48, 100  # la raya del medio es la de la foto; entre 48 y 100 px se funde con el espejo


def cargar():
    if "--origen" in sys.argv:
        return Image.open(sys.argv[sys.argv.index("--origen") + 1])
    datos = subprocess.run(["git", "show", "4f36a51:public/productos/budinera.webp"], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(datos))


def enderezar(pm):
    """Escala cada columna en vertical alrededor de Y_FILO para emparejar la perspectiva."""
    h, w, _ = pm.shape
    al = pm[..., 3]
    xs = np.arange(w, dtype=np.float32)
    cols = np.nonzero((al > 128).any(0))[0]
    x0 = np.clip(xs, cols.min(), cols.max())
    arriba = np.array([np.nonzero(al[:, int(x)] > 128)[0].min() for x in [EJE]])[0]
    abajo = np.array([np.nonzero(al[:, int(x)] > 128)[0].max() for x in [EJE]])[0]
    d_arr, d_abj = Y_FILO - arriba, abajo - Y_FILO
    s_arr = d_arr / (d_arr - P_ARRIBA * (x0 - EJE))   # distancia real / distancia en la foto
    s_abj = d_abj / (d_abj + P_ABAJO * (x0 - EJE))
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    s = np.where(yy < Y_FILO, s_arr[None, :], s_abj[None, :])
    ys = Y_FILO + (yy - Y_FILO) / s
    out = np.stack([ndimage.map_coordinates(pm[..., c], [ys, xx], order=3, mode="constant", cval=0) for c in range(4)], -1)
    out[..., 3] = out[..., 3].clip(0, 255)
    out[..., :3] = np.minimum(out[..., :3].clip(0, 255), out[..., 3:4])
    return out


def sin_motas(a):
    a = a.copy()
    conocido = np.ones(a.shape[:2], bool)
    for y0, y1, x0, x1 in MOTAS:
        conocido[y0:y1, x0:x1] = False
    rgb = a[..., :3]
    for _ in range(40):
        falta = ~conocido
        if not falta.any():
            break
        s = np.zeros_like(rgb)
        c = np.zeros(conocido.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k = np.roll(conocido, (dy, dx), (0, 1))
            s += np.roll(rgb, (dy, dx), (0, 1)) * k[..., None]
            c += k
        nuevo = falta & (c > 0)
        rgb[nuevo] = s[nuevo] / c[nuevo][:, None]
        conocido |= nuevo
    return a


def espejar(pm):
    """Mitad izquierda = derecha espejada; la raya del medio queda la real (fundido en el crema)."""
    der = pm[:, EJE:]                         # mitad derecha (incluye la columna del eje)
    eje = der.shape[1] - 1
    out = np.concatenate([der[:, :0:-1], der], 1)
    real = np.zeros_like(out)
    real[:, eje - EJE:] = pm                  # la foto (enderezada) en su lugar
    x = np.arange(out.shape[1], dtype=np.float32)
    t = np.clip((eje - REAL - x) / (FUNDIDO - REAL), 0, 1)
    peso = 1 - t * t * (3 - 2 * t)            # 1 hasta REAL px del eje → 0 a FUNDIDO px (en el crema)
    peso[x > eje] = 0
    peso = peso[None, :, None]
    return out * (1 - peso) + real * peso, eje


def coser(pm, eje):
    """Saca la cuña oscura del interior sobre el eje sin tocar la textura (ganancia por canal)."""
    h, w, _ = pm.shape
    al = pm[..., 3]
    x = np.arange(w, dtype=np.float32)
    t = np.clip(np.abs(x - eje) / COSTURA, 0, 1)
    mx = 1 - t * t * (3 - 2 * t)
    y = np.arange(h, dtype=np.float32)
    my = np.clip((Y_FILO - 5 - y) / 6, 0, 1)                     # solo el interior (arriba del filo)
    m = ndimage.gaussian_filter((my[:, None] * mx[None, :] * (al > 250)).astype(np.float32), 2)
    out = pm.copy()
    for c in range(3):
        col = pm[..., c] / np.maximum(al, 1) * 255
        suave = ndimage.gaussian_filter(col, 2.5)
        ref = ndimage.grey_closing(suave, size=(1, 2 * COSTURA + 1))   # rellena el valle de la cuña
        ref = ndimage.gaussian_filter(ref, 4)
        g = 1 + (np.clip(ref / np.maximum(suave, 1e-3), 1, 1.5) - 1) * m
        out[..., c] = np.minimum(pm[..., c] * g, al)
    return out


def main():
    a = np.array(cargar().convert("RGBA")).astype(np.uint8)
    a = sin_motas(bordes.rellenar(a).astype(np.float32))
    pm = a.copy()
    pm[..., :3] *= pm[..., 3:4] / 255          # premultiplicado: interpolar sin halos
    pm, eje = espejar(enderezar(pm))
    pm = coser(pm, eje)
    al = pm[..., 3]
    rgb = pm[..., :3] / np.maximum(al[..., None], 1e-3) * 255
    out = np.dstack([rgb, al]).clip(0, 255).round().astype(np.uint8)
    out[al < 1] = 0
    im = Image.fromarray(out)
    im = im.crop(Image.fromarray(((out[..., 3] > 8) * 255).astype(np.uint8)).getbbox())
    w, h = im.size
    lado = max(w, h)
    ml, mt, mb = round(bordes.M_LADO * lado), round(bordes.M_ARRIBA * lado), round(bordes.M_ABAJO * lado)
    fin = Image.new("RGBA", (w + 2 * ml, h + mt + mb), (0, 0, 0, 0))
    fin.paste(im, (ml, mt))
    k = bordes.LADO / max(fin.size)
    if k < 1:
        fin = fin.resize((round(fin.width * k), round(fin.height * k)), Image.LANCZOS)
    destino = bordes.CARPETA / "budinera.webp"
    fin.save(destino, "WEBP", quality=bordes.CALIDAD, alpha_quality=100, method=6, exact=True)
    if "--png" in sys.argv:
        fin.save(sys.argv[sys.argv.index("--png") + 1])
    print("budinera", fin.size)


if __name__ == "__main__":
    main()
