import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { adminDb, requireAdmin, refrescarCatalogo, sitio } from "@/lib/server";
import {
  credencialesMP, olvidarCredenciales, cifrar, consultarCuenta, textoCuenta, modoPruebaDe, estadoClave, sinTabla,
  TOKEN, SECRETO, MODO_KEY,
} from "@/lib/credenciales";

// Ajustes → Mercado Pago. Solo admins.
// · GET: estado (de dónde salen las credenciales, últimos 4, cuenta conectada, modo prueba, registro).
// · POST { accion: "guardar" | "probar" | "modo" }.
// NUNCA devuelve un valor (ni cifrado), ni lo loguea, ni lo pone en un mensaje de error.
export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };
const no = (error, status = 400, extra) => NextResponse.json({ error, ...extra }, { status, headers: SIN_CACHE });
const si = (j) => NextResponse.json(j, { headers: SIN_CACHE });

// ---------- Límite de intentos (por admin; en la base, con respaldo en memoria) ----------
const LIMITES = { guardar: [6, 15], probar: [15, 10], modo: [20, 10] }; // [intentos, minutos]
const memoria = new Map();
async function permitir(accion, email) {
  const [max, minutos] = LIMITES[accion];
  const clave = `panel-mp:${accion}:` + crypto.createHash("sha256").update("tipificado:" + email.toLowerCase()).digest("hex").slice(0, 32);
  const db = adminDb();
  if (db) {
    const { data, error } = await db.rpc("permitir_intento", { p_ip: clave, p_max: max, p_minutos: minutos });
    if (!error) return data !== false;
  }
  const ahora = Date.now();
  const lista = (memoria.get(clave) || []).filter((t) => t > ahora - minutos * 60_000);
  if (lista.length >= max) return false;
  lista.push(ahora);
  memoria.set(clave, lista);
  return true;
}

// ---------- Reautenticación: la contraseña del panel, verificada con Supabase ----------
// Se abre una sesión aparte solo para comprobarla y se cierra en el acto (scope local: la sesión
// del panel sigue igual). "ok" | "incorrecta" | "limite" | "error"
async function confirmarClave(email, clave) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return "error";
  if (!clave) return "incorrecta";
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: clave });
    if (error) {
      if (error.status === 429) return "limite";
      return error.status === 400 || /invalid|credentials|not confirmed/i.test(error.message || "") ? "incorrecta" : "error";
    }
    const ok = String(data?.user?.email || "").toLowerCase() === email.toLowerCase();
    await sb.auth.signOut({ scope: "local" }).catch(() => {});
    return ok ? "ok" : "incorrecta";
  } catch {
    return "error";
  }
}

// ---------- Formato (antes de gastar un intento) ----------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function problemaToken(t) {
  if (/\s/.test(t)) return "El Access Token no lleva espacios. Copialo de nuevo.";
  if (/^(APP_USR|TEST)-/.test(t) && UUID.test(t.replace(/^(APP_USR|TEST)-/, ""))) return "Eso es la Public Key. Pegá el Access Token (está en la misma pantalla de Credenciales de producción).";
  if (!/^(APP_USR|TEST)-[A-Za-z0-9_-]{20,300}$/.test(t)) return "Eso no parece un Access Token: empieza con APP_USR- (Credenciales de producción).";
  return null;
}
function problemaSecreto(s) {
  if (/\s/.test(s)) return "La clave secreta no lleva espacios. Copiala de nuevo.";
  if (/^(APP_USR|TEST)-/.test(s)) return "Eso parece un Access Token. Acá va la clave secreta del webhook (Webhooks → Clave secreta).";
  if (s.length < 16 || s.length > 300 || !/^[\x21-\x7e]+$/.test(s)) return "Eso no parece la clave secreta del webhook. Copiala de nuevo desde Webhooks → Clave secreta.";
  return null;
}

