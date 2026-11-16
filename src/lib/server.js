import "server-only";
import crypto from "node:crypto";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { seedProducts, seedSettings, seedEnvios } from "@/data/seed";
import { armarItems, totales, normalizarCodigo, problemaCupon } from "@/lib/precios";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabase = Boolean(url && service);

// Variables sin las cuales no se cobra con Mercado Pago. Si falta alguna, la tienda
// sigue andando y se compra con «Copiar pedido» / «DM».
export const OBLIGATORIAS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MP_ACCESS_TOKEN",
  "MP_WEBHOOK_SECRET",
  "NEXT_PUBLIC_SITE_URL",
];
export const faltantes = () => OBLIGATORIAS.filter((k) => !String(process.env[k] || "").trim());
export const pagosActivos = () => faltantes().length === 0;

// La franja «Modo prueba» aparece solo si se pide explícitamente. Por defecto, todo es producción.
export const modoPrueba = () => process.env.MP_MODO === "prueba";

// URL del sitio, sin barra final
export const sitio = () => String(process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");

// Cliente con permisos de servidor. NUNCA se usa en el navegador.
export function adminDb() {
  if (!hasSupabase) return null;
  return createClient(url, service, { auth: { persistSession: false } });
}

const seed = () => ({ products: seedProducts, settings: seedSettings, envios: seedEnvios, source: "seed" });

async function leerCatalogo() {
  const db = adminDb();
  if (!db) return seed();
  const [{ data: products, error }, { data: rows }, envRes] = await Promise.all([
    db.from("products").select("*").eq("active", true).order("sort"),
    db.from("settings").select("*"),
    db.from("shipping_options").select("*").eq("active", true).order("sort"),
  ]);
  if (error) {
    console.error("Supabase:", error.message);
    return seed();
  }
  const settings = { ...seedSettings };
  for (const r of rows || []) settings[r.key] = r.value;
  // si todavía no se corrió el schema nuevo (sin tabla de envíos), se usan las opciones por defecto
  const envios = envRes.error ? seedEnvios : envRes.data?.length ? envRes.data : [seedEnvios[1]];
  return { products, settings, envios, source: "supabase" };
}

// Catálogo cacheado: se renueva solo cada 60 s y al instante cuando el panel guarda (tag "catalogo").
export const getCatalog = unstable_cache(leerCatalogo, ["catalogo-v2"], { revalidate: 60, tags: ["catalogo"] });

// Cotiza un carrito: precios, cupón y envío SIEMPRE calculados acá, en el servidor.
export async function cotizar(body = {}) {
  const { products, settings, envios } = await getCatalog();
  const vac = settings.vacaciones;
  if (vac?.activo) {
    const vuelta = vac.vuelta ? ` hasta el ${new Date(vac.vuelta + "T12:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" })}` : "";
    return { error: `Estamos de vacaciones${vuelta}. Las compras vuelven a abrir pronto.`, status: 403 };
  }
  const { items, error } = armarItems(products, body.items);
  if (error) return { error, status: 409 };
  if (!items.length) return { error: "El carrito está vacío", status: 400 };
  const envio = envios.find((e) => String(e.id) === String(body.shippingId)) || envios[0] || null;

  let cupon = null, cuponError = null;
  const code = normalizarCodigo(body.coupon);
  if (code) {
    const db = adminDb();
    let row = null;
    if (db) {
      const { data } = await db.from("coupons").select("*").eq("code", code).maybeSingle();
      row = data;
    }
    cuponError = problemaCupon(row);
    if (!cuponError) cupon = row;
  }
  return { items, envio, cupon, cuponError, code, ...totales(items, cupon, envio) };
}

// Verifica que el token del navegador sea de un admin cargado en la tabla admins.
// Usa la clave pública + el token del usuario (RLS), así funciona aunque falte la service role key
// y el panel puede mostrar qué falta.
export async function requireAdmin(req) {
  if (!url || !anon) return null;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const db = createClient(url, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await db.auth.getUser(token);
  const email = data?.user?.email;
  if (!email) return null;
  const { data: row } = await db.from("admins").select("email").eq("email", email.toLowerCase()).maybeSingle();
  return row ? email : null;
}

// Huella de la IP (no guardamos la IP en sí). La usan el checkout y el webhook.
export function huellaIp(req) {
  // x-real-ip lo fija la plataforma (Vercel); el primer valor de x-forwarded-for lo puede inventar el cliente
  const ip = req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") || "").split(",").pop().trim() || "desconocida";
  return crypto.createHash("sha256").update("tipificado:" + ip).digest("hex").slice(0, 32);
}
