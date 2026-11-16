import { NextResponse } from "next/server";
import { adminDb, requireAdmin } from "@/lib/server";

// Agregar o quitar administradores del panel. Solo lo puede hacer otro admin.
// Usa la service role key (servidor), porque la tabla admins no se puede escribir desde el navegador.
const mailOk = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export async function POST(req) {
  const yo = await requireAdmin(req);
  if (!yo) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { email: raw } = await req.json().catch(() => ({}));
  const email = String(raw || "").trim().toLowerCase();
  if (!mailOk(email)) return NextResponse.json({ error: "Ese mail no parece válido" }, { status: 400 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor (mirá Ajustes → Estado de la tienda)." }, { status: 503 });
  const { error } = await db.from("admins").upsert({ email });
  if (error) return NextResponse.json({ error: "No se pudo agregar" }, { status: 500 });
  // Le mandamos el mail de invitación (si ya tenía cuenta, entra igual con el link de siempre)
  const site = (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, "");
  const inv = await db.auth.admin.inviteUserByEmail(email, { redirectTo: site + "/admin" }).catch((e) => ({ error: e }));
  const aviso = inv?.error
    ? "Listo. Ya puede entrar: que abra el panel y ponga su mail."
    : "Listo. Le llegó un mail con el link para entrar.";
  return NextResponse.json({ ok: true, aviso });
}

export async function DELETE(req) {
  const yo = await requireAdmin(req);
  if (!yo) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { email: raw } = await req.json().catch(() => ({}));
  const email = String(raw || "").trim().toLowerCase();
  const db = adminDb();
  if (!db) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor (mirá Ajustes → Estado de la tienda)." }, { status: 503 });
  const { count } = await db.from("admins").select("email", { count: "exact", head: true });
  if ((count ?? 0) <= 1) return NextResponse.json({ error: "No se puede quitar el último administrador." }, { status: 400 });
  const { error } = await db.from("admins").delete().eq("email", email);
  if (error) return NextResponse.json({ error: "No se pudo quitar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