// ---------- Estado para la pantalla (sin valores) ----------
async function estado({ consulta } = {}) {
  const c = await credencialesMP({ fresco: true });
  const db = adminDb();
  let cuenta = null;
  let conexion = null; // ok | invalido | sin_respuesta | null (sin token)
  if (c.token) {
    const r = consulta || (await consultarCuenta(c.token, 6000));
    if (r.ok) {
      cuenta = r.cuenta;
      conexion = "ok";
    } else conexion = r.invalido ? "invalido" : "sin_respuesta";
  }
  // Si no se pudo consultar ahora, se muestra lo que se guardó al cargarlo
  const g = c.info.token.fuente === "panel" ? c.info.token.guardado : null;
  if (!cuenta && g) cuenta = { id: g.cuenta_id, nombre: g.cuenta_nombre, apodo: g.cuenta_apodo, prueba: g.es_prueba, pais: null, guardada: true };

  let cambios = [];
  let ultimoAviso = null;
  if (db) {
    const [ca, av] = await Promise.all([
      c.info.tabla
        ? db.from("credenciales_cambios").select("id, proveedor, accion, ultimos4, cuenta_nombre, es_prueba, hecho_por, hecho_en").order("hecho_en", { ascending: false }).order("id", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] }),
      db.from("mp_webhooks").select("created_at, resultado, firma_ok").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    cambios = ca.data || [];
    ultimoAviso = av.data || null;
  }
  const s = sitio();
  return {
    clave: c.info.clave,
    tabla: c.info.tabla,
    errorBase: c.info.errorBase,
    token: c.info.token,
    secreto: c.info.secreto,
    cuenta: cuenta && { ...cuenta, texto: textoCuenta(cuenta) },
    conexion,
    modo: modoPruebaDe({ [MODO_KEY]: c.info.modoPanel }),
    webhookUrl: s ? `${s}/api/mp-webhook` : null,
    ultimoAviso,
    cambios,
  };
}

export async function GET(req) {
  const yo = await requireAdmin(req);
  if (!yo) return no("No autorizado", 401);
  try {
    return si(await estado());
  } catch {
    return no("No se pudo consultar el estado de Mercado Pago.", 500);
  }
}

