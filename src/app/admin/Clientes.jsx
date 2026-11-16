"use client";
import { useMemo, useState } from "react";
import { VENTA } from "@/lib/precios";
import { useAdm, useDatos, q, money, fecha, hace, Buscador, Titulo, Esqueleto, Vacio, ErrorCarga, Hoja } from "./ui";
import { FilaPedido, BotonesContacto, telefono, usuarioIg } from "./Pedidos";

// La lista de clientes se arma sola a partir de los pedidos
const claveDe = (o) => telefono(o.contact) || (usuarioIg(o.contact) || "").toLowerCase() || (o.customer_name || "").trim().toLowerCase();

export default function Clientes() {
  const { db, version } = useAdm();
  const datos = useDatos(() => q(db.from("orders").select("*").order("created_at", { ascending: false }).limit(1000)), [db, version]);
  const [busca, setBusca] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [orden, setOrden] = useState("reciente");

  const clientes = useMemo(() => {
    const m = new Map();
    for (const o of datos.data || []) {
      const k = claveDe(o);
      if (!k) continue;
      const c = m.get(k) || { k, nombre: o.customer_name, contacto: o.contact, pedidos: [], gastado: 0, ultimo: o.created_at };
      c.pedidos.push(o);
      if (VENTA.includes(o.status)) c.gastado += o.total;
      if (o.created_at > c.ultimo) c.ultimo = o.created_at;
      if (!c.contacto && o.contact) c.contacto = o.contact;
      m.set(k, c);
    }
    const l = [...m.values()];
    return orden === "gastado" ? l.sort((a, b) => b.gastado - a.gastado) : orden === "pedidos" ? l.sort((a, b) => b.pedidos.length - a.pedidos.length) : l.sort((a, b) => (a.ultimo < b.ultimo ? 1 : -1));
  }, [datos.data, orden]);

  const t = busca.trim().toLowerCase();
  const vis = clientes.filter((c) => !t || (c.nombre + " " + (c.contacto || "")).toLowerCase().includes(t));
  const sel = abierto && clientes.find((c) => c.k === abierto);

  return (
    <>
      <Titulo>Clientes</Titulo>
      {datos.error && !datos.data ? (
        <ErrorCarga error={datos.error} reintentar={datos.recargar} />
      ) : !datos.data ? (
        <Esqueleto filas={6} />
      ) : !clientes.length ? (
        <Vacio icono="☺" titulo="Todavía no hay clientes" texto="La lista se arma sola con cada pedido que entra." />
      ) : (
        <>
          <Buscador valor={busca} onChange={setBusca} placeholder="Buscar por nombre, teléfono o Instagram" />
          <div className="adm-fechas">
            <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar">
              <option value="reciente">Último pedido primero</option>
              <option value="gastado">Los que más gastaron</option>
              <option value="pedidos">Los que más pidieron</option>
            </select>
            <span className="adm-ayuda">{clientes.length} clientes</span>
          </div>
          {!vis.length ? (
            <Vacio icono="⌕" titulo="Nadie con ese nombre" />
          ) : (
            <div className="adm-lista">
              {vis.map((c) => (
                <button className="adm-fila-cliente" key={c.k} onClick={() => setAbierto(c.k)}>
                  <span className="adm-avatar" aria-hidden>{(c.nombre || "?").trim()[0]?.toUpperCase()}</span>
                  <span className="adm-fila-txt"><b>{c.nombre}</b><small>{c.contacto || "sin contacto"} · último {hace(c.ultimo)}</small></span>
                  <span className="adm-fila-der"><b>{money(c.gastado)}</b><small>{c.pedidos.length} {c.pedidos.length === 1 ? "pedido" : "pedidos"}</small></span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {sel && <FichaCliente c={sel} onCerrar={() => setAbierto(null)} />}
    </>
  );
}

function FichaCliente({ c, onCerrar }) {
  const { abrirPedido } = useAdm();
  const ultimo = c.pedidos[0];
  return (
    <Hoja titulo={c.nombre} onCerrar={onCerrar} cancelar="Listo">
      <div className="adm-ped-cabeza">
        <div><h3>{c.nombre}</h3><small>{c.contacto || "No dejó contacto"}</small></div>
        <span className="adm-avatar grande" aria-hidden>{(c.nombre || "?").trim()[0]?.toUpperCase()}</span>
      </div>
      <div className="adm-tarjetas tres">
        <div className="adm-tarjeta"><small>Pedidos</small><b>{c.pedidos.length}</b></div>
        <div className="adm-tarjeta"><small>Gastó</small><b>{money(c.gastado)}</b></div>
        <div className="adm-tarjeta"><small>Último</small><b className="chico">{fecha(c.ultimo)}</b></div>
      </div>
      <p className="adm-label">Escribirle</p>
      <div className="adm-caja"><BotonesContacto o={ultimo} /></div>
      <p className="adm-label">Sus pedidos</p>
      <div className="adm-lista">
        {c.pedidos.map((o) => <FilaPedido key={o.id} o={o} onClick={() => abrirPedido(o.id)} />)}
      </div>
    </Hoja>
  );
}
