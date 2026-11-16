"use client";
import { useState } from "react";
import { normalizarCodigo, problemaCupon, textoCupon } from "@/lib/precios";
import { useAdm, useDatos, q, fechaLarga, Titulo, Esqueleto, Vacio, ErrorCarga, Hoja, Interruptor, Segmento, mensajeError } from "./ui";

export default function Cupones() {
  const { db, toast } = useAdm();
  const datos = useDatos(() => q(db.from("coupons").select("*").order("created_at", { ascending: false })), [db]);
  const [edit, setEdit] = useState(null);
  const list = datos.data;

  const activar = async (c, v) => {
    const { error } = await db.from("coupons").update({ active: v }).eq("id", c.id);
    if (error) return toast(mensajeError(error));
    toast(v ? `${c.code} activado` : `${c.code} pausado`);
    datos.recargar();
  };
  const nuevo = () => setEdit({ code: "", kind: "porcentaje", value: "", expires_at: "", max_uses: "", active: true, uses: 0 });

  return (
    <>
      <Titulo accion={<button className="adm-btn negro" onClick={nuevo}>+ Nuevo</button>}>Cupones</Titulo>
      {datos.error && !list ? (
        <ErrorCarga error={datos.error} reintentar={datos.recargar} />
      ) : !list ? (
        <Esqueleto filas={3} />
      ) : !list.length ? (
        <Vacio icono="✂︎" titulo="Todavía no hay cupones" texto="Creá un código de descuento para compartir en Instagram, por ejemplo BIENVENIDA para el 10% en la primera compra."
          accion={<button className="adm-btn negro" onClick={nuevo}>Crear el primero</button>} />
      ) : (
        <>
          <p className="adm-ayuda">El cliente lo escribe al pagar, en «¿Tenés un cupón?». El descuento se calcula solo. Un uso se cuenta cuando Mercado Pago aprueba el pago.</p>
          <div className="adm-lista">
            {list.map((c) => {
              const prob = problemaCupon({ ...c, active: true });
              return (
                <div className={"adm-fila cupon" + (c.active && !prob ? "" : " apagada")} key={c.id}>
                  <button className="adm-cupon-cod" onClick={() => setEdit(c)}>{c.code}</button>
                  <button className="adm-fila-txt" onClick={() => setEdit(c)}>
                    <b>{textoCupon(c)}</b>
                    <small>
                      {prob ? prob.replace("Ese cupón ", "").replace(/^ya /, "Ya ") : c.expires_at ? `Vence el ${fechaLarga(c.expires_at)}` : "No vence"}
                      {" · "}Usado {c.uses} {c.uses === 1 ? "vez" : "veces"}{c.max_uses ? ` de ${c.max_uses}` : ""}
                    </small>
                  </button>
                  <div className="adm-fila-acc"><Interruptor checked={c.active} onChange={(v) => activar(c, v)} label={c.active ? "Activo" : "Pausado"} /></div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {edit && <EditorCupon c={edit} onCerrar={() => setEdit(null)} onGuardado={() => { setEdit(null); datos.recargar(); }} />}
    </>
  );
}

function EditorCupon({ c: c0, onCerrar, onGuardado }) {
  const { db, toast, confirmar } = useAdm();
  const [c, setC] = useState({ ...c0, value: c0.value ?? "", max_uses: c0.max_uses ?? "", expires_at: c0.expires_at || "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setC((x) => ({ ...x, [k]: v }));

  const guardar = async () => {
    setErr("");
    const code = normalizarCodigo(c.code);
    const value = parseInt(c.value, 10);
    if (code.length < 3) return setErr("El código tiene que tener al menos 3 letras o números.");
    if (!(value > 0)) return setErr("Poné cuánto descuenta.");
    if (c.kind === "porcentaje" && value > 90) return setErr("El porcentaje no puede pasar de 90%.");
    const row = { code, kind: c.kind, value, expires_at: c.expires_at || null, max_uses: c.max_uses ? parseInt(c.max_uses, 10) : null, active: c.active };
    setBusy(true);
    const { error } = c.id ? await db.from("coupons").update(row).eq("id", c.id) : await db.from("coupons").insert(row);
    setBusy(false);
    if (error) return setErr(/duplicate/.test(error.message) ? "Ya hay un cupón con ese código." : mensajeError(error));
    toast(`Cupón ${code} guardado ✓`);
    onGuardado();
  };
  const borrar = async () => {
    if (!(await confirmar({ titulo: `¿Borrar el cupón ${c.code}?`, texto: "Deja de funcionar al instante. Los pedidos que ya lo usaron no cambian." }))) return;
    const { error } = await db.from("coupons").delete().eq("id", c.id);
    if (error) return setErr(mensajeError(error));
    toast("Cupón borrado");
    onGuardado();
  };
  const ejemplo = parseInt(c.value, 10) > 0 ? (c.kind === "porcentaje" ? `En una compra de $ 20.000, descuenta $ ${Math.round((20000 * parseInt(c.value, 10)) / 100).toLocaleString("es-AR")}.` : `Descuenta $ ${parseInt(c.value, 10).toLocaleString("es-AR")} del total (nunca más que la compra).`) : "";

  return (
    <Hoja titulo={c.id ? "Editar cupón" : "Nuevo cupón"} onCerrar={onCerrar} cancelar="Cancelar"
      accion={<button className="azul" onClick={guardar} disabled={busy}>Guardar</button>}>
      <div className="adm-grupo campos">
        <label>Código<input className="mono grande" value={c.code} onChange={(e) => set("code", normalizarCodigo(e.target.value))} placeholder="ej: BIENVENIDA" autoCapitalize="characters" /></label>
      </div>
      <p className="adm-label">Tipo de descuento</p>
      <Segmento valor={c.kind} onChange={(v) => set("kind", v)} opciones={[["porcentaje", "Porcentaje (%)"], ["monto", "Monto fijo ($)"]]} />
      <div className="adm-grupo campos">
        <label>{c.kind === "porcentaje" ? "Porcentaje" : "Monto en pesos"}
          <input inputMode="numeric" value={c.value} onChange={(e) => set("value", e.target.value.replace(/\D/g, ""))} placeholder={c.kind === "porcentaje" ? "ej: 10" : "ej: 3000"} />
        </label>
        {ejemplo && <p className="adm-ayuda">{ejemplo}</p>}
        <div className="adm-dos">
          <label>Vence el <small>(opcional)</small><input type="date" value={c.expires_at} onChange={(e) => set("expires_at", e.target.value)} /></label>
          <label>Límite de usos <small>(opcional)</small><input inputMode="numeric" value={c.max_uses} onChange={(e) => set("max_uses", e.target.value.replace(/\D/g, ""))} placeholder="sin límite" /></label>
        </div>
      </div>
      <div className="adm-grupo">
        <label className="adm-check"><span>Activo</span><Interruptor checked={c.active} onChange={(v) => set("active", v)} label="Activo" /></label>
      </div>
      {c.id && <p className="adm-ayuda centro">Se usó {c.uses} {c.uses === 1 ? "vez" : "veces"}{c.max_uses ? ` de ${c.max_uses} posibles` : ""} (cuentan los pagos aprobados; si un pago se devuelve, el uso se libera).</p>}
      {err && <p className="adm-err" role="alert">{err}</p>}
      {c.id && <button className="adm-btn rojo" onClick={borrar}>Borrar cupón</button>}
    </Hoja>
  );
}
