import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server";

// La tienda pregunta acá antes de sumar al carrito una pieza con control de stock.
// Responde SOLO si alcanza o no (nunca cuántas quedan). Al pagar, la base lo vuelve a verificar
// con la fila bloqueada: esto es para avisar antes, no para cobrar.
//   POST { id, qty }  →  { ok: true } | { ok: false }
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const qty = Math.max(1, Math.min(99, parseInt(body?.qty, 10) || 1));
  const db = adminDb();
  if (!db || !UUID.test(id)) return NextResponse.json({ ok: true });
  const { data, error } = await db.from("products").select("stock, active").eq("id", id).maybeSingle();
  if (error || !data) return NextResponse.json({ ok: true }); // si no se puede saber, decide el checkout
  const ok = data.active && (data.stock == null || data.stock >= qty);
  return NextResponse.json({ ok }, { headers: { "Cache-Control": "no-store" } });
}
