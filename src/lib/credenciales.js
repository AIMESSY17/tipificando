import "server-only";
import crypto from "node:crypto";
import { adminDb, faltantes } from "@/lib/server";

// =====================================================================
//  Credenciales de Mercado Pago cargadas desde el panel (Ajustes → Mercado Pago).
//  · Se guardan CIFRADAS (AES-256-GCM) en la tabla `credenciales` (supabase/credenciales.sql),
//    con la clave del servidor CREDENCIALES_KEY (32 bytes en base64, solo en Vercel).
//  · El servidor usa primero las de la base y, si no hay (o no se pueden leer), las variables
//    de entorno MP_ACCESS_TOKEN / MP_WEBHOOK_SECRET. Así nada se rompe en la transición.
//  · Lo descifrado queda SOLO en la memoria de esta instancia unos minutos (nunca en el cache de
//    Next, que en Vercel es compartido y persistente). Al guardar se invalida.
//  · Nada de acá se loguea ni viaja al navegador: las rutas devuelven solo `info` (metadatos).
// =====================================================================

export const TOKEN = "mp_access_token";
export const SECRETO = "mp_webhook_secret";
export const PROVEEDORES = [TOKEN, SECRETO];
export const VARIABLE = { [TOKEN]: "MP_ACCESS_TOKEN", [SECRETO]: "MP_WEBHOOK_SECRET" };
export const NOMBRE = { [TOKEN]: "Access Token", [SECRETO]: "Clave secreta del webhook" };
export const MODO_KEY = "mp_modo_prueba"; // en settings (true = modo prueba encendido desde el panel)
export const MP_API = "https://api.mercadopago.com";

// ---------- Clave del servidor ----------
function claveServidor() {
  const raw = String(process.env.CREDENCIALES_KEY || "").trim();
  if (!raw) return { estado: "falta" };
  if (!/^[A-Za-z0-9+/_-]{43}=?$/.test(raw)) return { estado: "invalida" };
  const key = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (key.length !== 32) return { estado: "invalida" };
  // huella corta de la clave (no revela nada de ella): sirve para avisar si se cambió la clave
  const kid = crypto.createHash("sha256").update("tipificado:credenciales:kid:").update(key).digest("hex").slice(0, 8);
  return { estado: "ok", key, kid };
}
// "ok" | "falta" | "invalida"
export const estadoClave = () => claveServidor().estado;

// El nombre de la credencial va como dato autenticado: un valor cifrado no se puede mover a otra fila.
const aad = (proveedor) => Buffer.from("tipificado:credenciales:" + proveedor);

