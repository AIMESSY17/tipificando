import { NextResponse } from "next/server";
import { adminDb, requireAdmin, sitio, esSoporte } from "@/lib/server";
import { mailsActivos, enviarMail } from "@/lib/pagos";
import { zipnovaActivo } from "@/lib/zipnova";
import { credencialesMP, consultarCuenta, faltaParaCobrar, modoPruebaDe, textoCuenta, MODO_KEY } from "@/lib/credenciales";

// "Estado de la tienda" para Ajustes. Solo admins. NUNCA devuelve claves (ni cifradas, ni partes).
// Las credenciales de Mercado Pago salen del panel (Ajustes → Mercado Pago) o, de respaldo, de Vercel.
export const dynamic = "force-dynamic";

// Los admins de SOPORTE_EMAILS ven los textos técnicos; el dueño, textos simples (sin Vercel, variables ni README).
const DE = { panel: "cargado en el panel", vercel: "variable de Vercel" };
const DE_SIMPLE = { panel: "cargado en el panel", vercel: "configurado por tu desarrollador" };
const AVISAR = "Avisale a quien te hizo la tienda.";
const PROBLEMA_SIMPLE = {
  falta_clave: `hay credenciales guardadas, pero falta un ajuste técnico para leerlas. ${AVISAR}`,
  clave_invalida: `hay un ajuste técnico mal configurado y las credenciales guardadas no se pueden leer. ${AVISAR}`,
  otra_clave: "las credenciales guardadas ya no se pueden leer: volvé a cargarlas",
  formato: "las credenciales del panel están dañadas: volvé a cargarlas",
  no_descifra: "las credenciales del panel no se pueden leer: volvé a cargarlas",
};
const PROBLEMA = {
  falta_clave: "hay credenciales guardadas en el panel, pero falta CREDENCIALES_KEY en Vercel para leerlas",
  clave_invalida: "CREDENCIALES_KEY no es válida",
  otra_clave: "las credenciales del panel se guardaron con otra CREDENCIALES_KEY: volvé a cargarlas",
  formato: "las credenciales del panel están dañadas: volvé a cargarlas",
  no_descifra: "las credenciales del panel no se pueden leer: volvé a cargarlas",
};

const item = (ok, titulo, texto) => ({ ok, titulo, texto });

async function supabase(sop) {
  const db = adminDb();
  const T = "Base de datos (Supabase)";
  const simple = `La tienda no logra conectarse a su base de datos. ${AVISAR}`;
  if (!db) return item(false, T, sop ? "Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL." : simple);
  const { error } = await db.from("settings").select("key", { head: true, count: "exact" });
  if (error) return item(false, T, sop ? "No conecta: revisá la URL y la service role key." : simple);
  // las tablas y funciones nuevas (si no están, falta correr supabase/schema.sql actualizado)
  const [w, i, f] = await Promise.all([
    db.from("mp_webhooks").select("id", { head: true, count: "exact" }),
    db.from("checkout_intentos").select("id", { head: true, count: "exact" }),
    db.from("orders").select("coupon_counted, paid_at", { head: true, count: "exact" }),
  ]);
  if (w.error || i.error || f.error) return item(false, T, sop ? "Conecta, pero falta actualizar la base: corré supabase/schema.sql en el SQL Editor." : `Falta una actualización técnica de la base de datos. ${AVISAR}`);
  const s = await db.from("stock_movimientos").select("id", { head: true, count: "exact" });
  if (s.error) return item(false, T, sop ? "Conecta, pero falta el control de stock: corré supabase/stock.sql en el SQL Editor." : `Falta una actualización técnica para el control de stock. ${AVISAR}`);
  return item(true, T, "Conectada y al día (con control de stock).");
}

