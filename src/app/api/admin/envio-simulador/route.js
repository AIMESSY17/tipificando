import { NextResponse } from "next/server";
import { getCatalog, requireAdmin } from "@/lib/server";
import { cfgEnvio, referencias, precioFinal, SERVICIO, MODALIDADES, unidadesZipnova, resumenPaquete } from "@/lib/envio";
import { cotizarAndreani, destinoParaCotizar, zipnovaActivo } from "@/lib/zipnova";

// Simulador del panel (Envíos): muestra lo que devuelve Zipnova por transporte, el precio de referencia
// y el precio final que vería el comprador. Solo admins. Usa los ajustes SIN guardar que mande el panel.
export const dynamic = "force-dynamic";
const err = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req) {
  const yo = await requireAdmin(req);
  if (!yo) return err("No autorizado", 401);
  const body = await req.json().catch(() => ({}));
  const destino = destinoParaCotizar(body.destino);
  if (!destino) return err("Completá provincia, localidad y código postal (4 números).");
  if (!zipnovaActivo()) return err("Faltan las variables ZIPNOVA_* en Vercel (o en .env.local).");

  const { products, settings } = await getCatalog();
  const cfg = cfgEnvio(body.cfg || settings.envio_cfg);
  const pedidas = (Array.isArray(body.items) ? body.items : []).slice(0, 20)
    .map((it) => ({ id: it.id, qty: Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1)) }));
  const items = pedidas.map((it) => {
    const p = products.find((x) => String(x.id) === String(it.id));
    return { ...it, name: p?.name || "", price: p?.sale_price > 0 && p.sale_price < p.price ? p.sale_price : p?.price || 0 };
  });
  if (!items.length) return err("Elegí al menos una pieza.");
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);

  const { faltan } = unidadesZipnova(items, products);
  if (faltan.length) return err(`Falta peso o medidas de: ${faltan.join(", ")}. Cargalos en Piezas.`);

  // sin gratis_desde: el simulador muestra el precio "normal"
  const r = await cotizarAndreani({ items, products, destino, cfg: { ...cfg, gratis_desde: 0 }, respaldo: {}, subtotal, gratisSobre: 0 });
  if (r.fuente !== "zipnova") return err(r.motivo || "Zipnova no devolvió opciones para ese destino.", 502);

  const refs = referencias(r.opciones, cfg);
  const transportes = r.opciones
    .filter((o) => SERVICIO[o.service_type?.code])
    .map((o) => ({
      transporte: o.carrier?.name || "?",
      modalidad: MODALIDADES[SERVICIO[o.service_type.code]],
      precio: Math.round(Number(o.amounts?.price_incl_tax) || 0),
      min: o.delivery_time?.min ?? null, max: o.delivery_time?.max ?? null,
      seleccionable: o.selectable !== false,
    }))
    .sort((a, b) => a.precio - b.precio);
  const final = Object.fromEntries(Object.entries(refs).map(([m, x]) => [m, { ...x, label: MODALIDADES[m], final: precioFinal(x.ref, cfg) }]));
  return NextResponse.json({ transportes, referencias: final, paquete: resumenPaquete(unidadesZipnova(items, products).unidades), subtotal });
}
