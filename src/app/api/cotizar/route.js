import { NextResponse } from "next/server";
import { cotizar } from "@/lib/server";
import { textoCupon } from "@/lib/precios";
import { publicoModalidades } from "@/lib/zipnova";

// La pantalla "Pagar" pregunta acá cuánto sale todo (cupón y envío incluidos).
// Es solo para mostrar: al pagar, api/checkout vuelve a calcular todo.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const r = await cotizar(body);
  if (r.error) return NextResponse.json({ error: r.error, ...(r.sinStock ? { sinStock: r.sinStock } : {}) }, { status: r.status || 400 });
  return NextResponse.json({
    subtotal: r.subtotal,
    discount: r.discount,
    shipping_cost: r.shipping_cost,
    total: r.total,
    cupon: r.cupon ? { code: r.cupon.code, texto: textoCupon(r.cupon) } : null,
    cuponError: r.cuponError,
    envioId: r.envio?.id ?? null,
    // Envío por Andreani: solo lo que necesita la pantalla (precio y demora). Nada de referencias ni factores.
    andreani: r.auto
      ? { pendiente: r.auto.pendiente, coordinar: r.auto.coordinar, modalidad: r.auto.modalidad ?? null, modalidades: publicoModalidades(r.auto.modalidades), respaldo: r.auto.fuente === "respaldo", gratis: Boolean(r.auto.gratis) }
      : null,
  });
}
