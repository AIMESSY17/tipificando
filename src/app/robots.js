const base = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

// El panel (/admin), la API y la página de gracias no se indexan.
export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/gracias"] },
    sitemap: `${base()}/sitemap.xml`,
    host: base(),
  };
}
