import "server-only";
import crypto from "node:crypto";
import { unstable_cache } from "next/cache";
import {
  MODALIDADES, PROVINCIAS, normalizarCp, unidadesZipnova, resumenPaquete, referencias, precioFinal, demoraTexto,
} from "@/lib/envio";

// Cotización de envíos con Zipnova. SOLO COTIZA: el envío real lo hace el dueño con su cuenta de Andreani.
// Todo pasa por el servidor; las claves viven en variables de entorno y nunca llegan al navegador.
const API = "https://api.zipnova.com.ar/v2/shipments/quote";
const TIMEOUT_MS = 6000;
const CACHE_SEG = 30 * 60;

const VARS = ["ZIPNOVA_KEY", "ZIPNOVA_SECRET", "ZIPNOVA_ACCOUNT_ID", "ZIPNOVA_ORIGIN_ID"];
export const zipnovaActivo = () => VARS.every((k) => String(process.env[k] || "").trim());

// ---------- Destino ----------
const limpio = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Lo mínimo para cotizar: provincia, localidad y CP. null si falta algo.
export function destinoParaCotizar(d) {
  if (!d || typeof d !== "object") return null;
  const provincia = PROVINCIAS.find((p) => p === d.provincia);
  const localidad = limpio(d.localidad, 60);
  const cp = normalizarCp(d.cp);
  if (!provincia || localidad.length < 2 || cp.length !== 4) return null;
  return { provincia, localidad, cp };
}

// Todo lo que hace falta para despachar. Devuelve { destino } o { error }.
export function validarEntrega(d) {
  const base = destinoParaCotizar(d);
  if (!base) return { error: "Completá provincia, localidad y código postal del envío." };
  const modalidad = d.modalidad === "sucursal" ? "sucursal" : d.modalidad === "domicilio" ? "domicilio" : null;
  if (!modalidad) return { error: "Elegí si lo querés a domicilio o a una sucursal de Andreani." };
  const destino = { ...base, modalidad };
  if (modalidad === "domicilio") {
    destino.calle = limpio(d.calle, 80);
    destino.numero = limpio(d.numero, 12);
    destino.piso = limpio(d.piso, 30);
    if (!destino.calle || !destino.numero) return { error: "Poné la calle y el número de tu domicilio." };
  } else {
    destino.sucursal = limpio(d.sucursal, 120);
    if (destino.sucursal.length < 3) return { error: "Contanos a qué sucursal Andreani te lo mandamos." };
  }
  return { destino };
}

// ---------- Llamada a Zipnova ----------
async function pedirZipnova({ unidades, declarado, destino }) {
  const auth = Buffer.from(`${process.env.ZIPNOVA_KEY}:${process.env.ZIPNOVA_SECRET}`).toString("base64");
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      account_id: Number(process.env.ZIPNOVA_ACCOUNT_ID),
      origin_id: Number(process.env.ZIPNOVA_ORIGIN_ID),
      declared_value: declarado,
      items: unidades,
      destination: { city: destino.localidad, state: destino.provincia, zipcode: destino.cp },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`Zipnova respondió ${r.status}`);
  const j = await r.json();
  if (!Array.isArray(j?.all_results)) throw new Error("Zipnova respondió sin opciones");
  // se guarda solo lo necesario (no el cuerpo entero)
  return j.all_results.map((o) => ({
    carrier: { name: o.carrier?.name },
    service_type: { code: o.service_type?.code },
    amounts: { price_incl_tax: o.amounts?.price_incl_tax },
    delivery_time: { min: o.delivery_time?.min, max: o.delivery_time?.max },
    selectable: o.selectable,
  }));
}

// Cache de 30 min por carrito + destino. Si falla, se TIRA el error (así no se guarda el fallo).
function opcionesConCache(args) {
  const clave = crypto.createHash("sha1").update(JSON.stringify([args.unidades, args.declarado, args.destino])).digest("hex");
  return unstable_cache(() => pedirZipnova(args), ["zipnova-quote-v1", clave], { revalidate: CACHE_SEG })();
}

// ---------- Cotización completa ----------
// items: [{ id, name, qty }] · products: del catálogo (con peso y medidas) · destino: { provincia, localidad, cp }
// cfg: ajustes de envío (cfgEnvio) · respaldo: tabla por provincia · subtotal: de las piezas · gratisSobre: monto después del cupón
// Devuelve { fuente: "zipnova" | "respaldo" | "coordinar", modalidades: { domicilio, sucursal }, paquete, motivo }
//   modalidades[x] = { precio, ref, carrier, min, max, demora }  (ref y carrier son privados: nunca van al navegador)
export async function cotizarAndreani({ items, products, destino, cfg, respaldo, subtotal, gratisSobre }) {
  const { unidades, faltan } = unidadesZipnova(items, products);
  const paquete = unidades.length ? resumenPaquete(unidades) : null;
  const gratis = cfg.gratis_desde > 0 && gratisSobre >= cfg.gratis_desde;
  const poner = (m) => (gratis ? { ...m, precio_normal: m.precio, precio: 0 } : m);
  let motivo = "";

  if (faltan.length) motivo = `Faltan peso o medidas en: ${faltan.join(", ")}`;
  else if (!zipnovaActivo()) motivo = "Zipnova no está configurado";
  else {
    try {
      const opciones = await opcionesConCache({ unidades, declarado: Math.round(subtotal), destino });
      const refs = referencias(opciones, cfg);
      const modalidades = {};
      for (const [mod, r] of Object.entries(refs)) {
        modalidades[mod] = poner({ precio: precioFinal(r.ref, cfg), ref: r.ref, carrier: r.carrier, min: r.min, max: r.max, demora: demoraTexto(r.min, r.max) });
      }
      if (Object.keys(modalidades).length) return { fuente: "zipnova", modalidades, paquete, opciones, gratis };
      motivo = "Zipnova no devolvió opciones para ese destino";
    } catch (e) {
      motivo = `Zipnova falló: ${String(e?.message || e)}`;
    }
  }

  // Zipnova no sirvió: tabla de respaldo por provincia (precios finales, sin factor ni margen)
  const fila = respaldo?.[destino.provincia] || {};
  const modalidades = {};
  for (const mod of Object.keys(MODALIDADES)) {
    const p = Math.round(Number(fila[mod]));
    if (p > 0) modalidades[mod] = poner({ precio: p, ref: p, carrier: "Tabla de respaldo", min: null, max: null, demora: "" });
  }
  if (Object.keys(modalidades).length) return { fuente: "respaldo", modalidades, paquete, motivo, gratis };
  return { fuente: "coordinar", modalidades: {}, paquete, motivo, gratis };
}

// Lo que ve el navegador: solo precio y demora (nada de referencias ni transportes)
export function publicoModalidades(modalidades) {
  return Object.fromEntries(Object.entries(modalidades).map(([k, m]) => [k, { precio: m.precio, demora: m.demora || "" }]));
}
