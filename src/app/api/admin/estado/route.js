import { NextResponse } from "next/server";
import { adminDb, requireAdmin, faltantes, modoPrueba, sitio } from "@/lib/server";
import { mailsActivos, enviarMail } from "@/lib/pagos";
import { zipnovaActivo } from "@/lib/zipnova";

// "Estado de la tienda" para Ajustes. Solo admins. NUNCA devuelve claves.
export const dynamic = "force-dynamic";

const item = (ok, titulo, texto) => ({ ok, titulo, texto });

async function supabase() {
  const db = adminDb();
  if (!db) return item(false, "Base de datos (Supabase)", "Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL.");
  const { error } = await db.from("settings").select("key", { head: true, count: "exact" });
  if (error) return item(false, "Base de datos (Supabase)", "No conecta: revisá la URL y la service role key.");
  // las tablas y funciones nuevas (si no están, falta correr supabase/schema.sql actualizado)
  const [w, i, f] = await Promise.all([
    db.from("mp_webhooks").select("id", { head: true, count: "exact" }),
    db.from("checkout_intentos").select("id", { head: true, count: "exact" }),
    db.from("orders").select("coupon_counted, paid_at", { head: true, count: "exact" }),
  ]);
  if (w.error || i.error || f.error) return item(false, "Base de datos (Supabase)", "Conecta, pero falta actualizar la base: corré supabase/schema.sql en el SQL Editor.");
  return item(true, "Base de datos (Supabase)", "Conectada y al día.");
}

async function mercadoPago() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return { ...item(false, "Mercado Pago", "Falta MP_ACCESS_TOKEN. Los clientes compran por «Copiar pedido» o DM."), cuenta: null };
  try {
    const r = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!r.ok) return { ...item(false, "Mercado Pago", r.status === 401 ? "El token no es válido: revisá que esté bien copiado." : `Mercado Pago respondió ${r.status}.`), cuenta: null };
    const j = await r.json();
    const nombre = [j.first_name, j.last_name].filter(Boolean).join(" ");
    const cuenta = [nombre, j.nickname && `(${j.nickname})`].filter(Boolean).join(" ") || j.email || `ID ${j.id}`;
    return { ...item(true, "Mercado Pago", `Cobra en la cuenta de ${cuenta}. Confirmá que sea la del negocio.`), cuenta };
  } catch {
    return { ...item(false, "Mercado Pago", "Mercado Pago no respondió. Probá «Revisar» en un ratito."), cuenta: null };
  }
}

function sitioOk(req) {
  const s = sitio();
  if (!s) return item(false, "Dirección del sitio", "Falta NEXT_PUBLIC_SITE_URL (la URL final de la tienda).");
  let u;
  try { u = new URL(s); } catch { return item(false, "Dirección del sitio", "NEXT_PUBLIC_SITE_URL no es una URL válida."); }
  const local = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
  if (u.protocol !== "https:" && !local) return item(false, "Dirección del sitio", `${s} tiene que empezar con https://`);
  if (u.pathname !== "/" || u.search) return item(false, "Dirección del sitio", "NEXT_PUBLIC_SITE_URL tiene que ser solo el dominio, sin rutas.");
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
  if (host && host !== u.host) return item(false, "Dirección del sitio", `Está configurada como ${u.host} pero estás entrando por ${host}. Mercado Pago y los mails van a usar ${u.host}.`);
  return item(true, "Dirección del sitio", `${s} (ahí vuelve el cliente después de pagar y llegan los avisos de pago).`);
}

async function ultimoAviso() {
  const db = adminDb();
  if (!db) return null;
  const { data } = await db.from("mp_webhooks").select("created_at, resultado").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

export async function GET(req) {
  const yo = await requireAdmin(req);
  if (!yo) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const [db, mp, aviso] = await Promise.all([supabase(), mercadoPago(), ultimoAviso()]);
  const checks = [
    db,
    mp,
    process.env.MP_WEBHOOK_SECRET
      ? item(true, "Aviso de pagos (webhook)", "Con clave secreta: solo se aceptan avisos firmados por Mercado Pago.")
      : item(false, "Aviso de pagos (webhook)", "Falta MP_WEBHOOK_SECRET: sin ella se rechazan los avisos y los pedidos no pasan solos a «Pagado»."),
    sitioOk(req),
    zipnovaActivo()
      ? item(true, "Cotización de envíos (Zipnova)", "Configurada: el costo de Andreani se calcula solo al pagar.")
      : { ...item(null, "Cotización de envíos (Zipnova)", "Faltan ZIPNOVA_KEY, ZIPNOVA_SECRET, ZIPNOVA_ACCOUNT_ID o ZIPNOVA_ORIGIN_ID: el envío sale de la tabla de respaldo o «a coordinar»."), opcional: true },
    mailsActivos()
      ? item(true, "Mail al dueño", `Cuando entra un pago, llega un mail a ${process.env.MAIL_DUENO}.`)
      : { ...item(null, "Mail al dueño", "Desactivado (opcional). Con RESEND_API_KEY y MAIL_DUENO llega un mail con cada pago. El aviso en el panel funciona igual."), opcional: true },
  ];
  const falta = faltantes();
  return NextResponse.json({
    checks,
    faltan: falta,
    cobrando: falta.length === 0 && mp.ok,
    prueba: modoPrueba(),
    ultimoAviso: aviso,
    mails: mailsActivos(),
  });
}

// Mail de prueba al dueño
export async function POST(req) {
  const yo = await requireAdmin(req);
  if (!yo) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const r = await enviarMail({
    asunto: "Prueba de avisos · tipificado",
    texto: "Si te llegó este mail, los avisos de pedidos pagados están funcionando.",
    html: "<p style=\"font-family:system-ui,sans-serif\">Si te llegó este mail, los avisos de pedidos pagados están funcionando. ✓</p>",
  }).catch((e) => ({ ok: false, motivo: e.message }));
  if (!r.ok) return NextResponse.json({ error: "No salió el mail: " + r.motivo }, { status: 502 });
  return NextResponse.json({ ok: true });
}
