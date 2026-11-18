import { PaginaFormal, metaFormal } from "@/components/PaginaFormal";

export const metadata = metaFormal("cambios");
export const revalidate = 3600;

export default function Page() {
  return <PaginaFormal clave="cambios" />;
}
