import { NextResponse } from "next/server";
import { adminDb, liberarReservas, refrescarCatalogo } from "@/lib/server";

// Cron de Vercel (vercel.json): devuelve al stock las reservas vencidas. Es un respaldo: también
// liberan el checkout, la tienda al leer el catálogo y pg_cron en la base (cada 5 min).
// Con CRON_SECRET en Vercel, solo lo puede llamar el cron (Vercel manda «Bearer CRON_SECRET»).
export const dynamic = "force-dynamic";

export async function GET(req) {
  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const db = adminDb();
  if (!db) return NextResponse.json({ ok: true, liberados: 0, motivo: "sin base" });
  const liberados = await liberarReservas(db);
  if (liberados > 0) refrescarCatalogo();
  return NextResponse.json({ ok: true, liberados });
}
