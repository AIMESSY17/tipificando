"use client";
import { useEffect, useMemo, useState } from "react";
import { VENTA } from "@/lib/precios";
import { textoParaAndreani, linkSeguimiento } from "@/lib/envio";
import {
  useAdm, useDatos, q, money, numPedido, fecha, fechaLarga, hace, Estado, ETIQUETA_ESTADO, PASOS,
  Buscador, Filtros, Titulo, Esqueleto, Vacio, ErrorCarga, Hoja, mensajeError, descargar,
} from "./ui";

// Qué pasó con el stock de las piezas de este pedido (supabase/stock.sql)
const STOCK_PEDIDO = {
  reservado: "Reservado: si no se paga a tiempo, vuelve solo al stock",
  vendido: "Descontado del stock (venta)",
  liberado: "Devuelto al stock (no se pagó a tiempo, se rechazó o se canceló)",
  devuelto: "Devuelto al stock a mano",
};

const MP = { approved: "Aprobado ✓", pending: "Pendiente", in_process: "En revisión", rejected: "Rechazado", cancelled: "Cancelado", refunded: "Devuelto", charged_back: "Contracargo" };

// ---------- Contacto: WhatsApp / Instagram ----------
export function telefono(contacto = "") {
  const d = String(contacto).replace(/\D/g, "");
  if (d.length < 8 || /@/.test(contacto)) return null;
  const n = d.replace(/^0+/, "");
  return n.startsWith("54") ? n : "549" + n; // Argentina, celular
}
export function usuarioIg(contacto = "") {
  const s = String(contacto).trim();
  if (telefono(s)) return null;
  const m = s.match(/@?([a-z0-9._]{2,30})/i);
  return m ? m[1] : null;
}

// Mensaje armado según el estado del pedido
export function mensajePara(o) {
  const n = numPedido(o.number);
  const nombre = (o.customer_name || "").split(" ")[0];
  const hola = `¡Hola${nombre ? " " + nombre : ""}!`;
  const retiro = o.shipping?.kind === "retiro";
  switch (o.status) {
    case "pagado": return `${hola} Recibimos el pago de tu pedido ${n} 🙌 En estos días empezamos a hacerlo. ¡Gracias por elegir tipificado!`;
    case "en produccion": return `${hola} Tu pedido ${n} ya está en producción 🔥 Te avisamos apenas esté listo.`;
    case "enviado": return retiro
      ? `${hola} Tu pedido ${n} ya está listo para retirar en el taller${o.shipping?.detalle ? " (" + o.shipping.detalle + ")" : ""}. ¡Te esperamos!`
      : `${hola} Tu pedido ${n} ya salió 📦${o.tracking_number ? ` Seguimiento Andreani: ${o.tracking_number} → ${linkSeguimiento(o.tracking_number)}` : " En breve lo tenés en tu casa."}`;
    case "entregado": return `${hola} ¿Llegó todo bien con tu pedido ${n}? Esperamos que lo disfrutes. Si le sacás una foto, nos encantaría verla ✨`;
    case "cancelado": return `${hola} Te escribimos por tu pedido ${n}: quedó cancelado. Cualquier duda, contestanos por acá.`;
    case "rechazado": return `${hola} Vimos que el pago de tu pedido ${n} no se completó. Si querés, te pasamos otra forma de pago.`;
    default: return `${hola} Recibimos tu pedido ${n} en tipificado. Te escribimos para confirmar los detalles.`;
  }
}

export function BotonesContacto({ o, compacto }) {
  const { toast } = useAdm();
  const tel = telefono(o.contact);
  const ig = usuarioIg(o.contact);
  const txt = mensajePara(o);
  const porIg = async () => {
    try { await navigator.clipboard.writeText(txt); toast("Mensaje copiado: pegalo en el chat de Instagram"); } catch {}
    window.open(ig ? `https://ig.me/m/${ig}` : "https://www.instagram.com/direct/inbox/", "_blank");
  };
  return (
    <div className={"adm-contacto" + (compacto ? " compacto" : "")}>
      <a className={"adm-btn wa" + (tel ? "" : " off")} href={tel ? `https://wa.me/${tel}?text=${encodeURIComponent(txt)}` : undefined} target="_blank" rel="noreferrer"
        aria-disabled={!tel} onClick={(e) => { if (!tel) { e.preventDefault(); toast("Este cliente no dejó un número de WhatsApp"); } }}>
        Escribirle por WhatsApp
      </a>
      <button className="adm-btn ig" onClick={porIg}>Por Instagram</button>
    </div>
  );
}

