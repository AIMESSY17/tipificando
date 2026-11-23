// La tienda (server): carga el catálogo, saca lo privado y precarga la foto de la pieza del frente.
// La usan la home (/) y el link de cada pieza (/pieza/<slug>, que abre con la mesa ya en esa pieza).
import { preload } from "react-dom";
import Store from "./Store";
import { fotoChica } from "@/lib/fotos";
import { getCatalog, modoPrueba, pagosActivos } from "@/lib/server";
import { nivelStock, umbralDe } from "@/lib/stock";

export const piezaDe = (products, slug) => (slug ? products.findIndex((p) => p.slug === String(slug)) : -1);

// Para probar la mesa con muchas piezas: /?demo=30 repite el catálogo hasta 30 (solo en desarrollo
// o con DEMO_PIEZAS=1; las copias no se pueden comprar).
const conDemo = (products, demo) => {
  const n = Math.min(60, parseInt(demo, 10) || 0);
  if (!n || !products.length || (process.env.NODE_ENV === "production" && process.env.DEMO_PIEZAS !== "1")) return products;
  return Array.from({ length: n }, (_, i) => {
    const p = products[i % products.length];
    return i < products.length ? p : { ...p, id: `${p.id}-demo${i}`, slug: `${p.slug}-demo${i}`, name: `${p.name} ${Math.floor(i / products.length) + 1}` };
  });
};

export async function Tienda({ slug, demo }) {
  const catalogo = await getCatalog();
  const { settings: todos, envios } = catalogo;
  const products = conDemo(catalogo.products, demo);
  // el factor, el margen y la tabla de respaldo de envíos son privados: no viajan al navegador
  const { envio_cfg, envio_respaldo, ...settings } = todos; // eslint-disable-line no-unused-vars
  // lo mismo con el peso y las medidas de las cajas. Y el stock: el comprador NUNCA ve cuántas
  // unidades hay, solo si son las últimas o si no queda ninguna (stock_estado).
  const umbral = umbralDe(todos);
  const publicos = products.map(({ weight_g, height_cm, width_cm, length_cm, ship_estimado, stock, stock_aviso, ...p }) => ({ ...p, stock_estado: nivelStock(stock, umbral) })); // eslint-disable-line no-unused-vars
  const inicial = Math.max(0, piezaDe(publicos, slug));
  // la foto de la pieza del frente empieza a bajar con el HTML (celu: 800 px; compu: 1600 px)
  const p0 = publicos[inicial];
  if (p0?.image_url) {
    preload(fotoChica(p0.image_url), { as: "fetch", crossOrigin: "anonymous", fetchPriority: "high", media: "(max-width: 699.98px)" });
    preload(p0.image_url, { as: "fetch", crossOrigin: "anonymous", fetchPriority: "high", media: "(min-width: 700px)" });
  }
  return <Store products={publicos} settings={settings} envios={envios} inicial={inicial} modoPrueba={modoPrueba()} pagos={pagosActivos()} />;
}
