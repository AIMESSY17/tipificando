"use client";
import { useState } from "react";

export default function Form() {
  const [code, setCode] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/arrepentimiento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setCode(j.code);
    else setErr(j.error || "No se pudo enviar. Escribinos por Instagram.");
  };
  if (code)
    return (
      <p>
        Recibimos tu solicitud. Tu código es <b style={{ fontFamily: "var(--f-mono)" }}>{code}</b>. Te contactamos en menos de 24 h.
      </p>
    );
  return (
    <form onSubmit={send}>
      <input name="nombre" placeholder="Nombre y apellido" required />
      <input name="contacto" placeholder="Mail o @ de Instagram" required />
      <input name="pedido" placeholder="Qué compraste y cuándo" required />
      <textarea name="mensaje" rows={3} placeholder="Comentario (opcional)" />
      {err && <p className="error">{err}</p>}
      <button className="btn-oscuro" disabled={busy}>{busy ? "Enviando…" : "Enviar solicitud"}</button>
    </form>
  );
}
