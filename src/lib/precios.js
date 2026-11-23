// Precios, cupones y envíos: lógica pura y compartida.
// El SERVIDOR la usa para cobrar (api/checkout, api/cotizar); el navegador solo para mostrar.
import { mensajeSinStock } from "./stock";

export const VENTA = ["pagado", "en produccion", "enviado", "entregado"]; // estados que cuentan como venta
export const ESTADOS = ["pendiente", "pagado", "en produccion", "enviado", "entregado", "cancelado", "rechazado", "devuelto"];

// Cuánto dura la reserva del cupón Y el link de pago de Mercado Pago. Es la ÚNICA fuente: el checkout
// calcula un solo vencimiento con esta constante y se lo pasa a la base (crear_pedido) y a MP (expiration_date_to).
export const MINUTOS_RESERVA = 30;

const n = (v) => Math.round(Number(v) || 0);

// Precio que se cobra: el de oferta si tiene uno válido (menor al normal)
export const precioDe = (p) => {
  const s = n(p?.sale_price), base = n(p?.price);
  return s > 0 && s < base ? s : base;
};
export const enOferta = (p) => precioDe(p) < n(p?.price);
export const colorAgotado = (p, nombre) => (p?.colors || []).some((c) => c.name === nombre && c.agotado);
export const piezaAgotada = (p) => (p?.colors?.length || 0) > 0 && p.colors.every((c) => c.agotado);
export const primerColorLibre = (p) => (p?.colors || []).find((c) => !c.agotado) || null;

export const normalizarCodigo = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);

// Hoy en Argentina, como "AAAA-MM-DD"
export const hoyAR = (d = new Date()) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);

// null si el cupón sirve; si no, el motivo en castellano
export function problemaCupon(c, hoy = new Date()) {
  if (!c || !c.active) return "Ese cupón no existe o ya no está activo.";
  if (c.expires_at && String(c.expires_at).slice(0, 10) < hoyAR(hoy)) return "Ese cupón ya venció.";
  if (c.max_uses != null && c.max_uses !== "" && n(c.uses) >= n(c.max_uses)) return "Ese cupón ya se usó todas las veces posibles.";
  return null;
}

export function descuentoDe(c, subtotal) {
  if (!c) return 0;
  const d = c.kind === "monto" ? n(c.value) : Math.round((subtotal * n(c.value)) / 100);
  return Math.max(0, Math.min(subtotal, d));
}

export const textoCupon = (c) => (c.kind === "monto" ? `$ ${n(c.value).toLocaleString("es-AR")} de descuento` : `${n(c.value)}% de descuento`);

// ---------- Envíos ----------
export const costoEnvio = (op) => (op?.kind === "zona" ? Math.max(0, n(op.price)) : 0);
export function nombreEnvio(op) {
  if (!op) return "A coordinar";
  if (op.kind === "retiro") return op.name || "Retiro en el taller";
  if (op.kind === "coordinar") return op.name || "Envío a coordinar";
  if (op.kind === "andreani") return op.name || "Envío por Andreani";
  return `Envío a ${op.name || "tu zona"}`;
}
export function detalleEnvio(op) {
  if (!op) return "";
  if (op.kind === "retiro") return [op.address || "Te pasamos la dirección por mensaje", op.hours].filter(Boolean).join(" · ");
  if (op.kind === "coordinar") return "Lo coordinamos por mensaje una vez confirmado el pedido";
  if (op.kind === "andreani") return "Se calcula con tu código postal";
  return "A domicilio";
}
// Copia que se guarda en el pedido (por si después se edita la opción)
export const copiaEnvio = (op) => (op ? { id: op.id, kind: op.kind, name: nombreEnvio(op), detalle: detalleEnvio(op), price: costoEnvio(op) } : null);

