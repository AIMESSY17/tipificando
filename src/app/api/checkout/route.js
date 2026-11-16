import { NextResponse } from "next/server";
import { adminDb, cotizar, huellaIp, modoPrueba, pagosActivos, sitio } from "@/lib/server";
import { MINUTOS_RESERVA, copiaEnvio, itemsParaMP } from "@/lib/precios";

// Crea el pedido y la preferencia de Mercado Pago (Checkout Pro).
// Precios, cupón y envío SIEMPRE salen del servidor, nunca del navegador.
const MAX_INTENTOS = 10;
const VENTANA_MIN = 10;
const err = (error, status) => NextResponse.json({ error }, { status });

export async function POST(req) {
  if (!pagosActivos()) return err("Mercado Pago todavía no está activado. Usá «Copiar pedido» o «Enviar por DM».", 503);
  const db = adminDb();
  const token = process.env.MP_ACCESS_TOKEN;
  const site = sitio();
  // Mercado Pago necesita HTTPS para volver a la tienda y para avisar los pagos (webhook)
  if (!/^https:\/\//i.test(site) && !modoPrueba()) {
    console.error("NEXT_PUBLIC_SITE_URL tiene que empezar con https:// para cobrar con Mercado Pago:", site);
    return err("Mercado Pago no está bien configurado. Usá «Copiar pedido» o «Enviar por DM».", 503);
  }

  // Límite anti-abuso: 10 intentos por IP cada 10 minutos (en la base, no en memoria)
  const { data: permitido, error: limErr } = await db.rpc("permitir_intento", { p_ip: huellaIp(req), p_max: MAX_INTENTOS, p_minutos: VENTANA_MIN });
  if (limErr) console.error("Límite de intentos:", limErr.message);
  else if (permitido === false) return err("Hiciste muchos intentos seguidos. Esperá unos minutos o mandanos el pedido por DM.", 429);

  let body;
  try {
    body = await req.json();
  } catch {
    return err("Pedido inválido", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return err("Pedido inválido", 400);
  const name = String(body.name || "").trim().slice(0, 80);
  const contact = String(body.contact || "").trim().slice(0, 80);
  const note = String(body.note || "").trim().slice(0, 500);
  if (!name) return err("Falta tu nombre", 400);

  const c = await cotizar(body);
  if (c.error) return err(c.error, c.status || 400);
  if (c.code && c.cuponError) return err(c.cuponError + " Sacalo para seguir.", 400);

  const items = itemsParaMP(c.items, c.discount, c.cupon?.code);
  if (!items.length) return err("Con ese cupón el pedido queda sin cargo: mandanos el pedido por DM y lo coordinamos.", 400);

  // Un solo vencimiento para todo: reserva del cupón (base) y link de pago (Mercado Pago)
  const vence = new Date(Date.now() + MINUTOS_RESERVA * 60_000).toISOString();

  // Pedido + reserva del cupón, todo junto y atómico (respeta el límite aunque compren dos a la vez)
  const { data: pedido, error } = await db.rpc("crear_pedido", {
    p_vence: vence,
    p_customer_name: name, p_contact: contact, p_note: note, p_items: c.items,
    p_subtotal: c.subtotal, p_discount: c.discount, p_coupon_code: c.cupon?.code || null,
    p_shipping: copiaEnvio(c.envio), p_shipping_cost: c.shipping_cost, p_total: c.total,
  });
  if (error) {
    if (/cupon_no_disponible/.test(error.message)) return err("Ese cupón ya no está disponible. Sacalo para seguir.", 409);
    console.error("crear_pedido:", error.message);
    return err("No pudimos guardar el pedido. Probá de nuevo.", 500);
  }
  const orderId = pedido.id;

  const volver = `${site}/gracias?pedido=${orderId}`;
  const pref = {
    items,
    payer: { name },
    external_reference: String(orderId),
    statement_descriptor: "TIPIFICADO",
    back_urls: { success: volver, pending: volver, failure: volver },
    auto_return: "approved",
    expires: true,
    expiration_date_to: vence,
    // source_news=webhooks: Mercado Pago avisa solo en formato webhook (con firma), no en el viejo IPN
    notification_url: `${site}/api/mp-webhook?source_news=webhooks`,
    metadata: { pedido: pedido.number },
  };
  // El envío con costo fijo va como costo de envío de Mercado Pago
  if (c.shipping_cost > 0) pref.shipments = { mode: "not_specified", cost: c.shipping_cost };

  let j = {};
  try {
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Idempotency-Key": String(orderId) },
      body: JSON.stringify(pref),
      signal: AbortSignal.timeout(15000),
    });
    j = await r.json().catch(() => ({}));
    if (!r.ok || !j.init_point) throw new Error(`MP ${r.status} ${j.message || ""}`);
  } catch (e) {
    console.error("Mercado Pago (preferencia):", e.message, j);
    // el pedido queda cancelado así no reserva el cupón
    await db.from("orders").update({ status: "cancelado", internal_notes: "No se pudo abrir Mercado Pago" }).eq("id", orderId);
    return err("Mercado Pago no respondió. Probá de nuevo en un ratito.", 502);
  }
  await db.from("orders").update({ mp_preference_id: j.id }).eq("id", orderId);
  return NextResponse.json({ url: j.init_point });
}
