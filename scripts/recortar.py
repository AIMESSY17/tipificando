"""
Recorta el fondo de fotos de productos y las deja listas para la tienda (WebP transparente).

Uso (en la carpeta del proyecto):
    pip install "rembg[cpu]" scipy pillow
    python scripts/recortar.py carpeta_con_fotos

Deja los archivos en public/productos/. Después revisalos: si quedó algo de más
(una planta, un texto), recortá la foto antes de pasarla o borrá ese pedacito.
"""
import sys, pathlib
import numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage

src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "fotos")
dst = pathlib.Path("public/productos"); dst.mkdir(parents=True, exist_ok=True)
session = new_session("isnet-general-use")

for f in sorted(src.iterdir()):
    if f.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
        continue
    im = Image.open(f).convert("RGB")
    a = np.array(remove(im, session=session))
    alpha = a[..., 3]
    lab, k = ndimage.label(alpha > 40)
    if k > 1:  # nos quedamos con la pieza (la mancha más grande) y sacamos textos sueltos
        sizes = ndimage.sum(np.ones_like(alpha), lab, range(1, k + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.08])
        a[..., 3] = np.where(ndimage.binary_dilation(keep, iterations=3), alpha, 0)
    out = Image.fromarray(a)
    out = out.crop(out.getbbox())
    # margen transparente (4% costados y arriba, 1,2% abajo): sin margen la escena estira el borde.
    # Para las fotos que ya están en public/productos: python scripts/bordes.py --arreglar
    lado = max(out.size); ml, mb = round(lado * 0.04), round(lado * 0.012)
    con = Image.new("RGBA", (out.width + 2 * ml, out.height + ml + mb), (0, 0, 0, 0))
    con.paste(out, (ml, ml)); out = con
    out.thumbnail((900, 900), Image.LANCZOS)
    name = f.stem.lower().replace(" ", "-")
    out.save(dst / f"{name}.webp", "WEBP", quality=86, method=6)
    print("ok", name, out.size)
