import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/server";

// El panel llama acá después de guardar, para que la tienda se actualice al instante.
export async function POST(req) {
  const email = await requireAdmin(req);
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  revalidateTag("catalogo");
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  return NextResponse.json({ ok: true });
}
