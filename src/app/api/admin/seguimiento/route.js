import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/server";
import { avisarEnvio, esUuid } from "@/lib/pagos";

// El dueño carga el número de seguimiento de Andreani: el pedido pasa a «enviado» y el comprador recibe un mail.
export const dynamic = "force-dynamic";
const err = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req) {
  const yo = await requireAdmin(req);
  if (!yo) return err("No autorizado", 401);
  const db = adminDb();
  if (!db) return err("Falta conectar la base de datos.", 503);

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const tracking = String(body.tracking || "").trim().replace(/\s+/g, "").slice(0, 40);
  if (!esUuid(id)) return err("Pedido inválido");
  if (!/^[A-Za-z0-9-]{6,40}$/.test(tracking)) return err("El número de seguimiento no parece válido (solo letras, números y guiones).");

  const { data: o, error } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) return err("No se pudo leer el pedido. ¿Corriste el SQL nuevo en Supabase?", 500);
  if (!o) return err("Ese pedido no existe", 404);
  if (!["pagado", "en produccion", "enviado", "entregado"].includes(o.status)) return err("El pedido todavía no está pagado.", 409);

  const cambioNumero = o.tracking_number !== tracking;
  const patch = { tracking_number: tracking };
  if (["pagado", "en produccion"].includes(o.status)) patch.status = "enviado";
  const { error: e2 } = await db.from("orders").update(patch).eq("id", id);
  if (e2) return err("No se pudo guardar el seguimiento.", 500);

  // mail al comprador (solo si cambió el número o todavía no se mandó)
  let mail = "sin_mail";
  if (o.email && (cambioNumero || !o.tracking_sent_at)) {
    const r = await avisarEnvio(o, tracking).catch((e) => ({ ok: false, motivo: e.message }));
    if (r.ok) {
      mail = "enviado";
      await db.from("orders").update({ tracking_sent_at: new Date().toISOString() }).eq("id", id);
    } else {
      mail = "error";
      console.error("Mail de seguimiento:", r.motivo);
      return NextResponse.json({ ok: true, mail, motivo: r.motivo, estado: patch.status || o.status });
    }
  } else if (o.email) mail = "ya_enviado";
  return NextResponse.json({ ok: true, mail, estado: patch.status || o.status });
}
