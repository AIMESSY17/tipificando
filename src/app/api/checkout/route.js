import { NextResponse } from "next/server";
import { adminDb, cotizar, huellaIp, liberarReservas, modoPrueba, pagosActivos, refrescarCatalogo, sitio, getCatalog } from "@/lib/server";
import { MINUTOS_RESERVA, copiaEnvio, itemsParaMP } from "@/lib/precios";
import { MODALIDADES } from "@/lib/envio";
import { validarEntrega } from "@/lib/zipnova";
import { mensajeSinStock } from "@/lib/stock";

// Crea el pedido y la preferencia de Mercado Pago (Checkout Pro).
// Precios, cupón y envío SIEMPRE salen del servidor, nunca del navegador.
const MAX_INTENTOS = 10;
const VENTANA_MIN = 10;
const err = (error, status, extra) => NextResponse.json({ error, ...extra }, { status });

// El error 'sin_stock' de la base trae en el detalle [{ id, name, agotada }] (nunca cuántas quedan)
function faltantesDe(error) {
  try {
    const f = JSON.parse(error.details || "[]");
    return Array.isArray(f) ? f.map((x) => ({ id: x.id, name: String(x.name || "Una pieza"), agotada: Boolean(x.agotada) })) : [];
  } catch {
    return [];
  }
}

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
  const email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  if (!name) return err("Falta tu nombre", 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return err("Ese mail no parece válido. Revisalo.", 400);

  // Envío por Andreani: hace falta el destino completo y el mail para avisarte cuando salga
  const entrega = body.destino ? validarEntrega(body.destino) : null;

  // Antes de reservar, las reservas vencidas vuelven al stock (también corre sola en la base y con el cron)
  await liberarReservas(db);

  const c = await cotizar(entrega?.destino ? { ...body, destino: entrega.destino } : body);
  if (c.error) return err(c.error, c.status || 400, c.sinStock ? { sinStock: c.sinStock } : undefined);
  if (c.code && c.cuponError) return err(c.cuponError + " Sacalo para seguir.", 400);

  let envioCopia = copiaEnvio(c.envio);
  let detalleEnvio = null;
  if (c.envio?.kind === "andreani") {
    if (!email) return err("Dejanos tu mail para avisarte cuando salga tu envío.", 400);
    if (entrega?.error) return err(entrega.error, 400);
    const a = c.auto;
    const dest = entrega.destino;
    if (!a || a.pendiente) return err("No pudimos calcular el envío. Revisá el código postal.", 400);
    if (!a.coordinar && !a.seleccionada) return err("Esa modalidad no está disponible para tu destino. Elegí la otra.", 409);
    const lugar = dest.modalidad === "sucursal"
      ? `Sucursal Andreani: ${dest.sucursal}`
      : `${dest.calle} ${dest.numero}${dest.piso ? `, ${dest.piso}` : ""}`;
    const donde = `${dest.localidad}, ${dest.provincia} (${dest.cp})`;
    envioCopia = {
      ...envioCopia,
      name: a.coordinar ? "Envío a coordinar (Andreani)" : `Envío por Andreani · ${MODALIDADES[dest.modalidad]}`,
      detalle: `${lugar} · ${donde}`,
      price: c.shipping_cost,
    };
    detalleEnvio = {
      modalidad: dest.modalidad,
      destino: dest,
      peso_g: a.paquete?.peso_g ?? null,
      medidas: a.paquete ? { alto: a.paquete.alto, ancho: a.paquete.ancho, largo: a.paquete.largo } : null,
      fuente: a.fuente,
      coordinar: a.coordinar,
      ref_carrier: a.seleccionada?.carrier || null,
      ref_precio: a.seleccionada?.ref ?? null,
      cobrado: c.shipping_cost,
      gratis: Boolean(a.gratis),
      demora: a.seleccionada?.demora || "",
    };
  } else if (c.envio?.kind === "zona" && !email) {
    return err("Dejanos tu mail para avisarte cuando salga tu envío.", 400);
  }

  const items = itemsParaMP(c.items, c.discount, c.cupon?.code);
  if (!items.length) return err("Con ese cupón el pedido queda sin cargo: mandanos el pedido por DM y lo coordinamos.", 400);

  // Un solo vencimiento para todo: reserva del cupón (base) y link de pago (Mercado Pago)
  const vence = new Date(Date.now() + MINUTOS_RESERVA * 60_000).toISOString();

  // Pedido + reserva del cupón, todo junto y atómico (respeta el límite aunque compren dos a la vez)
  const args = {
    p_vence: vence,
    p_customer_name: name, p_contact: contact, p_note: note, p_items: c.items,
    p_subtotal: c.subtotal, p_discount: c.discount, p_coupon_code: c.cupon?.code || null,
    p_shipping: envioCopia, p_shipping_cost: c.shipping_cost, p_total: c.total,
  };
  let { data: pedido, error } = await db.rpc("crear_pedido", { ...args, p_email: email || null, p_shipping_detail: detalleEnvio });
  // Si todavía no se corrió el schema nuevo (la función no tiene mail ni detalle de envío), se crea igual como antes
  if (error && /PGRST202|could not find the function/i.test(`${error.code} ${error.message}`) && !detalleEnvio) {
    ({ data: pedido, error } = await db.rpc("crear_pedido", args));
  }
  if (error) {
    if (/cupon_no_disponible/.test(error.message)) return err("Ese cupón ya no está disponible. Sacalo para seguir.", 409);
    // Otro compró antes la última unidad (la base bloquea la fila y verifica): nada se cobra
    if (/sin_stock/.test(error.message)) {
      const faltan = faltantesDe(error);
      refrescarCatalogo();
      return err(mensajeSinStock(faltan) || "Una de las piezas se quedó sin stock. Revisá el carrito.", 409, { sinStock: faltan });
    }
    console.error("crear_pedido:", error.message);
    return err("No pudimos guardar el pedido. Probá de nuevo.", 500);
  }
  const orderId = pedido.id;
  // Si alguna pieza tiene control de stock, la reserva ya la descontó: la tienda se actualiza al instante
  const { products } = await getCatalog();
  const conStock = c.items.some((it) => products.find((p) => String(p.id) === String(it.id))?.stock != null);
  if (conStock) refrescarCatalogo();

  const volver = `${site}/gracias?pedido=${orderId}`;
  const pref = {
    items,
    payer: { name, ...(email ? { email } : {}) },
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
    // el pedido queda cancelado así no reserva el cupón (y la base devuelve el stock reservado)
    await db.from("orders").update({ status: "cancelado", internal_notes: "No se pudo abrir Mercado Pago" }).eq("id", orderId);
    if (conStock) refrescarCatalogo();
    return err("Mercado Pago no respondió. Probá de nuevo en un ratito.", 502);
  }
  await db.from("orders").update({ mp_preference_id: j.id }).eq("id", orderId);
  return NextResponse.json({ url: j.init_point });
}
