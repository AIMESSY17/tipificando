import { NextResponse } from "next/server";
import { cotizar } from "@/lib/server";
import { textoCupon } from "@/lib/precios";

// La pantalla "Pagar" pregunta acá cuánto sale todo (cupón y envío incluidos).
// Es solo para mostrar: al pagar, api/checkout vuelve a calcular todo.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const r = await cotizar(body);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status || 400 });
  return NextResponse.json({
    subtotal: r.subtotal,
    discount: r.discount,
    shipping_cost: r.shipping_cost,
    total: r.total,
    cupon: r.cupon ? { code: r.cupon.code, texto: textoCupon(r.cupon) } : null,
    cuponError: r.cuponError,
    envioId: r.envio?.id ?? null,
  });
}
