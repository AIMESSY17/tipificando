import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server";

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const clean = (v, n) => String(v || "").trim().slice(0, n);
  const row = { nombre: clean(b.nombre, 120), contacto: clean(b.contacto, 120), pedido: clean(b.pedido, 300), mensaje: clean(b.mensaje, 1000) };
  if (!row.nombre || !row.contacto || !row.pedido) return NextResponse.json({ error: "Completá todos los campos" }, { status: 400 });
  const code = "ARR-" + Date.now().toString(36).toUpperCase();
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "Todavía no está activo. Escribinos por Instagram." }, { status: 503 });
  const { error } = await db.from("arrepentimientos").insert({ ...row, code });
  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  return NextResponse.json({ code });
}
