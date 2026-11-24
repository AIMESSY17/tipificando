import { NextResponse } from "next/server";
import { requireAdmin, esSoporte, faltantes } from "@/lib/server";
import { estadoClave } from "@/lib/credenciales";

// Aviso para soporte (tarjeta en Inicio): qué ajustes técnicos faltan. Solo admins de SOPORTE_EMAILS;
// al resto le contesta { soporte: false } sin ningún dato. Solo nombres de variables, nunca valores.
export const dynamic = "force-dynamic";

export async function GET(req) {
  const yo = await requireAdmin(req);
  if (!yo) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const headers = { "Cache-Control": "no-store" };
  if (!esSoporte(yo)) return NextResponse.json({ soporte: false }, { headers });
  const k = estadoClave();
  const faltan = [
    ...(k === "falta" ? ["CREDENCIALES_KEY"] : []),
    ...faltantes(),
  ];
  const invalidas = k === "invalida" ? ["CREDENCIALES_KEY (no es válida: 32 bytes en base64)"] : [];
  return NextResponse.json({ soporte: true, faltan, invalidas }, { headers });
}