export async function POST(req) {
  const yo = await requireAdmin(req);
  if (!yo) return no("No autorizado", 401);
  let body;
  try {
    const txt = await req.text();
    if (txt.length > 4000) return no("Pedido inválido", 413);
    body = JSON.parse(txt);
  } catch {
    return no("Pedido inválido");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return no("Pedido inválido");
  try {
    if (body.accion === "guardar") return await guardar(yo, body);
    if (body.accion === "probar") return await probar(yo);
    if (body.accion === "modo") return await cambiarModo(yo, body);
    return no("Acción desconocida");
  } catch (e) {
    // sin detalles: un error de la base puede traer la fila (con el valor cifrado) en el detalle
    console.error("api/admin/mercadopago:", body.accion, e?.code || e?.name || "error");
    return no("Algo salió mal. No se guardó nada. Probá de nuevo.", 500);
  }
}

async function guardar(yo, body) {
  const k = estadoClave();
  if (k !== "ok") {
    return no(k === "falta"
      ? "Falta la clave del servidor (CREDENCIALES_KEY en Vercel): sin ella no se pueden guardar credenciales."
      : "La clave del servidor (CREDENCIALES_KEY) no es válida: tienen que ser 32 bytes en base64.", 503);
  }
  const db = adminDb();
  if (!db) return no("Falta conectar la base de datos.", 503);
  const actual = await credencialesMP({ fresco: true });
  if (actual.info.tabla === false) return no("Falta correr supabase/credenciales.sql en Supabase (ver README).", 503);

  const token = String(body.token ?? "").trim();
  const secreto = String(body.secreto ?? "").trim();
  if (!token && !secreto) return no("Pegá el Access Token, la clave secreta del webhook o las dos.");
  const pt = token && problemaToken(token);
  if (pt) return no(pt);
  const ps = secreto && problemaSecreto(secreto);
  if (ps) return no(ps);

  if (!(await permitir("guardar", yo))) return no("Hiciste muchos intentos seguidos. Esperá 15 minutos y probá de nuevo.", 429);
  const r = await confirmarClave(yo, String(body.clave ?? ""));
  if (r === "incorrecta") return no("La contraseña no es correcta. No se guardó nada.", 403, { clave: true });
  if (r === "limite") return no("Supabase frenó los intentos de contraseña. Esperá unos minutos y probá de nuevo.", 429);
  if (r !== "ok") return no("No pudimos confirmar tu contraseña. Probá de nuevo.", 502);

  // El token se prueba con Mercado Pago ANTES de guardarlo
  let cuenta = null;
  if (token) {
    const v = await consultarCuenta(token);
    if (!v.ok) {
      return v.invalido
        ? no("Mercado Pago dice que ese Access Token no es válido. Revisá que sea el de producción y que esté completo. No se guardó nada.", 400, { campo: "token" })
        : no(`${v.motivo}: no pudimos comprobar el token, así que no se guardó. Probá de nuevo en un ratito.`, 502);
    }
    cuenta = v.cuenta;
    if (cuenta.pais && cuenta.pais !== "MLA") return no(`Esa cuenta es de Mercado Pago ${cuenta.pais}, no de Argentina: la tienda cobra en pesos. No se guardó.`, 400, { campo: "token" });
    if (cuenta.prueba && body.confirmarPrueba !== true) {
      return si({ necesitaConfirmar: "prueba", cuenta: { texto: textoCuenta(cuenta), apodo: cuenta.apodo, id: cuenta.id } });
    }
  }

  const ahora = new Date().toISOString();
  const filas = [];
  if (token) filas.push({
    proveedor: TOKEN, valor_cifrado: cifrar(TOKEN, token), ultimos4: token.slice(-4),
    cuenta_nombre: cuenta.nombre, cuenta_apodo: cuenta.apodo, cuenta_id: cuenta.id, es_prueba: cuenta.prueba,
    actualizado_por: yo, actualizado_en: ahora,
  });
  if (secreto) filas.push({
    proveedor: SECRETO, valor_cifrado: cifrar(SECRETO, secreto), ultimos4: secreto.slice(-4),
    cuenta_nombre: null, cuenta_apodo: null, cuenta_id: null, es_prueba: false,
    actualizado_por: yo, actualizado_en: ahora,
  });
  const { error } = await db.from("credenciales").upsert(filas, { onConflict: "proveedor" });
  olvidarCredenciales();
  if (error) {
    console.error("credenciales (guardar):", error.code || "error"); // sin message/details: pueden traer la fila
    return no(sinTabla(error) ? "Falta correr supabase/credenciales.sql en Supabase (ver README)." : "No se pudo guardar. Probá de nuevo.", 500);
  }
  const habia = { [TOKEN]: actual.info.token.guardado, [SECRETO]: actual.info.secreto.guardado };
  const { error: logErr } = await db.from("credenciales_cambios").insert(filas.map((f) => ({
    proveedor: f.proveedor,
    accion: habia[f.proveedor] ? "cambiado" : "cargado",
    ultimos4: f.ultimos4,
    cuenta_nombre: f.proveedor === TOKEN ? textoCuenta(cuenta) : null,
    es_prueba: f.proveedor === TOKEN ? cuenta.prueba : null,
    hecho_por: yo,
  })));
  if (logErr) console.error("credenciales_cambios:", logErr.code || "error");
  refrescarCatalogo(); // la tienda muestra (o no) «Pagar con Mercado Pago»
  return si({ ok: true, guardados: filas.map((f) => f.proveedor), estado: await estado() });
}

async function probar(yo) {
  if (!(await permitir("probar", yo))) return no("Muchas pruebas seguidas. Esperá unos minutos.", 429);
  const c = await credencialesMP({ fresco: true });
  if (!c.token) return no("Todavía no hay un Access Token cargado.");
  const v = await consultarCuenta(c.token);
  // Si la cuenta cambió de nombre (o de tipo), se actualizan los datos guardados (nunca el valor)
  const g = c.info.token.fuente === "panel" ? c.info.token.guardado : null;
  if (v.ok && g && (g.cuenta_id !== v.cuenta.id || g.cuenta_nombre !== v.cuenta.nombre || g.cuenta_apodo !== v.cuenta.apodo || g.es_prueba !== v.cuenta.prueba)) {
    const { error } = await adminDb().from("credenciales")
      .update({ cuenta_id: v.cuenta.id, cuenta_nombre: v.cuenta.nombre, cuenta_apodo: v.cuenta.apodo, es_prueba: v.cuenta.prueba })
      .eq("proveedor", TOKEN);
    if (error) console.error("credenciales (probar):", error.code || "error");
    olvidarCredenciales();
  }
  return si({ ok: v.ok, estado: await estado({ consulta: v }) });
}

async function cambiarModo(yo, body) {
  if (!(await permitir("modo", yo))) return no("Muchos cambios seguidos. Esperá unos minutos.", 429);
  const m = modoPruebaDe({});
  if (m.fuente === "vercel") return no(`Lo fija la variable MP_MODO de Vercel («${m.entorno}»). Borrala en Vercel y hacé Redeploy para manejarlo desde acá.`, 409);
  const db = adminDb();
  if (!db) return no("Falta conectar la base de datos.", 503);
  const activo = body.activo === true;
  const { error } = await db.from("settings").upsert({ key: MODO_KEY, value: activo });
  if (error) return no("No se pudo guardar. Probá de nuevo.", 500);
  const { error: logErr } = await db.from("credenciales_cambios").insert({ proveedor: MODO_KEY, accion: activo ? "activado" : "desactivado", hecho_por: yo });
  if (logErr && !sinTabla(logErr)) console.error("credenciales_cambios:", logErr.code || "error");
  olvidarCredenciales();
  refrescarCatalogo(); // la franja «Modo prueba» de la tienda
  return si({ ok: true, estado: await estado() });
}