// ---------- CSV para Excel ----------
function csv(pedidos) {
  const c = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const filas = [["Número", "Fecha", "Cliente", "Contacto", "Piezas", "Subtotal", "Descuento", "Cupón", "Entrega", "Costo de envío", "Total", "Estado", "Pago Mercado Pago", "Mail", "Seguimiento Andreani", "Nota del cliente", "Notas internas"]];
  for (const o of pedidos)
    filas.push([
      numPedido(o.number), new Date(o.created_at).toLocaleString("es-AR"), o.customer_name, o.contact,
      (o.items || []).map((it) => `${it.qty} x ${it.name} (${it.color})`).join(" | "),
      o.subtotal ?? o.total, o.discount || 0, o.coupon_code || "", o.shipping?.name || "", o.shipping_cost || 0, o.total,
      ETIQUETA_ESTADO[o.status] || o.status, MP[o.mp_status] || "", o.email || "", o.tracking_number || "", o.note || "", o.internal_notes || "",
    ]);
  // ";" y BOM: así Excel en castellano lo abre bien, con tildes
  return "﻿" + filas.map((f) => f.map(c).join(";")).join("\r\n");
}

const RANGOS = [["todo", "Todas las fechas"], ["hoy", "Hoy"], ["7", "Últimos 7 días"], ["30", "Últimos 30 días"], ["mes", "Este mes"], ["elegir", "Elegir fechas…"]];
function enRango(iso, rango, desde, hasta) {
  const d = new Date(iso), ahora = new Date();
  if (rango === "hoy") return d.toDateString() === ahora.toDateString();
  if (rango === "7" || rango === "30") return ahora - d <= Number(rango) * 86400e3;
  if (rango === "mes") return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
  if (rango === "elegir") return (!desde || d >= new Date(desde + "T00:00")) && (!hasta || d <= new Date(hasta + "T23:59:59"));
  return true;
}

