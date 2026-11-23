import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/server";
import { avisarStock } from "@/lib/pagos";

// El panel llama acá después de guardar, para que la tienda se actualice al instante.
// De paso revisa los avisos de stock (por ejemplo, un pedido pasado a «Pagado» a mano).
export async function POST(req) {
  const email = await requireAdmin(req);
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  revalidateTag("catalogo");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  await avisarStock().catch((e) => console.error("Aviso de stock:", e));
  return NextResponse.json({ ok: true });
}