export function cifrar(proveedor, texto) {
  const k = claveServidor();
  if (k.estado !== "ok") throw new Error("Falta CREDENCIALES_KEY o no es válida");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", k.key, iv);
  c.setAAD(aad(proveedor));
  const ct = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
  return ["v1", k.kid, iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

// { valor } o { problema: falta_clave | clave_invalida | otra_clave | formato | no_descifra }
export function descifrar(proveedor, cifrado) {
  const k = claveServidor();
  if (k.estado !== "ok") return { problema: k.estado === "falta" ? "falta_clave" : "clave_invalida" };
  const [v, kid, iv, tag, ct] = String(cifrado || "").split(".");
  if (v !== "v1" || !iv || !tag || !ct) return { problema: "formato" };
  if (kid !== k.kid) return { problema: "otra_clave" };
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", k.key, Buffer.from(iv, "base64url"), { authTagLength: 16 });
    d.setAAD(aad(proveedor));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    const valor = Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
    return valor ? { valor } : { problema: "no_descifra" };
  } catch {
    return { problema: "no_descifra" };
  }
}

// Si todavía no se corrió supabase/credenciales.sql
export const sinTabla = (e) => /PGRST205|42P01|does not exist|could not find the table/i.test(`${e?.code} ${e?.message}`);

// ---------- Lectura (con cache en memoria) ----------
const TTL = 3 * 60_000;
let memo = null; // { hasta, promesa }

export function olvidarCredenciales() {
  memo = null;
}

// { token, secreto, info }. `token` y `secreto` son los valores en texto plano: NUNCA se devuelven,
// se loguean ni se pasan a un componente. `info` son solo metadatos (fuente, últimos 4, fechas…).
export function credencialesMP({ fresco = false } = {}) {
  if (!fresco && memo && memo.hasta > Date.now()) return memo.promesa;
  const promesa = cargar();
  const m = { hasta: Date.now() + TTL, promesa };
  memo = m;
  promesa.then(
    (v) => { if (v.info.errorBase && memo === m) m.hasta = Date.now() + 15_000; }, // si la base falló, se reintenta pronto
    () => { if (memo === m) memo = null; },
  );
  return promesa;
}

const meta = (f) => ({
  ultimos4: f.ultimos4 || "",
  actualizado_por: f.actualizado_por || "",
  actualizado_en: f.actualizado_en || null,
  cuenta_nombre: f.cuenta_nombre || null,
  cuenta_apodo: f.cuenta_apodo || null,
  cuenta_id: f.cuenta_id || null,
  es_prueba: Boolean(f.es_prueba),
});

async function cargar() {
  const db = adminDb();
  let filas = [];
  let tabla = null; // null = sin base; false = falta correr credenciales.sql
  let errorBase = false;
  let modoPanel = false;
  if (db) {
    tabla = true;
    const [c, m] = await Promise.all([
      db.from("credenciales")
        .select("proveedor, valor_cifrado, ultimos4, cuenta_nombre, cuenta_apodo, cuenta_id, es_prueba, actualizado_por, actualizado_en")
        .in("proveedor", PROVEEDORES),
      db.from("settings").select("value").eq("key", MODO_KEY).maybeSingle(),
    ]);
    if (c.error) {
      if (sinTabla(c.error)) tabla = false;
      else {
        errorBase = true;
        console.error("credenciales: no se pudieron leer de la base:", c.error.code || "", c.error.message || "");
      }
    } else filas = c.data || [];
    modoPanel = m.data?.value === true;
  }
  const out = { token: null, secreto: null, info: { tabla, clave: estadoClave(), modoPanel, errorBase } };
  for (const p of PROVEEDORES) {
    const fila = filas.find((f) => f.proveedor === p);
    const env = String(process.env[VARIABLE[p]] || "").trim();
    let valor = null, fuente = null, problema = null;
    if (fila) {
      const d = descifrar(p, fila.valor_cifrado);
      if (d.valor) {
        valor = d.valor;
        fuente = "panel";
      } else problema = d.problema;
    }
    if (!valor && env) {
      valor = env;
      fuente = "vercel";
    }
    const k = p === TOKEN ? "token" : "secreto";
    out[k] = valor;
    out.info[k] = { fuente, problema, entorno: Boolean(env), guardado: fila ? meta(fila) : null };
  }
  return out;
}

// ---------- Modo prueba ----------
// La variable MP_MODO, si existe, gana sobre el interruptor del panel (y el panel lo indica).
export function modoPruebaDe(settings) {
  const env = String(process.env.MP_MODO || "").trim().toLowerCase();
  if (env) return { activo: env === "prueba", fuente: "vercel", entorno: env };
  return { activo: settings?.[MODO_KEY] === true, fuente: "panel" };
}

export async function modoPrueba() {
  const { info } = await credencialesMP();
  return modoPruebaDe({ [MODO_KEY]: info.modoPanel }).activo;
}

// ---------- ¿Se puede cobrar? ----------
export async function faltaParaCobrar() {
  const c = await credencialesMP();
  return {
    vercel: faltantes(),
    panel: [!c.token && "Access Token de Mercado Pago", !c.secreto && "Clave secreta del webhook"].filter(Boolean),
  };
}

export async function pagosActivos() {
  if (faltantes().length) return false;
  const c = await credencialesMP();
  return Boolean(c.token && c.secreto);
}

// ---------- Llamadas a Mercado Pago con el token vigente ----------
// Si MP responde 401 con el token que esta instancia tiene en memoria, relee la base una vez
// (por si se cambió desde el panel en otra instancia) y reintenta. Tira error si no hay token.
export async function llamarMP(path, { method = "GET", body, headers = {}, timeout = 10000 } = {}) {
  let c = await credencialesMP();
  for (let intento = 0; ; intento++) {
    if (!c.token) throw new Error("Falta el Access Token de Mercado Pago");
    const r = await fetch(MP_API + path, {
      method,
      headers: { Authorization: `Bearer ${c.token}`, ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
    if (r.status === 401 && intento === 0) {
      const f = await credencialesMP({ fresco: true });
      if (f.token && f.token !== c.token) {
        c = f;
        continue;
      }
    }
    return r;
  }
}

// ---------- Cuenta de un token (/users/me) ----------
// Usuario de prueba: nickname TESTUSER…, etiqueta test_user, mail @testuser.com o credencial TEST-.
export function cuentaDe(j, token = "") {
  const nombre = [j.first_name, j.last_name].map((s) => String(s || "").trim()).filter(Boolean).join(" ");
  const apodo = String(j.nickname || "").trim();
  const tags = Array.isArray(j.tags) ? j.tags.map(String) : [];
  const prueba = String(token).startsWith("TEST-") || tags.includes("test_user") || /^TEST/i.test(apodo) || /@testuser\.com$/i.test(String(j.email || ""));
  return { id: j.id != null ? String(j.id) : null, nombre: nombre || null, apodo: apodo || null, prueba, pais: j.site_id || null };
}

// { ok: true, cuenta } | { ok: false, invalido: true } | { ok: false, motivo }
export async function consultarCuenta(token, timeout = 8000) {
  try {
    const r = await fetch(MP_API + "/users/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
    if (r.status === 401 || r.status === 403) return { ok: false, invalido: true };
    if (!r.ok) return { ok: false, motivo: `Mercado Pago respondió ${r.status}` };
    return { ok: true, cuenta: cuentaDe(await r.json(), token) };
  } catch {
    return { ok: false, motivo: "Mercado Pago no respondió" };
  }
}

export const textoCuenta = (c) => (c ? [c.nombre, c.apodo && (c.nombre ? `(${c.apodo})` : c.apodo)].filter(Boolean).join(" ") || (c.id ? `ID ${c.id}` : "") : "");
