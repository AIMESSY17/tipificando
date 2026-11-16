export const money = (n) => "$ " + Math.round(Number(n) || 0).toLocaleString("es-AR");

// ¿El fondo es claro? Para decidir si el texto va oscuro o claro.
export function isLight(hex = "#000000", umbral = 0.62) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > umbral;
}

// Texto del pedido para copiar o mandar por DM.
// t = cotización del servidor ({ subtotal, discount, shipping_cost, total }); envio = { name, detalle }
export function orderText(items, { name, contact, note, envio, cupon, t } = {}) {
  const lines = ["Pedido Tipificado"];
  if (name) lines.push("A nombre de: " + name);
  if (contact) lines.push("Contacto: " + contact);
  lines.push("");
  for (const it of items) lines.push(`${it.qty} x ${it.name} (${it.color}) — ${money(it.price * it.qty)}`);
  const subtotal = t?.subtotal ?? items.reduce((s, it) => s + it.price * it.qty, 0);
  lines.push("");
  if (t && (t.discount > 0 || t.shipping_cost > 0 || envio)) lines.push("Subtotal: " + money(subtotal));
  if (t?.discount > 0) lines.push(`Cupón ${cupon || ""}: − ${money(t.discount)}`.replace("  ", " "));
  if (envio) lines.push(`Entrega: ${envio.name}${t?.shipping_cost > 0 ? " — " + money(t.shipping_cost) : ""}`);
  lines.push("Total: " + money(t?.total ?? subtotal));
  if (note) lines.push("", "Nota: " + note);
  return lines.join("\n");
}

// Color "vivo": el mismo tono en oklch con un poco más de croma. En pantallas P3
// (iPhone, celulares nuevos) se ve más intenso; en las viejas el navegador lo ajusta.
export function vivo(hex = "#888888", boost = 1.14) {
  const h = hex.replace("#", "");
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const r = lin(parseInt(h.slice(0, 2), 16)), g = lin(parseInt(h.slice(2, 4), 16)), b = lin(parseInt(h.slice(4, 6), 16));
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.sqrt(A * A + B * B) * boost;
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return `oklch(${(L * 100).toFixed(2)}% ${C.toFixed(4)} ${H.toFixed(1)})`;
}