// ===================== LISTA =====================
export default function Pedidos() {
  const { db, version, abrirPedido, toast } = useAdm();
  const datos = useDatos(async () => {
    const [orders, arr] = await Promise.all([
      q(db.from("orders").select("*").order("created_at", { ascending: false }).limit(1000)),
      db.from("arrepentimientos").select("*").eq("resuelto", false).order("created_at", { ascending: false }).then((r) => r.data || []),
    ]);
    return { orders: orders || [], arr };
  }, [db, version]);
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState("todos");
  const [rango, setRango] = useState("todo");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [arrOk, setArrOk] = useState([]);

  const orders = datos.data?.orders || [];
  const crudo = busca.trim().toLowerCase();
  const soloNumero = crudo.startsWith("#"); // "#12" o "#0012": solo por número de pedido
  const texto = crudo.replace(/^#0*/, "");
  const porEstado = (o, e) => (e === "todos" ? true : e === "nuevos" ? !o.seen : o.status === e);
  const coincide = (o) => {
    if (!texto) return true;
    if (String(o.number) === texto.replace(/^0+/, "")) return true;
    if (soloNumero) return false;
    return (o.customer_name + " " + (o.contact || "")).toLowerCase().includes(texto);
  };
  const vis = useMemo(() => orders.filter((o) => porEstado(o, estado) && enRango(o.created_at, rango, desde, hasta) && coincide(o)),
    [orders, estado, rango, desde, hasta, texto, soloNumero]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = (e) => orders.filter((o) => porEstado(o, e)).length;
  const arr = (datos.data?.arr || []).filter((a) => !arrOk.includes(a.id));

  const exportar = () => {
    if (!vis.length) return toast("No hay pedidos para exportar con estos filtros");
    descargar(`pedidos-tipificado-${new Date().toISOString().slice(0, 10)}.csv`, csv(vis));
    toast(`Exportados ${vis.length} pedidos ✓`);
  };
  const resolver = async (a) => {
    setArrOk((x) => [...x, a.id]);
    const { error } = await db.from("arrepentimientos").update({ resuelto: true }).eq("id", a.id);
    if (error) toast(mensajeError(error));
  };

  return (
    <>
      <Titulo accion={<button className="adm-mini" onClick={exportar} disabled={!orders.length}>Exportar a Excel</button>}>Pedidos</Titulo>
      {arr.length > 0 && (
        <div className="adm-alerta">
          <b>Pedidos de arrepentimiento ({arr.length})</b>
          {arr.map((a) => (
            <div key={a.id} className="adm-arrep">
              <span><code>{a.code}</code> · {a.nombre} · {a.contacto}<br /><small>{a.pedido}{a.mensaje ? ` — “${a.mensaje}”` : ""} · {hace(a.created_at)}</small></span>
              <button className="adm-mini" onClick={() => resolver(a)}>Resuelto</button>
            </div>
          ))}
        </div>
      )}
      <Buscador valor={busca} onChange={setBusca} placeholder="Buscar por nombre o número (ej: 12)" />
      <Filtros valor={estado} onChange={setEstado} opciones={[
        ["todos", "Todos"], ["nuevos", "Sin ver", n("nuevos")], ["pendiente", "Pendientes", n("pendiente")], ["pagado", "Pagados", n("pagado")],
        ["en produccion", "En producción", n("en produccion")], ["enviado", "Enviados", n("enviado")], ["entregado", "Entregados"], ["cancelado", "Cancelados"],
      ]} />
      <div className="adm-fechas">
        <select value={rango} onChange={(e) => setRango(e.target.value)} aria-label="Fecha">
          {RANGOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        {rango === "elegir" && (
          <>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
          </>
        )}
      </div>
      {datos.error && !datos.data ? (
        <ErrorCarga error={datos.error} reintentar={datos.recargar} />
      ) : !datos.data ? (
        <Esqueleto filas={7} alto={64} />
      ) : !orders.length ? (
        <Vacio icono="▤" titulo="Todavía no hay pedidos" texto="Cuando alguien pague con Mercado Pago, el pedido aparece acá al instante." />
      ) : !vis.length ? (
        <Vacio icono="⌕" titulo="No hay pedidos con ese filtro" accion={<button className="adm-mini" onClick={() => { setBusca(""); setEstado("todos"); setRango("todo"); }}>Ver todos</button>} />
      ) : (
        <>
          <p className="adm-ayuda">{vis.length} {vis.length === 1 ? "pedido" : "pedidos"} · {money(vis.filter((o) => VENTA.includes(o.status)).reduce((s, o) => s + o.total, 0))} vendidos</p>
          <div className="adm-lista">
            {vis.map((o) => <FilaPedido key={o.id} o={o} onClick={() => abrirPedido(o.id)} />)}
          </div>
        </>
      )}
    </>
  );
}

export function FilaPedido({ o, onClick }) {
  const piezas = (o.items || []).reduce((s, it) => s + it.qty, 0);
  return (
    <button className={"adm-fila-pedido" + (o.seen ? "" : " nuevo")} onClick={onClick}>
      <span className="adm-num">{numPedido(o.number)}</span>
      <span className="adm-fila-txt">
        <b>{!o.seen && <i className="adm-punto" aria-label="Sin ver" />}{o.customer_name}</b>
        <small>{o.alerta && <b className="adm-aviso">⚠ {o.alerta} · </b>}{fecha(o.created_at, true)} · {piezas} {piezas === 1 ? "pieza" : "piezas"}{o.shipping?.name ? " · " + o.shipping.name : ""}</small>
      </span>
      <span className="adm-fila-der"><b>{money(o.total)}</b><Estado s={o.status} /></span>
    </button>
  );
}

// ===================== DESPACHO (Andreani) =====================
// Datos para cargar el envío a mano en Andreani + número de seguimiento (le llega un mail al comprador)
function Despacho({ o, onGuardado }) {
  const { api, toast } = useAdm();
  const d = o.shipping_detail;
  const dest = d.destino || {};
  const [num, setNum] = useState(o.tracking_number || "");
  const [busy, setBusy] = useState(false);
  const pagado = ["pagado", "en produccion", "enviado", "entregado"].includes(o.status);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(textoParaAndreani(o)); toast("Datos copiados ✓ Pegalos en Andreani"); }
    catch { window.prompt("Copiá los datos:", textoParaAndreani(o)); }
  };
  const guardar = async () => {
    const t = num.trim();
    if (!t) return toast("Pegá el número de seguimiento de Andreani");
    setBusy(true);
    const r = await api("admin/seguimiento", "POST", { id: o.id, tracking: t });
    setBusy(false);
    if (r.error) return toast(r.error, { dur: 4500 });
    toast(
      r.mail === "enviado" ? "Seguimiento guardado ✓ Le mandamos el mail al comprador"
        : r.mail === "error" ? `Guardado, pero el mail no salió: ${r.motivo}`
        : r.mail === "sin_mail" ? "Guardado ✓ (el comprador no dejó mail: avisale vos)"
        : "Seguimiento guardado ✓",
      { dur: 4500 }
    );
    onGuardado();
  };

  return (
    <>
      <p className="adm-label">Para despachar con Andreani</p>
      <div className="adm-caja adm-despacho">
        <div className="adm-dato"><span>Nombre</span><b>{o.customer_name}</b></div>
        <div className="adm-dato"><span>Mail</span><b>{o.email || "No dejó mail"}</b></div>
        <div className="adm-dato"><span>Teléfono / contacto</span><b>{o.contact || "—"}</b></div>
        <div className="adm-dato"><span>Entrega</span><b>{d.modalidad === "sucursal" ? "A sucursal Andreani" : "A domicilio"}</b></div>
        <div className="adm-dato"><span>{d.modalidad === "sucursal" ? "Sucursal" : "Dirección"}</span>
          <b>{d.modalidad === "sucursal" ? dest.sucursal : `${dest.calle} ${dest.numero}${dest.piso ? `, ${dest.piso}` : ""}`}</b></div>
        <div className="adm-dato"><span>Localidad</span><b>{dest.localidad}, {dest.provincia} (CP {dest.cp})</b></div>
        {d.peso_g > 0 && <div className="adm-dato"><span>Peso</span><b>{d.peso_g} g</b></div>}
        {d.medidas && <div className="adm-dato"><span>Medidas</span><b>{d.medidas.alto} × {d.medidas.ancho} × {d.medidas.largo} cm</b></div>}
        <button className="adm-btn negro" onClick={copiar}>Copiar datos para Andreani</button>
      </div>

      <p className="adm-label">Envío cobrado al comprador</p>
      <div className="adm-caja">
        <div className="adm-dato"><span>Cobrado</span><b>{d.coordinar ? "A coordinar" : d.cobrado > 0 ? money(d.cobrado) : "Gratis"}</b></div>
        {d.ref_precio != null && <div className="adm-dato"><span>Referencia ({d.ref_carrier}{d.demora ? ` · ${d.demora}` : ""})</span><b>{money(d.ref_precio)}</b></div>}
        <p className="adm-ayuda">
          {d.coordinar ? "No se pudo cotizar automáticamente: coordinalo por mensaje con el comprador."
            : d.fuente === "respaldo" ? "Se cobró según la tabla de respaldo (Zipnova no respondió)."
            : "Compará lo cobrado con lo que te cuesta en Andreani para afinar el factor en Envíos."}
        </p>
      </div>

      <p className="adm-label">Número de seguimiento de Andreani</p>
      <div className="adm-grupo">
        <div className="adm-despacho-fila">
          <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="ej: 360003456789012" aria-label="Número de seguimiento" disabled={!pagado} />
          <button className="adm-btn negro" onClick={guardar} disabled={busy || !pagado}>{busy ? "Guardando…" : o.tracking_number ? "Actualizar" : "Guardar y avisar"}</button>
        </div>
        <p className="adm-ayuda">
          {!pagado ? "Se habilita cuando el pedido está pagado."
            : o.tracking_number
              ? <>Guardado. {o.tracking_sent_at ? `Mail enviado el ${fechaLarga(o.tracking_sent_at)}. ` : o.email ? "" : "El comprador no dejó mail. "}<a href={linkSeguimiento(o.tracking_number)} target="_blank" rel="noreferrer">Ver seguimiento ↗</a></>
              : "Al guardarlo, el pedido pasa a «Enviado» y al comprador le llega un mail con el número y el link de seguimiento."}
        </p>
      </div>
    </>
  );
}

// ===================== DETALLE =====================
export function DetallePedido({ id, onCerrar }) {
  const { db, toast, cambio, confirmar, refrescarTienda } = useAdm();
  const datos = useDatos(async () => {
    const [o, hist] = await Promise.all([
      q(db.from("orders").select("*").eq("id", id).maybeSingle()),
      db.from("order_status_history").select("*").eq("order_id", id).order("created_at").then((r) => r.data || []),
    ]);
    return { o, hist };
  }, [db, id]);
  const o = datos.data?.o;
  const [notas, setNotas] = useState(null);
  const [guardado, setGuardado] = useState("");
  const [busy, setBusy] = useState(false);

  // al abrirlo, queda como visto
  useEffect(() => {
    if (o && !o.seen) db.from("orders").update({ seen: true }).eq("id", o.id).then(() => cambio());
    if (o && notas === null) setNotas(o.internal_notes || "");
  }, [o]); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiarEstado = async (s) => {
    if (!o || s === o.status) return;
    setBusy(true);
    const { error } = await db.from("orders").update({ status: s }).eq("id", o.id);
    setBusy(false);
    if (error) return toast(mensajeError(error));
    // Stock: una reserva cancelada vuelve sola (la base); una venta cancelada, solo si el dueño quiere
    if (s === "cancelado" && o.stock_estado === "vendido") {
      const si = await confirmar({
        titulo: "¿Devolver al stock?",
        texto: "Las piezas de este pedido vuelven a quedar disponibles en la tienda. Si ya las mandaste o se rompieron, elegí «No».",
        si: "Devolver al stock", no: "No", peligro: false,
      });
      if (si) return devolverStock(`${numPedido(o.number)}: Cancelado ✓ y devuelto al stock`);
    }
    toast(`${numPedido(o.number)}: ${ETIQUETA_ESTADO[s]} ✓${s === "cancelado" && o.stock_estado === "reservado" ? " La reserva volvió al stock" : ""}`);
    if (o.stock_estado) refrescarTienda();
    datos.recargar();
    cambio();
  };
  const devolverStock = async (msg) => {
    setBusy(true);
    const { data, error } = await db.rpc("devolver_stock_pedido", { p_order: o.id });
    setBusy(false);
    if (error) toast(mensajeError(error));
    else if (data?.ok === false) toast("Este pedido ya no tiene piezas para devolver al stock.");
    else toast(msg || "Devuelto al stock ✓");
    refrescarTienda();
    datos.recargar();
    cambio();
  };
  const resolverAlerta = async () => {
    if (!o) return;
    setBusy(true);
    const { error } = await db.from("orders").update({ alerta: null }).eq("id", o.id);
    setBusy(false);
    if (error) return toast(mensajeError(error));
    toast("Alerta resuelta ✓");
    datos.recargar();
    cambio();
  };
  const guardarNotas = async () => {
    if (!o || notas === (o.internal_notes || "")) return;
    setGuardado("Guardando…");
    const { error } = await db.from("orders").update({ internal_notes: notas }).eq("id", o.id);
    setGuardado(error ? "No se pudo guardar" : "Guardado ✓");
    if (!error) { o.internal_notes = notas; setTimeout(() => setGuardado(""), 1800); }
  };

  const siguiente = o ? PASOS[PASOS.indexOf(o.status) + 1] : null;
  const subtotal = o ? o.subtotal ?? (o.items || []).reduce((s, it) => s + it.price * it.qty, 0) : 0;

  return (
    <Hoja titulo={o ? `Pedido ${numPedido(o.number)}` : "Pedido"} onCerrar={onCerrar} cancelar="Listo"
      accion={o && <button onClick={() => window.open(`/admin/comprobante/${o.id}`, "_blank")}>Comprobante</button>}>
      {datos.error ? (
        <ErrorCarga error={datos.error} reintentar={datos.recargar} />
      ) : !datos.data ? (
        <Esqueleto filas={4} alto={60} />
      ) : !o ? (
        <Vacio titulo="Este pedido ya no existe" />
      ) : (
        <>
          <div className="adm-ped-cabeza">
            <div>
              <h3>{o.customer_name}</h3>
              <small>{fechaLarga(o.created_at)} · {new Date(o.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small>
            </div>
            <Estado s={o.status} />
          </div>

          {o.alerta && (
            <div className="adm-alerta" role="alert">
              <span>
                <b>⚠ {o.alerta}.</b>
                {/cup/.test(o.alerta) && <> El pago se aprobó después de que venciera la reserva del cupón{o.coupon_code ? ` ${o.coupon_code}` : ""}. La plata entró, pero el cupón pudo haberse agotado mientras tanto: revisá cuántos usos tiene.</>}
                {/stock/.test(o.alerta) && <> El pago se aprobó después de que venciera la reserva y, mientras tanto, otra persona compró unidades de alguna de estas piezas: no alcanzó el stock para todo el pedido. La plata entró: fijate si podés hacerlas o hablá con el cliente.</>}
              </span>
              <button className="adm-btn" disabled={busy} onClick={resolverAlerta}>Ya lo revisé</button>
            </div>
          )}

          <p className="adm-label">Estado</p>
          <div className="adm-pasos" role="list">
            {PASOS.map((s, i) => {
              const k = PASOS.indexOf(o.status);
              return <span key={s} role="listitem" className={(i < k ? "hecho " : "") + (i === k ? "ahora" : "")}>{ETIQUETA_ESTADO[s]}</span>;
            })}
          </div>
          <div className="adm-grupo">
            {siguiente && <button className="adm-btn negro" disabled={busy} onClick={() => cambiarEstado(siguiente)}>Pasar a «{ETIQUETA_ESTADO[siguiente]}»</button>}
            <label className="adm-check">
              <span>Cambiar a otro estado</span>
              <select value={o.status} onChange={(e) => cambiarEstado(e.target.value)} disabled={busy} aria-label="Estado del pedido">
                {[...PASOS, "cancelado", ...(["rechazado", "devuelto"].includes(o.status) ? [o.status] : [])].map((s) => <option key={s} value={s}>{ETIQUETA_ESTADO[s]}</option>)}
              </select>
            </label>
          </div>

          <p className="adm-label">Cliente</p>
          <div className="adm-caja">
            <div className="adm-dato"><span>Contacto</span><b>{o.contact || "No dejó contacto"}</b></div>
            <BotonesContacto o={o} />
            <p className="adm-ayuda">El mensaje ya va armado según el estado: «{mensajePara(o).slice(0, 70)}…»</p>
          </div>

          <p className="adm-label">Piezas</p>
          <div className="adm-caja">
            {(o.items || []).map((it, i) => (
              <div className="adm-item" key={i}>
                <span><b>{it.qty} ×</b> {it.name} <small>({it.color})</small></span>
                <span>{it.list_price && <s>{money(it.list_price * it.qty)}</s>} {money(it.price * it.qty)}</span>
              </div>
            ))}
            <div className="adm-totales">
              <span>Subtotal</span><span>{money(subtotal)}</span>
              {o.discount > 0 && <><span>Cupón {o.coupon_code}</span><span>− {money(o.discount)}</span></>}
              {o.shipping && <><span>{o.shipping.name}</span><span>{o.shipping_cost ? money(o.shipping_cost) : o.shipping.kind === "retiro" ? "Gratis" : "A coordinar"}</span></>}
              <b>Total</b><b>{money(o.total)}</b>
            </div>
          </div>

          <p className="adm-label">Entrega y pago</p>
          <div className="adm-caja">
            <div className="adm-dato"><span>Entrega</span><b>{o.shipping?.name || "A coordinar"}</b></div>
            {o.shipping?.detalle && <p className="adm-ayuda">{o.shipping.detalle}</p>}
            <div className="adm-dato"><span>Mercado Pago</span><b>{o.mp_status ? MP[o.mp_status] || o.mp_status : "Todavía no pagó"}</b></div>
            {o.payment_id && <div className="adm-dato"><span>N.º de pago</span><b className="mono">{o.payment_id}</b></div>}
            {o.stock_estado && <div className="adm-dato"><span>Stock</span><b>{STOCK_PEDIDO[o.stock_estado] || o.stock_estado}</b></div>}
            {o.stock_estado === "vendido" && ["cancelado", "devuelto", "rechazado"].includes(o.status) && (
              <button className="adm-btn" disabled={busy} onClick={() => devolverStock()}>Devolver las piezas al stock</button>
            )}
          </div>

          {o.shipping_detail?.destino && <Despacho o={o} onGuardado={() => { datos.recargar(); cambio(); }} />}

          {o.note && (
            <>
              <p className="adm-label">Nota del cliente</p>
              <div className="adm-caja"><p className="adm-nota">“{o.note}”</p></div>
            </>
          )}

          <p className="adm-label">Notas internas <small>(el cliente no las ve)</small> <em className="adm-guardado">{guardado}</em></p>
          <div className="adm-grupo">
            <textarea rows={3} value={notas ?? ""} placeholder="ej: quiere el esmalte un poco más oscuro" onChange={(e) => setNotas(e.target.value)} onBlur={guardarNotas} />
          </div>

          <p className="adm-label">Historia</p>
          <ol className="adm-historia">
            {(datos.data.hist.length ? datos.data.hist : [{ id: 0, status: o.status, created_at: o.created_at }]).map((h) => (
              <li key={h.id}>
                <Estado s={h.status} />
                <span>{fecha(h.created_at, true)}{h.by_email && h.by_email !== "automático" ? ` · ${h.by_email.split("@")[0]}` : h.by_email === "automático" ? " · automático" : ""}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Hoja>
  );
}
