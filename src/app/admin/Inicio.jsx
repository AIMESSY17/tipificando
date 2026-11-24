"use client";
import { useEffect, useMemo, useState } from "react";
import { VENTA } from "@/lib/precios";
import { nivelStock, umbralDe } from "@/lib/stock";
import { useAdm, useDatos, q, money, Titulo, Esqueleto, ErrorCarga, Vacio } from "./ui";
import { FilaPedido } from "./Pedidos";

const saludo = () => { const h = new Date().getHours(); return h < 13 ? "¡Buen día!" : h < 20 ? "¡Buenas tardes!" : "¡Buenas noches!"; };
const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export default function Inicio() {
  const { db, api, version, abrirPedido, irA } = useAdm();
  // Solo para soporte (SOPORTE_EMAILS): qué ajustes técnicos faltan. Al dueño el servidor no le manda nada.
  const [soporte, setSoporte] = useState(null);
  useEffect(() => {
    let vivo = true;
    api("admin/soporte").then((r) => { if (vivo && r?.soporte) setSoporte(r); }).catch(() => {});
    return () => { vivo = false; };
  }, [api, version]);
  const datos = useDatos(async () => {
    const [orders, products, arr, umbral] = await Promise.all([
      q(db.from("orders").select("*").order("created_at", { ascending: false }).limit(1000)),
      q(db.from("products").select("*")),
      db.from("arrepentimientos").select("id", { count: "exact", head: true }).eq("resuelto", false).then((r) => r.count || 0),
      db.from("settings").select("value").eq("key", "stock_umbral").maybeSingle().then((r) => umbralDe({ stock_umbral: r.data?.value })),
    ]);
    return { orders: orders || [], products: products || [], arr, umbral };
  }, [db, version]);

  const r = useMemo(() => {
    if (!datos.data) return null;
    const { orders, products } = datos.data;
    const ahora = new Date();
    const ventas = orders.filter((o) => VENTA.includes(o.status));
    const delMes = ventas.filter((o) => { const d = new Date(o.created_at); return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear(); });
    const totalMes = delMes.reduce((s, o) => s + o.total, 0);
    // últimos 30 días, día por día
    const hoy = dia(ahora);
    const dias = Array.from({ length: 30 }, (_, i) => ({ t: hoy - (29 - i) * 86400e3, total: 0, n: 0 }));
    for (const o of ventas) {
      const k = Math.round((dia(new Date(o.created_at)) - dias[0].t) / 86400e3);
      if (k >= 0 && k < 30) { dias[k].total += o.total; dias[k].n++; }
    }
    // piezas más vendidas
    const cont = new Map();
    for (const o of ventas) for (const it of o.items || []) {
      const c = cont.get(String(it.id)) || { id: it.id, name: it.name, qty: 0, plata: 0 };
      c.qty += it.qty; c.plata += it.price * it.qty;
      cont.set(String(it.id), c);
    }
    const porId = new Map(products.map((p) => [String(p.id), p]));
    const top = [...cont.values()].sort((a, b) => b.qty - a.qty).slice(0, 5).map((c) => ({ ...c, p: porId.get(String(c.id)) }));
    return {
      totalMes, cantMes: delMes.length, ticket: delMes.length ? Math.round(totalMes / delMes.length) : 0,
      pendientes: orders.filter((o) => o.status === "pendiente").length,
      producir: orders.filter((o) => o.status === "pagado" || o.status === "en produccion").length,
      nuevos: orders.filter((o) => !o.seen).length,
      dias, top, ultimos: orders.slice(0, 5), hay: orders.length > 0,
      // stock: solo piezas visibles con control
      stock: (() => {
        const con = products.filter((p) => p.active && p.stock != null);
        const nivel = (p) => nivelStock(p.stock, datos.data.umbral);
        return { con: con.length, ultimas: con.filter((p) => nivel(p) === "ultimas").length, sin: con.filter((p) => nivel(p) === "sin").length };
      })(),
    };
  }, [datos.data]);

  const mes = new Date().toLocaleDateString("es-AR", { month: "long" });
  return (
    <>
      <Titulo>{saludo()}</Titulo>
      {datos.error && !r ? (
        <ErrorCarga error={datos.error} reintentar={datos.recargar} />
      ) : !r ? (
        <Esqueleto tarjetas={4} filas={3} />
      ) : (
        <>
          {soporte && (soporte.faltan.length > 0 || soporte.invalidas.length > 0) && (
            <div className="adm-soporte" role="status">
              <b>🛠️ Soporte: falta configurar en Vercel</b>
              <ul>
                {[...soporte.faltan, ...soporte.invalidas].map((v) => <li key={v}><code>{v}</code></li>)}
              </ul>
              <small>Solo lo ves vos (SOPORTE_EMAILS). Cargala en Vercel → Environment Variables y hacé Redeploy. El dueño no ve este aviso.</small>
            </div>
          )}

          {(r.nuevos > 0 || datos.data.arr > 0) && (
            <div className="adm-avisos">
              {r.nuevos > 0 && (
                <button className="adm-aviso-fila azul" onClick={() => irA("pedidos")}>
                  <span>🛎️ {r.nuevos === 1 ? "Tenés 1 pedido nuevo sin ver" : `Tenés ${r.nuevos} pedidos nuevos sin ver`}</span><i>Ver ›</i>
                </button>
              )}
              {datos.data.arr > 0 && (
                <button className="adm-aviso-fila amarillo" onClick={() => irA("pedidos")}>
                  <span>↩︎ {datos.data.arr === 1 ? "1 pedido de arrepentimiento para resolver" : `${datos.data.arr} pedidos de arrepentimiento para resolver`}</span><i>Ver ›</i>
                </button>
              )}
            </div>
          )}

          <div className="adm-tarjetas">
            <div className="adm-tarjeta grande"><small>Ventas de {mes}</small><b>{money(r.totalMes)}</b><span>{r.cantMes} {r.cantMes === 1 ? "pedido" : "pedidos"}</span></div>
            <button className="adm-tarjeta" onClick={() => irA("pedidos")}><small>Pendientes</small><b>{r.pendientes}</b><span>esperando pago</span></button>
            <button className="adm-tarjeta" onClick={() => irA("pedidos")}><small>Para producir</small><b>{r.producir}</b><span>pagados y en el taller</span></button>
            <div className="adm-tarjeta"><small>Ticket promedio</small><b>{money(r.ticket)}</b><span>en {mes}</span></div>
            <TarjetaStock s={r.stock} irA={irA} />
          </div>

          <p className="adm-label">Ventas de los últimos 30 días</p>
          <div className="adm-caja"><Grafico dias={r.dias} /></div>

          <div className="adm-dos-col">
            <div>
              <p className="adm-label">Las más vendidas</p>
              {r.top.length ? (
                <div className="adm-lista">
                  {r.top.map((t, i) => (
                    <div className="adm-fila top" key={t.id}>
                      <span className="adm-thumb" style={{ background: t.p ? `linear-gradient(${t.p.bg} 0 62%, ${t.p.table_color || "#e6ded2"} 62%)` : "#e5e5ea" }}>
                        {t.p?.image_url && <img src={t.p.image_url} alt="" />}
                      </span>
                      <span className="adm-fila-txt"><b>{i + 1}. {t.name}</b><small>{t.qty} {t.qty === 1 ? "vendida" : "vendidas"} · {money(t.plata)}</small></span>
                    </div>
                  ))}
                </div>
              ) : <Vacio icono="◐" titulo="Todavía no hay ventas" texto="Acá vas a ver qué piezas salen más." />}
            </div>
            <div>
              <p className="adm-label">Últimos pedidos</p>
              {r.ultimos.length ? (
                <div className="adm-lista">
                  {r.ultimos.map((o) => <FilaPedido key={o.id} o={o} onClick={() => abrirPedido(o.id)} />)}
                  <button className="adm-fila-nav centro" onClick={() => irA("pedidos")}>Ver todos los pedidos</button>
                </div>
              ) : <Vacio icono="▤" titulo="Todavía no hay pedidos" texto="Cuando entre el primero, te avisamos acá mismo." />}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// Tarjeta «Stock»: cuántas piezas están en últimas unidades y sin stock. Cada mitad abre la lista filtrada.
function TarjetaStock({ s, irA }) {
  if (!s.con) {
    return (
      <button className="adm-tarjeta adm-tarjeta-stock vacia" onClick={() => irA("piezas")}>
        <small>Stock</small>
        <span>Todavía no controlás el stock de ninguna pieza. Cargalo en Piezas → la pieza → Stock.</span>
      </button>
    );
  }
  return (
    <div className="adm-tarjeta adm-tarjeta-stock">
      <small>Stock <span>· {s.con} {s.con === 1 ? "pieza con control" : "piezas con control"}</span></small>
      <div className="adm-stock-dos">
        <button className={"naranja" + (s.ultimas ? "" : " cero")} onClick={() => irA("piezas", { filtro: "ultimas" })}>
          <b>{s.ultimas}</b><span>Últimas unidades</span><i aria-hidden>›</i>
        </button>
        <button className={"rojo" + (s.sin ? "" : " cero")} onClick={() => irA("piezas", { filtro: "sinstock" })}>
          <b>{s.sin}</b><span>Sin stock</span><i aria-hidden>›</i>
        </button>
      </div>
    </div>
  );
}

// Gráfico de barras en SVG propio (sin librerías)
function Grafico({ dias }) {
  const [sel, setSel] = useState(null);
  const max = Math.max(1, ...dias.map((d) => d.total));
  const total = dias.reduce((s, d) => s + d.total, 0);
  const W = 300, H = 110, bw = W / dias.length;
  const d = sel != null ? dias[sel] : null;
  const f = (t) => new Date(t).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  return (
    <div className="adm-grafico">
      <div className="adm-grafico-cab">
        {d ? <><b>{money(d.total)}</b><span>{f(d.t)} · {d.n} {d.n === 1 ? "pedido" : "pedidos"}</span></>
          : <><b>{money(total)}</b><span>en 30 días · tocá una barra para ver el día</span></>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Ventas de los últimos 30 días: ${money(total)}`} onMouseLeave={() => setSel(null)}>
        <line x1="0" x2={W} y1={H} y2={H} stroke="#e5e5ea" />
        {dias.map((x, i) => {
          const h = x.total ? Math.max(3, (x.total / max) * (H - 8)) : 0;
          return (
            <g key={i} onMouseEnter={() => setSel(i)} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: "pointer" }}>
              <rect x={i * bw} y="0" width={bw} height={H} fill="transparent" />
              <rect x={i * bw + bw * 0.18} y={H - h} width={bw * 0.64} height={h} rx="2" className={"barra" + (sel === i ? " on" : "")} />
              <title>{f(x.t)}: {money(x.total)}</title>
            </g>
          );
        })}
      </svg>
      <div className="adm-grafico-eje"><span>{f(dias[0].t)}</span><span>hoy</span></div>
    </div>
  );
}
