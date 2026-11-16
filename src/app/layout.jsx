import "@fontsource-variable/fraunces/soft.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
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
