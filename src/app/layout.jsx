// Tipografía de máquina de escribir, coherente con el logo (autoalojada con fontsource):
// Courier Prime bold → palabra gigante, nombres y títulos · IBM Plex Mono → precios, botones y
// textos (la más legible en pantalla chica) · Caveat → solo un acento manuscrito en la ficha.
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource-variable/caveat/index.css";
import "./globals.css";

const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(site),
  title: "tipificado… | cerámica para la mesa, el escritorio y la casa",
  description: "Piezas de cerámica hechas a mano y a pedido, en el color que elijas. Tazas, platos, portamacetas, budineras y más.",
  openGraph: {
    title: "tipificado…|",
    description: "Cerámica hecha a mano, a pedido y en el color que elijas.",
    images: ["/og.jpg"],
    locale: "es_AR",
    type: "website",
  },
  icons: { icon: "/icon.svg" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2a2320",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
