"use client";
import { useState } from "react";
import { nombreEnvio, detalleEnvio, costoEnvio } from "@/lib/precios";
import { useAdm, useDatos, q, money, Titulo, Esqueleto, Vacio, ErrorCarga, Hoja, Interruptor, Segmento, mensajeError } from "./ui";

const TIPOS = [["retiro", "Retiro en el taller"], ["coordinar", "Envío a coordinar"], ["zona", "Costo fijo por zona"]];
const ICONO = { retiro: "🏠", coordinar: "💬", zona: "📦" };

export default function Envios() {
  const { db, toast, refrescarTienda } = useAdm();
  const datos = useDatos(() => q(db.from("shipping_options").select("*").order("sort")), [db]);
  const [edit, setEdit] = useState(null);
  const list = datos.data;
  const activas = (list || []).filter((e) => e.active).length;

  const guardarCambio = async (patch, id, msg) => {
    const { error } = await db.from("shipping_options").update(patch).eq("id", id);
    if (error) return toast(mensajeError(error));
    refrescarTienda();
    if (msg) toast(msg);
    datos.recargar();
  };
  const mover = async (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const nl = [...list];
    [nl[i], nl[j]] = [nl[j], nl[i]];
    await Promise.all(nl.map((e, k) => (e.sort !== k ? db.from("shipping_options").update({ sort: k }).eq("id", e.id) : null)));
    refrescarTienda();
    datos.recargar();
  };
  const nuevo = () => setEdit({ kind: "zona", name: "", price: "", address: "", hours: "", active: true, sort: list?.length || 0 });

  return (
    <>
      <Titulo accion={<button className="adm-btn negro" onClick={nuevo}>+ Nueva</button>}>Envíos</Titulo>
      <p className="adm-ayuda">Las opciones que el cliente elige al pagar. El costo se suma solo al total y a Mercado Pago.</p>
      {datos.error && !list ? (
        <ErrorCarga error={datos.error} reintentar={datos.recargar} />
      ) : !list ? (
        <Esqueleto filas={3} />
      ) : !list.length ? (
        <Vacio icono="📦" titulo="No hay opciones de entrega" texto="Mientras tanto, la tienda ofrece «Envío a coordinar». Sumá retiro en el taller o un costo fijo por zona."
          accion={<button className="adm-btn negro" onClick={nuevo}>Agregar una opción</button>} />
      ) : (
        <>
          {activas === 0 && <div className="adm-alerta">Todas las opciones están apagadas: la tienda va a ofrecer «Envío a coordinar».</div>}
          <div className="adm-lista">
            {list.map((e, i) => (
              <div className={"adm-fila envio" + (e.active ? "" : " apagada")} key={e.id}>
                <span className="adm-ic-envio" aria-hidden>{ICONO[e.kind]}</span>
                <button className="adm-fila-txt" onClick={() => setEdit(e)}>
                  <b>{nombreEnvio(e)}</b>
                  <small>{e.kind === "zona" ? money(costoEnvio(e)) : detalleEnvio(e)}</small>
                </button>
                <div className="adm-fila-acc">
                  <span className="adm-flechas">
                    <button onClick={() => mover(i, -1)} aria-label="Subir" disabled={i === 0}>↑</button>
                    <button onClick={() => mover(i, 1)} aria-label="Bajar" disabled={i === list.length - 1}>↓</button>
                  </span>
                  <Interruptor checked={e.active} onChange={(v) => guardarCambio({ active: v }, e.id, v ? "Opción activada" : "Opción apagada")} label={e.active ? "Activa" : "Apagada"} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {edit && <EditorEnvio e={edit} onCerrar={() => setEdit(null)} onGuardado={() => { setEdit(null); datos.recargar(); }} />}
    </>
  );
}

function EditorEnvio({ e: e0, onCerrar, onGuardado }) {
  const { db, toast, confirmar, refrescarTienda } = useAdm();
  const [e, setE] = useState({ ...e0, price: e0.price || "" });
  const [err, setErr] = useState("");
  const set = (k, v) => setE((x) => ({ ...x, [k]: v }));

  const guardar = async () => {
    setErr("");
    if (e.kind === "zona" && !e.name.trim()) return setErr("Poné el nombre de la zona (ej: CABA).");
    if (e.kind === "zona" && !(parseInt(e.price, 10) > 0)) return setErr("Poné el costo del envío.");
    const row = {
      kind: e.kind,
      name: e.name.trim() || (e.kind === "retiro" ? "Retiro en el taller" : e.kind === "coordinar" ? "Envío a coordinar" : ""),
      price: e.kind === "zona" ? parseInt(e.price, 10) : 0,
      address: e.kind === "retiro" ? e.address.trim() : "",
      hours: e.kind === "retiro" ? e.hours.trim() : "",
      active: e.active, sort: e.sort ?? 0,
    };
    const { error } = e.id ? await db.from("shipping_options").update(row).eq("id", e.id) : await db.from("shipping_options").insert(row);
    if (error) return setErr(mensajeError(error));
    await refrescarTienda();
    toast("Guardado ✓");
    onGuardado();
  };
  const borrar = async () => {
    if (!(await confirmar({ titulo: `¿Borrar «${nombreEnvio(e)}»?`, texto: "Deja de aparecer en la tienda. Los pedidos que ya la eligieron no cambian." }))) return;
    const { error } = await db.from("shipping_options").delete().eq("id", e.id);
    if (error) return setErr(mensajeError(error));
    await refrescarTienda();
    toast("Opción borrada");
    onGuardado();
  };

  return (
    <Hoja titulo={e.id ? "Editar opción" : "Nueva opción de entrega"} onCerrar={onCerrar} cancelar="Cancelar"
      accion={<button className="azul" onClick={guardar}>Guardar</button>}>
      <p className="adm-label">Tipo</p>
      <Segmento valor={e.kind} onChange={(v) => set("kind", v)} opciones={TIPOS} />
      <div className="adm-grupo campos">
        {e.kind === "zona" && (
          <>
            <label>Zona<input value={e.name} onChange={(x) => set("name", x.target.value)} placeholder="ej: CABA, GBA norte, Interior" /></label>
            <label>Costo del envío<input inputMode="numeric" value={e.price} onChange={(x) => set("price", x.target.value.replace(/\D/g, ""))} placeholder="$" /></label>
          </>
        )}
        {e.kind === "retiro" && (
          <>
            <label>Nombre<input value={e.name} onChange={(x) => set("name", x.target.value)} placeholder="Retiro en el taller" /></label>
            <label>Dirección <small>(se muestra al elegirla)</small><input value={e.address} onChange={(x) => set("address", x.target.value)} placeholder="ej: Villa Crespo, CABA (te pasamos la dirección exacta)" /></label>
            <label>Horario<input value={e.hours} onChange={(x) => set("hours", x.target.value)} placeholder="ej: Lunes a viernes de 10 a 18 h" /></label>
          </>
        )}
        {e.kind === "coordinar" && (
          <>
            <label>Nombre<input value={e.name} onChange={(x) => set("name", x.target.value)} placeholder="Envío a coordinar" /></label>
            <p className="adm-ayuda">El cliente paga solo las piezas; el envío lo arreglan por mensaje.</p>
          </>
        )}
      </div>
      <div className="adm-grupo">
        <label className="adm-check"><span>Se ofrece en la tienda</span><Interruptor checked={e.active} onChange={(v) => set("active", v)} label="Activa" /></label>
      </div>
      <p className="adm-label">Así se ve al pagar</p>
      <div className="adm-caja adm-ejemplo-envio">
        <b>{nombreEnvio({ ...e, price: parseInt(e.price, 10) || 0 })}</b>
        <small>{detalleEnvio({ ...e, price: parseInt(e.price, 10) || 0 })}</small>
      </div>
      {err && <p className="adm-err" role="alert">{err}</p>}
      {e.id && <button className="adm-btn rojo" onClick={borrar}>Borrar opción</button>}
    </Hoja>
  );
}
