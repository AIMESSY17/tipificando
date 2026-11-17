import Store from "@/components/Store";
import { getCatalog, modoPrueba, pagosActivos } from "@/lib/server";

// El catálogo está cacheado (se renueva cada 60 s y al instante cuando el admin guarda).
// La página lee ?pieza=<slug> para abrir directo en esa pieza (links para historias de Instagram).
const piezaDe = (products, slug) => (slug ? products.findIndex((p) => p.slug === String(slug)) : -1);

export async function generateMetadata({ searchParams }) {
  const { pieza } = await searchParams;
  if (!pieza) return {};
  const { products } = await getCatalog();
  const p = products[piezaDe(products, pieza)];
  if (!p) return {};
  const titulo = `${p.name} · tipificado…|`;
  const desc = (p.description || "Cerámica hecha a mano, a pedido y en el color que elijas.").slice(0, 200);
  const url = `/?pieza=${encodeURIComponent(p.slug)}`;
  return {
    title: titulo,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: titulo, description: desc, url, images: p.image_url ? [{ url: p.image_url, alt: p.name }] : ["/og.jpg"], locale: "es_AR", type: "website" },
    twitter: { card: "summary_large_image", title: titulo, description: desc, images: p.image_url ? [p.image_url] : ["/og.jpg"] },
  };
}

export default async function Home({ searchParams }) {
  const { pieza } = await searchParams;
  const { products, settings: todos, envios } = await getCatalog();
  // el factor, el margen y la tabla de respaldo de envíos son privados: no viajan al navegador
  const { envio_cfg, envio_respaldo, ...settings } = todos; // eslint-disable-line no-unused-vars
  // lo mismo con el peso y las medidas de las cajas
  const publicos = products.map(({ weight_g, height_cm, width_cm, length_cm, ship_estimado, ...p }) => p); // eslint-disable-line no-unused-vars
  const inicial = Math.max(0, piezaDe(publicos, pieza));
  return <Store products={publicos} settings={settings} envios={envios} inicial={inicial} modoPrueba={modoPrueba()} pagos={pagosActivos()} />;
}
