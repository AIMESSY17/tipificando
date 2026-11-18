import { PaginaFormal, metaFormal } from "@/components/PaginaFormal";

export const metadata = metaFormal("envios");
export const revalidate = 3600;

export default function Page() {
  return <PaginaFormal clave="envios" />;
}
