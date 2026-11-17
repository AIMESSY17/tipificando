// Envío por Andreani cotizado con Zipnova: lógica PURA y compartida (sin claves, sin red).
// El servidor la usa para cobrar; el panel la usa para el simulador y los avisos.

export const PROVINCIAS = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy",
  "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz",
  "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

export const MODALIDADES = { domicilio: "A domicilio", sucursal: "A sucursal Andreani" };
// service_type.code de Zipnova → nuestra modalidad
export const SERVICIO = { standard_delivery: "domicilio", pickup_point: "sucursal" };

export const CFG_DEFECTO = {
  referencia: "andreani", // "andreani" = Andreani si está disponible, si no el más barato | "barato" = siempre el más barato
  factor: 1,              // multiplica el precio de referencia (para igualar el cotizador de Andreani)
  margen: 10,             // margen de seguridad, en %
  redondeo: 100,          // se redondea a la centena (0 = sin redondeo)
  gratis_desde: 0,        // envío gratis desde este monto (0 = no hay)
};

export const RESPALDO_DEFECTO = {}; // { "Córdoba": { domicilio: 12000, sucursal: 9000 }, ... }

const num = (v, d) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);

export function cfgEnvio(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    referencia: r.referencia === "barato" ? "barato" : "andreani",
    factor: Math.min(10, Math.max(0.1, num(r.factor, CFG_DEFECTO.factor))),
    margen: Math.min(200, Math.max(0, num(r.margen, CFG_DEFECTO.margen))),
    redondeo: Math.max(0, Math.round(num(r.redondeo, CFG_DEFECTO.redondeo))),
    gratis_desde: Math.max(0, Math.round(num(r.gratis_desde, CFG_DEFECTO.gratis_desde))),
  };
}

// Código postal: se queda con los 4 dígitos (también acepta el viejo "C1425ABC")
export const normalizarCp = (s) => (String(s || "").match(/\d{4}/) || [""])[0];

// ---- Piezas: peso y caja ----
export const tieneMedidas = (p) => Number(p?.weight_g) > 0 && Number(p?.height_cm) > 0 && Number(p?.width_cm) > 0 && Number(p?.length_cm) > 0;

// Una entrada por unidad, como pide Zipnova
export function unidadesZipnova(items, products) {
  const byId = new Map(products.flatMap((p) => [[String(p.id), p], [p.slug, p]]));
  const out = [];
  const faltan = [];
  for (const it of items) {
    const p = byId.get(String(it.id));
    if (!p || !tieneMedidas(p)) { faltan.push(it.name || String(it.id)); continue; }
    for (let k = 0; k < it.qty; k++)
      out.push({ sku: p.slug, weight: Math.round(p.weight_g), height: Number(p.height_cm), width: Number(p.width_cm), length: Number(p.length_cm), description: p.name });
  }
  return { unidades: out, faltan: [...new Set(faltan)] };
}

// Peso total y medidas aproximadas del paquete (las cajas se apilan: alto = suma, ancho y largo = el mayor)
export function resumenPaquete(unidades) {
  return {
    peso_g: unidades.reduce((s, u) => s + u.weight, 0),
    alto: Math.round(unidades.reduce((s, u) => s + u.height, 0)),
    ancho: Math.max(0, ...unidades.map((u) => u.width)),
    largo: Math.max(0, ...unidades.map((u) => u.length)),
  };
}

// ---- Elegir el precio de referencia y calcular el que ve el comprador ----
const esAndreani = (o) => /andreani/i.test(o?.carrier?.name || "");
const precioDeOpcion = (o) => Number(o?.amounts?.price_incl_tax);

// opciones = all_results de Zipnova. Devuelve { domicilio: {...}, sucursal: {...} } (solo las que existen)
export function referencias(opciones, cfg) {
  const out = {};
  for (const mod of Object.keys(MODALIDADES)) {
    const validas = (opciones || []).filter((o) => o?.selectable !== false && SERVICIO[o?.service_type?.code] === mod && precioDeOpcion(o) > 0);
    if (!validas.length) continue;
    const barato = (a) => a.reduce((m, o) => (precioDeOpcion(o) < precioDeOpcion(m) ? o : m));
    const andr = validas.filter(esAndreani);
    const ref = cfg.referencia === "andreani" && andr.length ? barato(andr) : barato(validas);
    out[mod] = {
      carrier: ref.carrier?.name || "",
      ref: Math.round(precioDeOpcion(ref)),
      min: ref.delivery_time?.min ?? null,
      max: ref.delivery_time?.max ?? null,
    };
  }
  return out;
}

export function redondear(x, paso) {
  return paso > 0 ? Math.round(x / paso) * paso : Math.round(x);
}

// Precio = referencia × factor × (1 + margen%) → redondeado
export const precioFinal = (ref, cfg) => redondear(ref * cfg.factor * (1 + cfg.margen / 100), cfg.redondeo);

export function demoraTexto(min, max) {
  if (!(max > 0) && !(min > 0)) return "";
  if (!(max > 0) || min === max) return `${min || max} ${(min || max) === 1 ? "día hábil" : "días hábiles"}`;
  return `${min > 0 ? min : 1} a ${max} días hábiles`;
}

// Copia compacta para el portapapeles del dueño
export function textoParaAndreani(o) {
  const d = o.shipping_detail || {};
  const dest = d.destino || {};
  const l = [
    `Pedido #${String(o.number || "").padStart(4, "0")}`,
    `Nombre: ${o.customer_name}`,
    o.email ? `Mail: ${o.email}` : null,
    o.contact ? `Teléfono / contacto: ${o.contact}` : null,
    d.modalidad === "sucursal"
      ? `Entrega: a sucursal Andreani — ${dest.sucursal || "(sin indicar)"}`
      : `Entrega: a domicilio — ${[dest.calle, dest.numero].filter(Boolean).join(" ")}${dest.piso ? `, piso/depto ${dest.piso}` : ""}`,
    `Localidad: ${dest.localidad || ""}, ${dest.provincia || ""} (CP ${dest.cp || ""})`,
    d.peso_g ? `Peso: ${d.peso_g} g` : null,
    d.medidas ? `Medidas: ${d.medidas.alto} × ${d.medidas.ancho} × ${d.medidas.largo} cm (alto × ancho × largo)` : null,
    o.note ? `Nota del cliente: ${o.note}` : null,
  ];
  return l.filter(Boolean).join("\n");
}

// Link de seguimiento de Andreani
export const linkSeguimiento = (n) => `https://www.andreani.com/#!/informacionEnvio/${encodeURIComponent(String(n || "").trim())}`;
