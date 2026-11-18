import { redirect } from "next/navigation";
import { Tienda, piezaDe } from "@/components/Tienda";
import { getCatalog } from "@/lib/server";

// El catálogo está cacheado (se renueva cada 60 s y al instante cuando el admin guarda).
// Los links viejos /?pieza=<slug> (historias de Instagram) pasan al link propio /pieza/<slug>.
export default async function Home({ searchParams }) {
  const { pieza, demo, ...resto } = await searchParams;
  if (pieza) {
    const { products } = await getCatalog();
    const p = products[piezaDe(products, pieza)];
    const qs = new URLSearchParams(Object.entries(resto).filter(([, v]) => typeof v === "string")).toString();
    if (p) redirect(`/pieza/${encodeURIComponent(p.slug)}${qs ? "?" + qs : ""}`);
  }
  return <Tienda demo={demo} />;
}
