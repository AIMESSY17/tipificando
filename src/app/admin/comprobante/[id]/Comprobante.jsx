"use client";
import { useEffect, useState } from "react";
import { browserDb } from "@/lib/supabase-browser";
import { money } from "@/lib/format";
import { numPedido } from "@/lib/precios";
import { ETIQUETA_ESTADO } from "../../ui";
import { Logo } from "@/components/Logo";

// Comprobante del pedido: página imprimible (o "Guardar como PDF") con la marca.
export default function Comprobante({ id }) {
  const [st, setSt] = useState({ cargando: true });
  useEffect(() => {
    const db = browserDb();
    if (!db) return setSt({ error: "Falta conectar la base de datos." });
    (async () => {
      const { data: s } = await db.auth.getSession();
      if (!s.session) return setSt({ error: "Entrá al panel primero para ver el comprobante." });
      const [{ data: o, error }, { data: rows }] = await Promise.all([
        db.from("orders").select("*").eq("id", id).maybeSingle(),
        db.from("settings").select("*"),
      ]);
      if (error || !o) return setSt({ error: "No encontramos ese pedido." });
      setSt({ o, s: Object.fromEntries((rows || []).map((r) => [r.key, r.value])) });
    })();
  }, [id]);

  if (st.cargando) return <div className="cpb-centro">Armando el comprobante…</div>;
  if (st.error) return <div className="cpb-centro">{st.error} <a href="/admin">Ir al panel</a></div>;
  const { o, s } = st;
  const subtotal = o.subtotal ?? (o.items || []).reduce((t, it) => t + it.price * it.qty, 0);
  const f = new Date(o.created_at);
  return (
    <div className="cpb-fondo">
      <div className="cpb-acciones">
        <button className="adm-btn negro" onClick={() => window.print()}>Imprimir o guardar PDF</button>
        <a className="adm-btn" href="/admin">Volver al panel</a>
      </div>
      <article className="cpb">
        <header className="cpb-cab">
          <div>
            <div className="cpb-logo"><Logo titila={false} /></div>
            <p>{s.negocio_nombre || "Tipificado cerámica"}</p>
            {s.negocio_cuit && <p>CUIT {s.negocio_cuit}</p>}
            {s.negocio_direccion && <p>{s.negocio_direccion}</p>}
            <p>{[s.instagram && "@" + s.instagram, s.whatsapp && "WhatsApp " + s.whatsapp].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="cpb-num">
            <small>Pedido</small>
            <b>{numPedido(o.number)}</b>
            <small>{f.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}</small>
            <span className="cpb-estado">{ETIQUETA_ESTADO[o.status] || o.status}</span>
          </div>
        </header>

        <section className="cpb-cliente">
          <small>Cliente</small>
          <b>{o.customer_name}</b>
          {o.contact && <span>{o.contact}</span>}
        </section>

        <table className="cpb-tabla">
          <thead><tr><th>Pieza</th><th>Color</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
          <tbody>
            {(o.items || []).map((it, i) => (
              <tr key={i}><td>{it.name}</td><td>{it.color}</td><td>{it.qty}</td><td>{money(it.price)}</td><td>{money(it.price * it.qty)}</td></tr>
            ))}
          </tbody>
        </table>

        <div className="cpb-totales">
          <span>Subtotal</span><span>{money(subtotal)}</span>
          {o.discount > 0 && <><span>Cupón {o.coupon_code}</span><span>− {money(o.discount)}</span></>}
          {o.shipping && <><span>{o.shipping.name}</span><span>{o.shipping_cost ? money(o.shipping_cost) : "—"}</span></>}
          <b>Total</b><b>{money(o.total)}</b>
        </div>

        {(o.shipping?.detalle || o.note) && (
          <section className="cpb-notas">
            {o.shipping?.detalle && <p><b>Entrega:</b> {o.shipping.detalle}</p>}
            {o.note && <p><b>Nota:</b> {o.note}</p>}
          </section>
        )}
        <footer className="cpb-pie">
          {o.payment_id ? `Pagado con Mercado Pago · operación ${o.payment_id}. ` : ""}
          Comprobante de pedido, no válido como factura. ¡Gracias por elegir piezas hechas a mano!
        </footer>
      </article>
    </div>
  );
}