// ---------- Carrito ----------
// Arma los ítems con los precios de la base (nunca los del navegador).
// Si una pieza con control de stock no alcanza (sumando todos sus colores), devuelve
// sinStock = [{ id, name, agotada }] — sin decir cuántas quedan. La verificación definitiva
// (con la fila bloqueada) la hace la base al crear el pedido.
export function armarItems(products, reqItems) {
  const r = armarItemsSinStock(products, reqItems);
  if (r.error) return r;
  const porPieza = new Map();
  for (const it of r.items) porPieza.set(String(it.id), (porPieza.get(String(it.id)) || 0) + it.qty);
  const sinStock = [];
  for (const [id, qty] of porPieza) {
    const p = products.find((x) => String(x.id) === id);
    if (p && p.stock != null && Number(p.stock) < qty) sinStock.push({ id: p.id, name: p.name, agotada: Number(p.stock) <= 0 });
  }
  if (sinStock.length) return { error: mensajeSinStock(sinStock), sinStock };
  return r;
}

function armarItemsSinStock(products, reqItems) {
  const byId = new Map(products.flatMap((p) => [[String(p.id), p], [p.slug, p]]));
  const items = [];
  for (const it of (Array.isArray(reqItems) ? reqItems : []).slice(0, 30)) {
    const p = byId.get(String(it.id));
    if (!p) return { error: "Una de las piezas ya no está disponible. Revisá el carrito." };
    const qty = Math.max(1, Math.min(20, parseInt(it.qty, 10) || 1));
    const colores = p.colors || [];
    const color = colores.some((c) => c.name === it.color) ? it.color : primerColorLibre(p)?.name || "Único";
    if (colorAgotado(p, color)) return { error: `${p.name} en ${color.toLowerCase()} está agotada. Elegí otro color.` };
    const item = { id: p.id, name: p.name, color, qty, price: precioDe(p) };
    if (enOferta(p)) item.list_price = n(p.price);
    items.push(item);
  }
  return { items };
}

export function totales(items, cupon, envio) {
  const subtotal = items.reduce((s, it) => s + n(it.price) * n(it.qty), 0);
  const discount = descuentoDe(cupon, subtotal);
  const shipping_cost = costoEnvio(envio);
  return { subtotal, discount, shipping_cost, total: subtotal - discount + shipping_cost };
}

// Ítems para Mercado Pago con el descuento repartido proporcionalmente entre las líneas
// (redondeado a pesos; la diferencia de redondeo se ajusta en la última línea).
// MP necesita unit_price × quantity exacto: si el neto de una línea no se divide justo por la
// cantidad, se parte en dos ítems (n−1 unidades a un precio y 1 unidad con el resto).
// La suma de los ítems da SIEMPRE subtotal − descuento.
export function itemsParaMP(items, discount = 0, cupon = "") {
  const lineas = items.map((it) => ({ it, bruto: n(it.price) * n(it.qty) }));
  const subtotal = lineas.reduce((s, l) => s + l.bruto, 0);
  const d = Math.max(0, Math.min(subtotal, n(discount)));
  const objetivo = subtotal - d;
  for (const l of lineas) l.neto = subtotal > 0 ? Math.round((l.bruto * objetivo) / subtotal) : 0;
  if (lineas.length) {
    const dif = objetivo - lineas.reduce((s, l) => s + l.neto, 0);
    const ult = lineas[lineas.length - 1];
    // si por algún caso raro la última quedara negativa, el ajuste va a la línea más grande
    const destino = ult.neto + dif >= 0 ? ult : lineas.reduce((a, b) => (b.neto > a.neto ? b : a));
    destino.neto += dif;
  }
  const out = [];
  for (const { it, neto } of lineas) {
    const qty = n(it.qty);
    const base = {
      id: String(it.id),
      title: `${it.name} (${it.color})`.slice(0, 250),
      currency_id: "ARS",
      ...(d > 0 && cupon ? { description: `Precio con cupón ${cupon}` } : {}),
    };
    const unit = Math.floor(neto / qty);
    const resto = neto - unit * qty;
    if (resto === 0) out.push({ ...base, quantity: qty, unit_price: unit });
    else {
      if (qty > 1) out.push({ ...base, quantity: qty - 1, unit_price: unit });
      out.push({ ...base, quantity: 1, unit_price: unit + resto });
    }
  }
  return out.filter((x) => x.unit_price > 0 && x.quantity > 0);
}

// Número de pedido corto: #0012
export const numPedido = (num) => (num ? "#" + String(num).padStart(4, "0") : "#—");
