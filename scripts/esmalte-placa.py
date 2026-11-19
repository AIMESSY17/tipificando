"""
Saca el esmalte REAL de las fotos HD de las piezas para la placa de "CATÁLOGO COMPLETO".

Uso (en la carpeta del proyecto):
    pip install pillow numpy scipy
    python scripts/esmalte-placa.py

Genera en public/esmalte/:
  moteado.webp  recorte de la zona lisa del portamacetas moteado (esmalte crema con puntitos), aplanado
                (sin el volumen de la pieza) y hecho tileable. Casi blanco con los puntitos oscuros:
                la placa lo MULTIPLICA sobre el color de la pieza protagonista.
  liso.webp     lo mismo con la taza clásica (esmalte liso): la leve variación del vidriado. Se aplica
                con soft-light para que el color no sea plano.
"""
import pathlib
import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FOTOS = RAIZ / "public" / "productos"
SALIDA = RAIZ / "public" / "esmalte"
SALIDA.mkdir(parents=True, exist_ok=True)


def zona(nombre, caja):
    """Recorta (fracciones l, t, r, b de la foto) y devuelve luminancia + máscara de píxeles opacos."""
    im = Image.open(FOTOS / f"{nombre}.webp").convert("RGBA")
    w, h = im.size
    l, t, r, b = caja
    im = im.crop((int(l * w), int(t * h), int(r * w), int(b * h)))
    a = np.asarray(im).astype(np.float32)
    assert a[..., 3].min() > 250, f"{nombre}: el recorte toca el borde de la pieza"
    return a[..., :3]


def aplanar(rgb, sigma):
    """Divide por la iluminación de baja frecuencia (el volumen de la pieza): queda solo el esmalte."""
    lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    base = ndimage.gaussian_filter(lum, sigma, mode="reflect")
    # los puntos oscuros no deben bajar la base: la medimos con un filtro de mediana grande
    base = ndimage.gaussian_filter(ndimage.median_filter(lum[::4, ::4], size=15), sigma / 4, mode="reflect")
    base = np.asarray(Image.fromarray(base).resize(lum.shape[::-1], Image.BICUBIC))
    return lum / np.maximum(base, 1.0)


def sin_manchones(rel, area_max=350):
    """Saca las manchas grandes sueltas (un punto de 30 px parece un tornillo en la placa): quedan los puntitos."""
    lab, k = ndimage.label(rel < 0.8)
    areas = ndimage.sum(np.ones_like(rel), lab, range(1, k + 1))
    grandes = np.isin(lab, [i + 1 for i, ar in enumerate(areas) if ar > area_max])
    grandes = ndimage.binary_dilation(grandes, iterations=4)
    out = rel.copy()
    out[grandes] = 1.0
    return out


def tileable(a, franja=0.22):
    """Hace la imagen repetible: mezcla cada borde con el opuesto (rampas lineales en una franja)."""
    h, w = a.shape
    out = a.copy()
    fw = int(w * franja)
    rampa = np.linspace(0, 1, fw, dtype=np.float32)
    # horizontal: el borde derecho se funde hacia la parte que sigue a la izquierda
    izq = a[:, :fw]
    der = a[:, w - fw:]
    out[:, w - fw:] = der * (1 - rampa) + izq * rampa
    fh = int(h * franja)
    rampa = np.linspace(0, 1, fh, dtype=np.float32)[:, None]
    sup = out[:fh]
    inf = out[h - fh:]
    out[h - fh:] = inf * (1 - rampa) + sup * rampa
    return out


def guardar(nombre, rel, ganancia, piso, tam, rotar=False, mate=1.0):
    """rel: lum/base (1 = esmalte liso, <1 = puntitos). Sale como gris casi blanco para multiplicar."""
    if rotar:
        rel = np.rot90(rel)
    rel = tileable(rel)
    # la ganancia realza el contraste del moteado; el piso evita que el multiply ensucie el color
    v = 1.0 - (1.0 - rel) * ganancia
    v = np.clip(v, 0.0, 1.0)
    v = piso + (1.0 - piso) * v
    img = Image.fromarray((np.clip(v, 0, 1) * 255).astype(np.uint8), "L")
    img = img.resize(tam, Image.LANCZOS)
    img.save(SALIDA / f"{nombre}.webp", quality=88, method=6)
    print(nombre, img.size, round((SALIDA / f"{nombre}.webp").stat().st_size / 1024), "KB")


# Portamacetas moteado: costado derecho de la pieza, lejos del sello «tipificado…|» y de los bordes
mot = zona("portamacetas-moteado", (0.52, 0.20, 0.90, 0.88))
rel = aplanar(mot, 90)
# lo que queda por encima de 1 (brillos del esmalte) se recorta: solo interesan los puntitos y la veta
guardar("moteado", sin_manchones(np.minimum(rel, 1.0)), ganancia=1.15, piso=0.55, tam=(1536, 896), rotar=True)

# Taza clásica: esmalte liso del cuerpo (debajo del sello, sin brillos de ventana fuertes)
liso = zona("taza-clasica", (0.40, 0.58, 0.80, 0.80))
rel = aplanar(liso, 90)
guardar("liso", np.clip(rel, 0.0, 1.6), ganancia=5.0, piso=0.0, tam=(1024, 352))
