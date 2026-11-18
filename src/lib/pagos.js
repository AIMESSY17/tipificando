import "server-only";
import crypto from "node:crypto";
import { adminDb, sitio } from "@/lib/server";
import { money } from "@/lib/format";
import { numPedido } from "@/lib/precios";
import { linkSeguimiento } from "@/lib/envio";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUuid = (s) => UUID.test(String(s || ""));

// ---------- Firma de los avisos de Mercado Pago ----------
// https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
// Plantilla: "id:[data.id];request-id:[x-request-id];ts:[ts];" (se omite lo que no venga)
export function firmaValida({ secret, signature, requestId, dataId }) {
  if (!secret || !signature) return false;
  const parts = {};
  for (const p of String(signature).split(",")) {
    const i = p.indexOf("=");
    if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  if (!parts.ts || !parts.v1) return false;
  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${parts.ts};`;
  const h = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(h), b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Procesar un pago ----------
// Consulta el pago a Mercado Pago (nunca confía en lo que llega) y lo aplica al pedido en la base,
// de forma idempotente (función aplicar_pago). Lo usan el webhook y la página /gracias.
// Devuelve { ok, resultado, orderId, mpStatus, detalle, reintentar }
export async function procesarPago(paymentId, { pedidoEsperado } = {}) {
  const db = adminDb();
  const token = process.env.MP_ACCESS_TOKEN;
  if (!db || !token) return { ok: false, resultado: "error", detalle: { motivo: "falta configuración" } };

  let pay;
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (r.status === 404) return { ok: false, resultado: "ignorado", detalle: { motivo: "el pago no existe en esta cuenta" } };
    if (!r.ok) return { ok: false, resultado: "error", reintentar: true, detalle: { motivo: `MP respondió ${r.status}` } };
    pay = await r.json();
  } catch (e) {
    return { ok: false, resultado: "error", reintentar: true, detalle: { motivo: "MP no respondió", error: String(e?.message || e) } };
  }

  const orderId = pay.external_reference;
  const base = { orderId: esUuid(orderId) ? orderId : null, mpStatus: pay.status };
  const resumen = { monto: pay.transaction_amount, total_pagado: pay.transaction_details?.total_paid_amount, metodo: pay.payment_method_id, detalle_estado: pay.status_detail };
  if (!esUuid(orderId)) return { ...base, ok: false, resultado: "ignorado", detalle: { ...resumen, motivo: "el pago no es de un pedido de la tienda" } };
  if (pedidoEsperado && pedidoEsperado !== orderId) return { ...base, ok: false, resultado: "ignorado", detalle: { ...resumen, motivo: "el pago es de otro pedido" } };

  // Un pago aprobado tiene que cubrir el total del pedido, en pesos. Si no, no se marca como pagado
  // (queda registrado en mp_webhooks para revisarlo a mano).
  if (pay.status === "approved") {
    const { data: ord, error: ordErr } = await db.from("orders").select("total, shipping_cost").eq("id", orderId).maybeSingle();
    if (ordErr) return { ...base, ok: false, resultado: "error", reintentar: true, detalle: { ...resumen, motivo: ordErr.message } };
    if (!ord) return { ...base, ok: false, resultado: "ignorado", detalle: { ...resumen, motivo: "pedido_inexistente" } };
    // el envío puede venir aparte (shipping_amount) o ya sumado en transaction_amount.
    // Se suma como máximo el costo de envío que guardamos en el pedido, así un shipping_amount inflado no tapa un pago corto.
    const envioAparte = Math.min(Number(pay.shipping_amount || 0), Number(ord.shipping_cost || 0));
    const cobrado = Number(pay.transaction_amount || 0) + envioAparte;
    if (pay.currency_id !== "ARS" || cobrado + 1 < Number(ord.total || 0)) {
      return { ...base, ok: false, resultado: "ignorado", detalle: { ...resumen, moneda: pay.currency_id, total_pedido: ord.total, motivo: "el monto o la moneda del pago no coinciden con el pedido" } };
    }
  }

  const { data: res, error } = await db.rpc("aplicar_pago", { p_order: orderId, p_payment_id: String(pay.id), p_mp_status: String(pay.status) });
  if (error) return { ...base, ok: false, resultado: "error", reintentar: true, detalle: { ...resumen, motivo: error.message } };
  if (!res?.ok) return { ...base, ok: false, resultado: "ignorado", detalle: { ...resumen, ...res } };

  if (res.avisar) await avisarDueno(db, orderId).catch((e) => console.error("Mail al dueño:", e));
  return { ...base, ok: true, resultado: res.cambio ? "procesado" : "sin cambios", detalle: { ...resumen, ...res } };
}

// ---------- Mail al dueño cuando un pedido pasa a "pagado" ----------
// Resend (RESEND_API_KEY + MAIL_DUENO). Si no está configurado, no pasa nada.
export const mailsActivos = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_DUENO);
const remitente = () => process.env.MAIL_DESDE || "tipificado <onboarding@resend.dev>";

export async function enviarMail({ asunto, html, texto }) {
  if (!mailsActivos()) return { ok: false, motivo: "sin configurar" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remitente(),
      to: process.env.MAIL_DUENO.split(",").map((s) => s.trim()).filter(Boolean),
      subject: asunto,
      html,
      text: texto,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    return { ok: false, motivo: j.message || `Resend respondió ${r.status}` };
  }
  return { ok: true };
}

// Mail a un comprador (solo hace falta RESEND_API_KEY). Para llegar a cualquier casilla, MAIL_DESDE tiene que usar un dominio verificado en Resend.
export async function enviarMailA({ to, asunto, html, texto }) {
  if (!process.env.RESEND_API_KEY) return { ok: false, motivo: "Falta RESEND_API_KEY" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: remitente(), to: [to], subject: asunto, html, text: texto }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    return { ok: false, motivo: j.message || `Resend respondió ${r.status}` };
  }
  return { ok: true };
}

// Mail al comprador cuando el dueño carga el número de seguimiento de Andreani
export async function avisarEnvio(o, tracking) {
  const num = numPedido(o.number);
  const nombre = String(o.customer_name || "").split(" ")[0];
  const link = linkSeguimiento(tracking);
  const texto = `¡Hola${nombre ? " " + nombre : ""}! Tu pedido ${num} de tipificado ya salió 📦

Número de seguimiento Andreani: ${tracking}
Seguilo acá: ${link}

Cualquier duda, contestá este mail o escribinos por Instagram. ¡Gracias por elegirnos!`;
  const html = `<div style="background:#f6f0e4;padding:28px 16px;font-family:${MAIL_TEXTO};color:#26201c">
<div style="max-width:480px;margin:0 auto">
<div style="margin-bottom:18px">${logoMail()}</div>
<div style="background:#fff;border-radius:18px;padding:26px 24px;line-height:1.55;font-size:15px">
<h2 style="margin:0 0 8px;font-family:${MAIL_TITULO};font-weight:700;font-size:24px;letter-spacing:-0.5px">Tu pedido ya salió 📦</h2>
<p style="margin:0 0 18px;color:#6b625b">Hola${nombre ? " " + esc(nombre) : ""}, el pedido ${esc(num)} ya está en camino con Andreani.</p>
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b625b">Número de seguimiento</p>
<p style="margin:0 0 20px;font-family:${MAIL_TITULO};font-weight:700;font-size:20px">${esc(tracking)}</p>
<a href="${esc(link)}" style="display:inline-block;background:#26201c;color:#fff;padding:12px 20px;border-radius:99px;text-decoration:none;font-weight:600">Seguir mi envío</a>
<p style="margin:22px 0 0;font-size:13px;color:#6b625b">Si el link no abre, entrá a andreani.com y pegá el número en «Seguí tu envío».</p>
</div>
<p style="text-align:center;font-size:12px;color:#8a8077;margin-top:16px">Gracias por elegir cerámica hecha a mano ✦</p>
</div></div>`;
  return enviarMailA({ to: o.email, asunto: `Tu pedido ${num} ya salió 📦 · tipificado`, html, texto });
}

// Mails con la tipografía de la marca (máquina de escribir). Los clientes de mail no cargan fuentes
// web, así que van con respaldos del sistema; el logo va como imagen si hay URL pública del sitio.
const MAIL_TITULO = `'Courier Prime','Courier New',Courier,monospace`;
const MAIL_TEXTO = `'IBM Plex Mono',ui-monospace,Menlo,Consolas,'Courier New',monospace`;
const logoMail = () =>
  sitio()
    ? `<img src="${esc(sitio())}/marca/logo-oscuro.png" alt="tipificado…|" width="170" height="32" style="display:block;border:0;width:170px;height:auto">`
    : `<span style="font-family:${MAIL_TITULO};font-weight:700;font-size:26px;letter-spacing:-1px">tipificado…|</span>`;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function avisarDueno(db, orderId) {
  if (!mailsActivos()) return;
  const { data: o } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!o) return;
  const num = numPedido(o.number);
  const filas = (o.items || []).map((it) => `${it.qty} × ${it.name} (${it.color}) — ${money(it.price * it.qty)}`);
  const lineas = [
    ...filas,
    "",
    `Subtotal: ${money(o.subtotal ?? o.total)}`,
    o.discount > 0 ? `Cupón ${o.coupon_code}: − ${money(o.discount)}` : null,
    o.shipping ? `${o.shipping.name}: ${o.shipping_cost ? money(o.shipping_cost) : "—"}` : null,
    `Total cobrado: ${money(o.total)}`,
    "",
    `Cliente: ${o.customer_name}`,
    o.contact ? `Contacto: ${o.contact}` : null,
    o.email ? `Mail: ${o.email}` : null,
    o.shipping?.detalle ? `Entrega: ${o.shipping.detalle}` : null,
    o.note ? `Nota: ${o.note}` : null,
    o.payment_id ? `Operación de Mercado Pago: ${o.payment_id}` : null,
  ].filter((x) => x !== null);
  const panel = sitio() ? `${sitio()}/admin` : "";
  const texto = `¡Entró un pago! Pedido ${num}\n\n${lineas.join("\n")}${panel ? `\n\nVer en el panel: ${panel}` : ""}`;
  const html = `<div style="font-family:${MAIL_TEXTO};font-size:15px;line-height:1.5;color:#26201c;max-width:520px">
<div style="margin-bottom:14px">${logoMail()}</div>
<h2 style="margin:0 0 4px;font-family:${MAIL_TITULO};font-weight:700;letter-spacing:-0.5px">🛎️ Pedido ${esc(num)} pagado</h2>
<p style="margin:0 0 16px;color:#6b625b">${esc(o.customer_name)}${o.contact ? " · " + esc(o.contact) : ""}</p>
<p style="margin:0">${lineas.map((l) => (l === "" ? "<br>" : esc(l))).join("<br>")}</p>
${panel ? `<p style="margin-top:20px"><a href="${esc(panel)}" style="background:#26201c;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Abrir el panel</a></p>` : ""}
</div>`;
  const r = await enviarMail({ asunto: `🛎️ Pedido ${num} pagado · ${money(o.total)} · ${o.customer_name}`, html, texto });
  if (!r.ok) console.error("Mail al dueño no salió:", r.motivo);
}
