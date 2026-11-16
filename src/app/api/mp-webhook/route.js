import { NextResponse } from "next/server";
import { adminDb, huellaIp, modoPrueba } from "@/lib/server";
import { firmaValida, procesarPago } from "@/lib/pagos";

// Mercado Pago avisa acá cuando cambia un pago.
// 1) Se valida la firma (MP_WEBHOOK_SECRET es obligatoria; solo con MP_MODO=prueba se acepta sin clave).
// 2) Se consulta el pago a MP (no se confía en lo que llega) y se aplica al pedido de forma idempotente.
// 3) Cada aviso queda registrado en la tabla mp_webhooks para poder revisar problemas.
export const dynamic = "force-dynamic";

export async function POST(req) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const topic = String(body.type || url.searchParams.get("type") || url.searchParams.get("topic") || "");
  // para la firma vale el data.id que viene en la URL; si no, el del cuerpo
  const dataId = String(url.searchParams.get("data.id") || body?.data?.id || url.searchParams.get("id") || "").slice(0, 64);
  const requestId = req.headers.get("x-request-id") || "";
  const signature = req.headers.get("x-signature") || "";
  const secret = process.env.MP_WEBHOOK_SECRET;

  const firmaOk = secret ? firmaValida({ secret, signature, requestId, dataId }) : modoPrueba();
  const db = adminDb();

  const log = async (fila) => {
    if (!db) return;
    const { error } = await db.from("mp_webhooks").insert({
      request_id: requestId || null, topic: topic || null, data_id: dataId || null, firma_ok: firmaOk, ...fila,
    });
    if (error) console.error("mp_webhooks:", error.message);
  };

  if (!firmaOk) {
    // Aviso no confiable: se guarda solo fecha (automática), IP y motivo. Nada del cuerpo ni de los parámetros.
    if (db) {
      const ip = huellaIp(req);
      const { error } = await db.from("mp_webhooks").insert({
        ip, firma_ok: false, resultado: "firma inválida",
        detalle: { motivo: secret ? "la firma no coincide" : "falta MP_WEBHOOK_SECRET" },
      });
      if (error) console.error("mp_webhooks:", error.message);
    }
    return NextResponse.json({ error: "firma" }, { status: 401 });
  }
  if (topic !== "payment" || !dataId) {
    await log({ resultado: "ignorado", detalle: { motivo: "no es un aviso de pago", action: body.action || null } });
    return NextResponse.json({ ok: true });
  }

  const r = await procesarPago(dataId);
  await log({ resultado: r.resultado, order_id: r.orderId || null, mp_status: r.mpStatus || null, detalle: r.detalle || null });
  // si falló algo nuestro o de MP, devolvemos error para que Mercado Pago reintente más tarde
  if (r.reintentar) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
