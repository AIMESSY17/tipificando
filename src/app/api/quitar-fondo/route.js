import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server";

// Quita el fondo de una foto usando remove.bg (opcional).
// Si no está REMOVE_BG_API_KEY, el panel esconde el botón y se suben PNG ya recortados
// (o se recortan con scripts/recortar.py).
export async function POST(req) {
  const key = process.env.REMOVE_BG_API_KEY;
  if (!key) return NextResponse.json({ error: "No configurado" }, { status: 503 });
  const email = await requireAdmin(req);
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("image");
  if (!file) return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
  const out = new FormData();
  out.append("image_file", file);
  out.append("size", "auto");
  out.append("format", "png");
  const r = await fetch("https://api.remove.bg/v1.0/removebg", { method: "POST", headers: { "X-Api-Key": key }, body: out });
  if (!r.ok) return NextResponse.json({ error: "remove.bg: " + (await r.text()).slice(0, 200) }, { status: 502 });
  return new NextResponse(await r.arrayBuffer(), { headers: { "Content-Type": "image/png" } });
}

export async function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.REMOVE_BG_API_KEY) });
}
