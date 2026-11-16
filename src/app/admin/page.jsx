import Admin from "./Admin";
import "./admin.css";

// El panel se puede instalar en el celu como app ("Agregar a pantalla de inicio")
export const metadata = {
  title: "Panel · tipificado…|",
  robots: { index: false },
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "tipificado admin", statusBarStyle: "default" },
  icons: { icon: "/admin-icon-192.png", apple: "/admin-apple-touch-icon.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f2f2f7",
};

export default function Page() {
  return <Admin />;
}
