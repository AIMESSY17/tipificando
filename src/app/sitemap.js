import { getCatalog } from "@/lib/server";

const base = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

export const revalidate = 3600;

export default async function sitemap() {
  const { products } = await getCatalog();
  const s = base();
  const ahora = new Date();
  return [
    { url: `${s}/`, lastModified: ahora, changeFrequency: "weekly", priority: 1 },
    ...products.map((p) => ({
      url: `${s}/pieza/${encodeURIComponent(p.slug)}`,
      lastModified: p.created_at ? new Date(p.created_at) : ahora,
      changeFrequency: "monthly",
      priority: 0.8,
    })),
    ...["preguntas", "cambios", "envios", "terminos"].map((h) => ({ url: `${s}/${h}`, lastModified: ahora, changeFrequency: "yearly", priority: 0.3 })),
    { url: `${s}/arrepentimiento`, lastModified: ahora, changeFrequency: "yearly", priority: 0.2 },
  ];
}
