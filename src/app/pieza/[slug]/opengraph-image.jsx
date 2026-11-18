// Imagen para compartir cada pieza (WhatsApp, Instagram, etc.): la pieza recortada sobre el color de
// su pared y su mesa, el nombre en Courier Prime bold con el cursor y el logo. 1200×630.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getCatalog, sitio } from "@/lib/server";
import { isLight, money } from "@/lib/format";
import { precioDe } from "@/lib/precios";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Pieza de cerámica de tipificado";
export const revalidate = 3600;

const MESA_DEF = "#e6ded2";
const hex = (c, def) => (/^#[0-9a-f]{6}$/i.test(c || "") ? c : def);

// La foto (webp) pasa a PNG para el generador. Las fotos del repo se leen del disco; las de Supabase
// (o si el disco no las tiene en el servidor) se bajan.
async function fotoPng(url) {
  if (!url) return null;
  let buf = null;
  if (url.startsWith("/")) {
    try { buf = await readFile(join(process.cwd(), "public", url.split("?")[0])); } catch {}
    if (!buf && sitio()) url = sitio() + url;
  }
  if (!buf && /^https?:/.test(url)) {
    try {
      const r = await fetch(url);
      if (r.ok) buf = Buffer.from(await r.arrayBuffer());
    } catch {}
  }
  if (!buf) return null;
  const png = await sharp(buf).resize({ height: 560, width: 540, fit: "inside", withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
  return { src: `data:image/png;base64,${png.data.toString("base64")}`, w: png.info.width, h: png.info.height };
}

export default async function Imagen({ params }) {
  const { slug } = await params;
  const { products } = await getCatalog();
  const p = products.find((x) => x.slug === decodeURIComponent(slug)) || products[0];
  const pared = hex(p?.bg, "#c46a4c"), mesa = hex(p?.table_color, MESA_DEF);
  const tinta = isLight(pared, 0.55) ? "#26201c" : "#f6f0e4";
  const tintaMesa = isLight(mesa) ? "#26201c" : "#f6f0e4";
  const [fuente, logoSvg, foto] = await Promise.all([
    readFile(join(process.cwd(), "node_modules/@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff")),
    readFile(join(process.cwd(), "public/marca/logo-texto.svg"), "utf8"),
    fotoPng(p?.image_url).catch(() => null),
  ]);
  const logo = `data:image/svg+xml;base64,${Buffer.from(logoSvg.replace('fill="#000"', `fill="${tinta}"`)).toString("base64")}`;
  const nombre = p?.name || "tipificado";
  const fs = nombre.length > 22 ? 64 : nombre.length > 14 ? 78 : 96;
  // la foto: alta, apoyada sobre la mesa (el horizonte en 70%)
  const fh0 = foto ? Math.min(440, foto.h) : 0, fw0 = foto ? (foto.w * fh0) / foto.h : 0;
  const k = fw0 > 540 ? 540 / fw0 : 1, fh = fh0 * k, fw = fw0 * k;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: pared, fontFamily: "Courier Prime" }}>
        {/* mesa y una luz suave en la pared */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 441, display: "flex",
          backgroundImage: `radial-gradient(70% 90% at 30% 30%, rgba(255,240,220,0.22), rgba(255,240,220,0) 70%)` }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 441, bottom: 0, background: mesa, display: "flex",
          backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.12), rgba(0,0,0,0) 30%)" }} />
        {foto && (
          <div style={{ position: "absolute", left: 300 - fw / 2, top: 500 - fh, width: fw, height: fh, display: "flex" }}>
            <div style={{ position: "absolute", left: fw * 0.16, right: fw * 0.16, bottom: -6, height: 14, borderRadius: "50%", display: "flex",
              background: "rgba(30,14,4,0.30)", boxShadow: "0 0 26px 16px rgba(30,14,4,0.22)" }} />
            <img src={foto.src} width={fw} height={fh} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
          </div>
        )}
        <div style={{ position: "absolute", left: 640, right: 60, top: 90, display: "flex", flexDirection: "column", color: tinta }}>
          <img src={logo} width={230} height={45} alt="" style={{ marginBottom: 40, opacity: 0.9 }} />
          <div style={{ display: "flex", alignItems: "flex-end", fontSize: fs, fontWeight: 700, lineHeight: 0.98, letterSpacing: -3 }}>
            <span>{nombre}</span>
            <span style={{ width: fs * 0.08, height: fs * 0.86, marginLeft: fs * 0.12, marginBottom: fs * 0.08, borderRadius: 99, background: tinta, opacity: 0.75 }} />
          </div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 30, opacity: 0.78 }}>cerámica hecha a mano</div>
        </div>
        <div style={{ position: "absolute", left: 640, bottom: 58, display: "flex", fontSize: 40, fontWeight: 700, color: tintaMesa }}>
          {p ? money(precioDe(p)) : ""}
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Courier Prime", data: fuente, weight: 700, style: "normal" }] }
  );
}
