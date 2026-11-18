// Página de una hoja formal (server): textos de src/data/textos.js + datos del negocio de Ajustes.
import { HojaTexto } from "./Hoja";
import { HOJAS, BORRADOR } from "@/data/textos";
import { getCatalog } from "@/lib/server";

export const metaFormal = (clave) => ({
  title: `${HOJAS[clave].titulo} — tipificado…|`,
  description: HOJAS[clave].bajada,
  alternates: { canonical: `/${clave}` },
});

export async function PaginaFormal({ clave }) {
  const { settings } = await getCatalog();
  const { instagram, negocio_nombre, negocio_cuit, negocio_direccion } = settings;
  return (
    <main className="pagina-formal">
      <HojaTexto hoja={HOJAS[clave]} settings={{ instagram, negocio_nombre, negocio_cuit, negocio_direccion }} borrador={BORRADOR} />
    </main>
  );
}
