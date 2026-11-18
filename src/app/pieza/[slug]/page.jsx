import { redirect } from "next/navigation";
import { Tienda, piezaDe } from "@/components/Tienda";
import { getCatalog } from "@/lib/server";

// Link propio de cada pieza: abre la tienda con la mesa ya en esa pieza (sin giro inicial).
// Si la pieza no existe (o la borraron), vuelve a la home.
const buscar = async (params) => {
  const { slug } = await params;
  const { products } = await getCatalog();
  return products[piezaDe(products, decodeURIComponent(slug))] || null;
};

export async function generateMetadata({ params }) {
  const p = await buscar(params);
  if (!p) return {};
  const titulo = `${p.name} — tipificado…|`;
  const desc = (p.description || "Cerámica hecha a mano, a pedido y en el color que elijas.").slice(0, 200);
  const url = `/pieza/${encodeURIComponent(p.slug)}`;
  // la imagen la genera opengraph-image.jsx (Next la agrega sola a openGraph y twitter)
  return {
    title: titulo,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: titulo, description: desc, url, locale: "es_AR", type: "website", siteName: "tipificado…|" },
    twitter: { card: "summary_large_image", title: titulo, description: desc },
  };
}

export default async function Pieza({ params, searchParams }) {
  const p = await buscar(params);
  if (!p) redirect("/");
  const { demo } = await searchParams;
  return <Tienda slug={p.slug} demo={demo} />;
}
