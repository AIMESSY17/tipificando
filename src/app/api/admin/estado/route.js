import { NextResponse } from "next/server";
import { adminDb, requireAdmin, sitio } from "@/lib/server";
import { mailsActivos, enviarMail } from "@/lib/pagos";
import { zipnovaActivo } from "@/lib/zipnova";
import { credencialesMP, consultarCuenta, faltaParaCobrar, modoPruebaDe, textoCuenta, MODO_KEY } from "@/lib/credenciales";

// "Estado de la tienda" para Ajustes. Solo admins. NUNCA devuelve claves (ni cifradas, ni partes).
// Las credenciales de Mercado Pago salen del panel (Ajustes → Mercado Pago) o, de respaldo, de Vercel.
export const dynamic = "force-dynamic";

const DE = { panel: "cargado en el panel", vercel: "variable de Vercel" };
const PROBLEMA = {
  falta_clave: "hay credenciales guardadas en el panel, pero falta CREDENCIALES_KEY en Vercel para leerlas",
  clave_invalida: "CREDENCIALES_KEY no es válida",
  otra_clave: "las credenciales del panel se guardaron con otra CREDENCIALES_KEY: volvé a cargarlas",
  formato: "las credenciales del panel están dañadas: volvé a cargarlas",
  no_descifra: "las credenciales del panel no se pueden leer: volvé a cargarlas",
};

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
  const s = await db.from("stock_movimientos").select("id", { head: true, count: "exact" });
  if (s.error) return item(false, "Base de datos (Supabase)", "Conecta, pero falta el control de stock: corré supabase/stock.sql en el SQL Editor.");
  return item(true, "Base de datos (Supabase)", "Conectada y al día (con control de stock).");
}

async function mercadoPago(c, prueba) {
  const aviso = c.info.token.problema ? ` Ojo: ${PROBLEMA[c.info.token.problema]}.` : "";
  if (!c.token) return { ...item(false, "Mercado Pago", `Falta el Access Token: cargalo en Ajustes → Mercado Pago. Los clientes compran por «Copiar pedido» o DM.${aviso}`), cuenta: null };
  const de = ` (${DE[c.info.token.fuente]})`;
  const r = await consultarCuenta(c.token, 6000);
  if (!r.ok) {
    return { ...item(false, "Mercado Pago", r.invalido ? `Mercado Pago rechaza el Access Token${de}: cargá uno nuevo en Ajustes → Mercado Pago.${aviso}` : `${r.motivo}. Probá «Revisar» en un ratito.`), cuenta: null };
  }
  const cuenta = textoCuenta(r.cuenta);
  if (r.cuenta.prueba && !prueba) {
    return { ...item(false, "Mercado Pago", `Es una cuenta de PRUEBA (${cuenta})${de}: no cobra plata real y, con el modo prueba apagado, nadie va a poder pagar.${aviso}`), cuenta };
  }
  if (r.cuenta.prueba) return { ...item(true, "Mercado Pago", `Cuenta de PRUEBA (${cuenta})${de}: no cobra plata real.${aviso}`), cuenta };
  return { ...item(true, "Mercado Pago", `Cobra en la cuenta de ${cuenta}${de}. Confirmá que sea la del negocio.${aviso}`), cuenta };
}

function webhook(c) {
  const aviso = c.info.secreto.problema ? ` Ojo: ${PROBLEMA[c.info.secreto.problema]}.` : "";
  return c.secreto
    ? item(true, "Aviso de pagos (webhook)", `Con clave secreta (${DE[c.info.secreto.fuente]}): solo se aceptan avisos firmados por Mercado Pago.${aviso}`)
    : item(false, "Aviso de pagos (webhook)", `Falta la clave secreta del webhook (Ajustes → Mercado Pago): sin ella se rechazan los avisos y los pedidos no pasan solos a «Pagado».${aviso}`);
}

function claveServidor(c) {
  const t = "Credenciales desde el panel";
  const hayGuardadas = Boolean(c.info.token.guardado || c.info.secreto.guardado);
  if (c.info.tabla === false) {
    const txt = "Falta correr supabase/credenciales.sql en Supabase para cargar Mercado Pago desde el panel (ver README).";
    return c.token && c.secreto ? { ...item(null, t, txt + " Mientras tanto se usan las variables de Vercel."), opcional: true } : item(false, t, txt);
  }
  if (c.info.clave === "ok") return item(true, t, "CREDENCIALES_KEY configurada: lo que se carga en Ajustes → Mercado Pago se guarda cifrado.");
  if (c.info.clave === "invalida") return item(false, t, "CREDENCIALES_KEY no es válida (tienen que ser 32 bytes en base64). Ver README.");
  if (hayGuardadas) return item(false, t, "Falta CREDENCIALES_KEY en Vercel: las credenciales del panel no se pueden leer.");
  return { ...item(null, t, "Falta CREDENCIALES_KEY en Vercel: sin ella no se pueden cargar credenciales desde el panel (se usan las variables de Vercel)."), opcional: true };
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
  const cred = await credencialesMP({ fresco: true });
  const modo = modoPruebaDe({ [MODO_KEY]: cred.info.modoPanel });
  const [db, mp, aviso, falta] = await Promise.all([supabase(), mercadoPago(cred, modo.activo), ultimoAviso(), faltaParaCobrar()]);
  const checks = [
    db,
    mp,
    webhook(cred),
    claveServidor(cred),
    sitioOk(req),
    zipnovaActivo()
      ? item(true, "Cotización de envíos (Zipnova)", "Configurada: el costo de Andreani se calcula solo al pagar.")
      : { ...item(null, "Cotización de envíos (Zipnova)", "Faltan ZIPNOVA_KEY, ZIPNOVA_SECRET, ZIPNOVA_ACCOUNT_ID o ZIPNOVA_ORIGIN_ID: el envío sale de la tabla de respaldo o «a coordinar»."), opcional: true },
    mailsActivos()
      ? item(true, "Mail al dueño", `Cuando entra un pago, llega un mail a ${process.env.MAIL_DUENO}.`)
      : { ...item(null, "Mail al dueño", "Desactivado (opcional). Con RESEND_API_KEY y MAIL_DUENO llega un mail con cada pago. El aviso en el panel funciona igual."), opcional: true },
  ];
  const faltan = [...falta.vercel, ...falta.panel];
  return NextResponse.json({
    checks,
    faltan,
    faltanVercel: falta.vercel,
    faltanPanel: falta.panel,
    cobrando: faltan.length === 0 && mp.ok,
    prueba: modo.activo,
    modoFuente: modo.fuente,
    ultimoAviso: aviso,
    mails: mailsActivos(),
  }, { headers: { "Cache-Control": "no-store" } });
}

// Mail de prueba al dueño
export async function POST(req) {
  const yo = await requireAdmin(req);
  if (!yo) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const r = await enviarMail({
    asunto: "Prueba de avisos · tipificado",
    texto: "Si te llegó este mail, los avisos de pedidos pagados están funcionando.",
    html: "<p style=\"font-family:'IBM Plex Mono',ui-monospace,Menlo,Consolas,'Courier New',monospace\">Si te llegó este mail, los avisos de pedidos pagados están funcionando. ✓</p>",
  }).catch((e) => ({ ok: false, motivo: e.message }));
  if (!r.ok) return NextResponse.json({ error: "No salió el mail: " + r.motivo }, { status: 502 });
  return NextResponse.json({ ok: true });
}