async function mercadoPago(c, prueba, sop) {
  const DEx = sop ? DE : DE_SIMPLE;
  const aviso = c.info.token.problema ? ` Ojo: ${(sop ? PROBLEMA : PROBLEMA_SIMPLE)[c.info.token.problema]}.` : "";
  if (!c.token) return { ...item(false, "Mercado Pago", `Falta el Access Token: cargalo en Ajustes → Mercado Pago. Los clientes compran por «Copiar pedido» o DM.${aviso}`), cuenta: null };
  const de = ` (${DEx[c.info.token.fuente]})`;
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

function webhook(c, sop) {
  const aviso = c.info.secreto.problema ? ` Ojo: ${(sop ? PROBLEMA : PROBLEMA_SIMPLE)[c.info.secreto.problema]}.` : "";
  return c.secreto
    ? item(true, "Aviso de pagos (webhook)", `Con clave secreta (${(sop ? DE : DE_SIMPLE)[c.info.secreto.fuente]}): solo se aceptan avisos firmados por Mercado Pago.${aviso}`)
    : item(false, "Aviso de pagos (webhook)", `Falta la clave secreta del webhook (Ajustes → Mercado Pago): sin ella se rechazan los avisos y los pedidos no pasan solos a «Pagado».${aviso}`);
}

function claveServidor(c, sop) {
  const t = "Credenciales desde el panel";
  const hayGuardadas = Boolean(c.info.token.guardado || c.info.secreto.guardado);
  if (c.info.tabla === false) {
    if (!sop) return c.token && c.secreto ? { ...item(null, t, `Falta un ajuste técnico para cargar Mercado Pago desde el panel, pero por ahora los cobros siguen andando. ${AVISAR}`), opcional: true } : item(false, t, `Falta un ajuste técnico para cargar Mercado Pago desde el panel. ${AVISAR}`);
    const txt = "Falta correr supabase/credenciales.sql en Supabase para cargar Mercado Pago desde el panel (ver README).";
    return c.token && c.secreto ? { ...item(null, t, txt + " Mientras tanto se usan las variables de Vercel."), opcional: true } : item(false, t, txt);
  }
  if (c.info.clave === "ok") return item(true, t, sop ? "CREDENCIALES_KEY configurada: lo que se carga en Ajustes → Mercado Pago se guarda cifrado." : "Lo que cargues en Ajustes → Mercado Pago se guarda cifrado.");
  if (c.info.clave === "invalida") return item(false, t, sop ? "CREDENCIALES_KEY no es válida (tienen que ser 32 bytes en base64). Ver README." : `Falta un ajuste técnico para guardar las claves. ${AVISAR}`);
  if (hayGuardadas) return item(false, t, sop ? "Falta CREDENCIALES_KEY en Vercel: las credenciales del panel no se pueden leer." : `Falta un ajuste técnico para guardar las claves: las que ya cargaste no se pueden leer. ${AVISAR}`);
  return { ...item(null, t, sop ? "Falta CREDENCIALES_KEY en Vercel: sin ella no se pueden cargar credenciales desde el panel (se usan las variables de Vercel)." : `Falta un ajuste técnico para guardar las claves. ${AVISAR}`), opcional: true };
}

function sitioOk(req, sop) {
  const s = sitio();
  const T = "Dirección del sitio";
  const simple = `La dirección de la tienda no está bien configurada. ${AVISAR}`;
  if (!s) return item(false, T, sop ? "Falta NEXT_PUBLIC_SITE_URL (la URL final de la tienda)." : simple);
  let u;
  try { u = new URL(s); } catch { return item(false, T, sop ? "NEXT_PUBLIC_SITE_URL no es una URL válida." : simple); }
  const local = /^(localhost|127\.0\.0\.1)$/.test(u.hostname);
  if (u.protocol !== "https:" && !local) return item(false, T, sop ? `${s} tiene que empezar con https://` : simple);
  if (u.pathname !== "/" || u.search) return item(false, T, sop ? "NEXT_PUBLIC_SITE_URL tiene que ser solo el dominio, sin rutas." : simple);
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
  if (host && host !== u.host) return item(false, T, sop ? `Está configurada como ${u.host} pero estás entrando por ${host}. Mercado Pago y los mails van a usar ${u.host}.` : simple);
  return item(true, T, `${s} (ahí vuelve el cliente después de pagar y llegan los avisos de pago).`);
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
  const sop = esSoporte(yo);
  const [db, mp, aviso, falta] = await Promise.all([supabase(sop), mercadoPago(cred, modo.activo, sop), ultimoAviso(), faltaParaCobrar()]);
  const checks = [
    db,
    mp,
    webhook(cred, sop),
    claveServidor(cred, sop),
    sitioOk(req, sop),
    zipnovaActivo()
      ? item(true, "Cotización de envíos (Zipnova)", "Configurada: el costo de Andreani se calcula solo al pagar.")
      : { ...item(null, "Cotización de envíos (Zipnova)", sop ? "Faltan ZIPNOVA_KEY, ZIPNOVA_SECRET, ZIPNOVA_ACCOUNT_ID o ZIPNOVA_ORIGIN_ID: el envío sale de la tabla de respaldo o «a coordinar»." : "No está activada (opcional): el envío sale de la tabla de respaldo o «a coordinar»."), opcional: true },
    mailsActivos()
      ? item(true, "Mail al dueño", `Cuando entra un pago, llega un mail a ${process.env.MAIL_DUENO}.`)
      : { ...item(null, "Mail al dueño", sop ? "Desactivado (opcional). Con RESEND_API_KEY y MAIL_DUENO llega un mail con cada pago. El aviso en el panel funciona igual." : "Desactivado (opcional). Si quisieras recibir un mail con cada pago, pedíselo a quien te hizo la tienda. El aviso en el panel funciona igual."), opcional: true },
  ];
  // Para el dueño, lo técnico (variables) no se nombra: solo se sabe QUE falta algo.
  const faltan = [...falta.vercel, ...falta.panel];
  return NextResponse.json({
    checks,
    soporte: sop,
    faltan: sop ? faltan : falta.panel,
    faltaTecnico: !sop && falta.vercel.length > 0,
    faltanVercel: sop ? falta.vercel : [],
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
