// Stock: lógica pura y compartida (servidor, tienda y panel).
// REGLA: el comprador nunca ve cuántas unidades hay. Al navegador de la tienda solo le llega
// `stock_estado`: null (sin control o hay de sobra) | "hay" | "ultimas" | "sin".

export const UMBRAL_DEF = 10;

// «últimas unidades» cuando quedan MENOS de este número (Ajustes → stock_umbral)
export function umbralDe(settings) {
  const n = parseInt(settings?.stock_umbral, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100000) : UMBRAL_DEF;
}

// null = sin control · "sin" · "ultimas" · "hay"
export function nivelStock(stock, umbral = UMBRAL_DEF) {
  if (stock == null || stock === "") return null;
  const s = Number(stock);
  if (!Number.isFinite(s)) return null;
  if (s <= 0) return "sin";
  if (s < umbral) return "ultimas";
  return "hay";
}

export const sinStock = (p) => p?.stock_estado === "sin";

// Textos de la tienda (sin números)
export const TXT_ULTIMAS = "últimas unidades…";
export const TXT_SIN = "sin stock…";
export const TXT_NO_HAY_MAS = "No hay más unidades disponibles de esta pieza.";

// Mensaje cuando al pagar (o al cotizar) una pieza ya no alcanza. faltan = [{ id, name, agotada }]
export function mensajeSinStock(faltan = []) {
  if (!faltan.length) return "";
  const nombres = faltan.map((f) => `«${f.name}»`);
  const lista = nombres.length > 1 ? nombres.slice(0, -1).join(", ") + " y " + nombres.at(-1) : nombres[0];
  if (faltan.every((f) => f.agotada)) {
    return `${lista} ${faltan.length > 1 ? "se quedaron" : "se quedó"} sin stock: alguien ${faltan.length > 1 ? "las" : "la"} compró antes. Sacá${faltan.length > 1 ? "las" : "la"} del carrito para seguir; lo demás queda guardado.`;
  }
  return `No hay más unidades disponibles de ${lista}. Bajá la cantidad o sacá${faltan.length > 1 ? "las" : "la"} del carrito para seguir.`;
}

// Etiquetas del panel (el dueño SÍ ve los números)
export const INSIGNIA_STOCK = {
  hay: ["ins-stock-hay", "Hay stock"],
  ultimas: ["ins-stock-ultimas", "Últimas unidades"],
  sin: ["ins-stock-sin", "Sin stock"],
  null: ["ins-stock-libre", "Sin control"],
};
