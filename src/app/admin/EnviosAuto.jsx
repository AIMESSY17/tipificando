"use client";
import { useEffect, useState } from "react";
import { PROVINCIAS, MODALIDADES, cfgEnvio, precioFinal, demoraTexto, tieneMedidas } from "@/lib/envio";
import { useAdm, useDatos, q, money, Esqueleto, ErrorCarga, Segmento, mensajeError } from "./ui";

// Ajustes de la cotización automática de Andreani (vía Zipnova), simulador y tabla de respaldo.
// El factor y el margen son privados: se guardan en settings (envio_cfg) y solo los ve el panel y el servidor.
const numero = (v) => String(v ?? "").replace(",", ".");

export default function EnviosAuto() {
  const { db, toast, refrescarTienda } = useAdm();
  const datos = useDatos(async () => {
    const [rows, prods] = await Promise.all([
      q(db.from("settings").select("*").in("key", ["envio_cfg", "envio_respaldo"])),
      q(db.from("products").select("id,name,weight_g,height_cm,width_cm,length_cm").order("sort")),
    ]);
    const m = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
    return { cfg: cfgEnvio(m.envio_cfg), respaldo: m.envio_respaldo || {}, prods: prods || [] };
  }, [db]);
  const [cfg, setCfg] = useState(null);
  const [resp, setResp] = useState({});
  const [sucio, setSucio] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (datos.data) { setCfg(datos.data.cfg); setResp(datos.data.respaldo); }
  }, [datos.data]);
  const set = (k, v) => { setCfg((c) => ({ ...c, [k]: v })); setSucio(true); };
  const setResp1 = (prov, mod, v) => {
    setResp((r) => {
      const fila = { ...(r[prov] || {}), [mod]: v.replace(/\D/g, "") };
      return { ...r, [prov]: fila };
    });
    setSucio(true);
  };

  // lo que se guarda: números (el panel escribe texto)
  const cfgLimpia = () => cfgEnvio({ ...cfg, factor: numero(cfg.factor), margen: numero(cfg.margen) });
  const respLimpio = () => {
    const out = {};
    for (const [prov, f] of Object.entries(resp)) {
      const dom = parseInt(f.domicilio, 10), suc = parseInt(f.sucursal, 10);
      if (dom > 0 || suc > 0) out[prov] = { ...(dom > 0 ? { domicilio: dom } : {}), ...(suc > 0 ? { sucursal: suc } : {}) };
    }
    return out;
  };

  const guardar = async () => {
    setBusy(true);
    const { error } = await db.from("settings").upsert([{ key: "envio_cfg", value: cfgLimpia() }, { key: "envio_respaldo", value: respLimpio() }]);
    setBusy(false);
    if (error) return toast(mensajeError(error));
    await refrescarTienda();
    setCfg(cfgLimpia());
    setSucio(false);
    toast("Ajustes de envío guardados ✓");
  };

  if (datos.error && !datos.data) return <ErrorCarga error={datos.error} reintentar={datos.recargar} />;
  if (!cfg) return <Esqueleto filas={2} alto={52} />;
  const sinMedidas = datos.data.prods.filter((p) => !tieneMedidas(p));
  const c = cfgEnvio({ ...cfg, factor: numero(cfg.factor), margen: numero(cfg.margen) });

  return (
    <>
      <p className="adm-label">Cotización automática de Andreani</p>
      <p className="adm-ayuda">Cuando el cliente elige «Envío por Andreani», el costo se calcula solo con su código postal. Usamos Zipnova únicamente para cotizar: el envío real lo despachás vos con tu cuenta de Andreani.</p>
      {sinMedidas.length > 0 && (
        <div className="adm-alerta">Faltan peso o medidas en {sinMedidas.length} {sinMedidas.length === 1 ? "pieza" : "piezas"} ({sinMedidas.map((p) => p.name).join(", ")}). Sin eso no se puede cotizar: cargalos en Piezas.</div>
      )}

      <p className="adm-label">Transporte de referencia</p>
      <Segmento valor={cfg.referencia} onChange={(v) => set("referencia", v)} opciones={[["andreani", "Andreani, si no el más barato"], ["barato", "Siempre el más barato"]]} />
      <div className="adm-grupo campos">
        <div className="adm-dos">
          <label>Factor de ajuste<input inputMode="decimal" value={cfg.factor} onChange={(e) => set("factor", e.target.value.replace(/[^\d.,]/g, ""))} /></label>
          <label>Margen de seguridad (%)<input inputMode="decimal" value={cfg.margen} onChange={(e) => set("margen", e.target.value.replace(/[^\d.,]/g, ""))} /></label>
        </div>
        <div className="adm-dos">
          <label>Redondear a <small>($, 0 = no)</small><input inputMode="numeric" value={cfg.redondeo} onChange={(e) => set("redondeo", e.target.value.replace(/\D/g, ""))} /></label>
          <label>Envío gratis desde <small>($, 0 = nunca)</small><input inputMode="numeric" value={cfg.gratis_desde || ""} placeholder="0" onChange={(e) => set("gratis_desde", e.target.value.replace(/\D/g, ""))} /></label>
        </div>
        <p className="adm-ayuda">Precio al cliente = precio de referencia × factor × (1 + margen) → redondeado. Ej: referencia $10.000 con factor {c.factor} y margen {c.margen}% → <b>{money(precioFinal(10000, c))}</b>.</p>
      </div>

      <details className="adm-detalles">
        <summary>Tabla de respaldo por provincia <small>(se usa solo si Zipnova no responde)</small></summary>
        <p className="adm-ayuda">Poné el precio FINAL que paga el cliente (no se le aplica factor ni margen). Si dejás una provincia vacía y Zipnova falla, el cliente ve «Envío a coordinar».</p>
        <div className="adm-respaldo">
          <span /><b>A domicilio</b><b>A sucursal</b>
          {PROVINCIAS.map((p) => (
            <div key={p} className="adm-respaldo-fila">
              <span>{p}</span>
              <input inputMode="numeric" placeholder="$" value={resp[p]?.domicilio ?? ""} onChange={(e) => setResp1(p, "domicilio", e.target.value)} aria-label={`${p}, a domicilio`} />
              <input inputMode="numeric" placeholder="$" value={resp[p]?.sucursal ?? ""} onChange={(e) => setResp1(p, "sucursal", e.target.value)} aria-label={`${p}, a sucursal`} />
            </div>
          ))}
        </div>
      </details>

      <button className="adm-btn negro" onClick={guardar} disabled={busy || !sucio}>{busy ? "Guardando…" : sucio ? "Guardar ajustes de envío" : "Ajustes guardados"}</button>

      <Simulador cfg={c} prods={datos.data.prods} />
    </>
  );
}

function Simulador({ cfg, prods }) {
  const { api } = useAdm();
  const [d, setD] = useState({ provincia: "Santa Fe", localidad: "Rosario", cp: "2000" });
  const [lineas, setLineas] = useState([{ id: prods[0]?.id || "", qty: 1 }]);
  const [r, setR] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const setL = (i, patch) => setLineas((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const correr = async () => {
    setErr(""); setR(null); setBusy(true);
    const j = await api("admin/envio-simulador", "POST", { destino: d, items: lineas.filter((l) => l.id), cfg });
    setBusy(false);
    if (j.error) return setErr(j.error);
    setR(j);
  };

  return (
    <>
      <p className="adm-label">Simulador <small>(para calibrar el factor)</small></p>
      <div className="adm-grupo campos">
        <label>Provincia
          <select value={d.provincia} onChange={(e) => setD({ ...d, provincia: e.target.value })}>
            {PROVINCIAS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <div className="adm-dos">
          <label>Localidad<input value={d.localidad} onChange={(e) => setD({ ...d, localidad: e.target.value })} /></label>
          <label>Código postal<input inputMode="numeric" value={d.cp} onChange={(e) => setD({ ...d, cp: e.target.value.slice(0, 8) })} /></label>
        </div>
        {lineas.map((l, i) => (
          <div className="adm-sim-linea" key={i}>
            <select value={l.id} onChange={(e) => setL(i, { id: e.target.value })} aria-label="Pieza">
              {prods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input inputMode="numeric" value={l.qty} onChange={(e) => setL(i, { qty: parseInt(e.target.value.replace(/\D/g, ""), 10) || 1 })} aria-label="Cantidad" />
            {lineas.length > 1 && <button className="adm-mini" onClick={() => setLineas((ls) => ls.filter((_, k) => k !== i))} aria-label="Quitar">×</button>}
          </div>
        ))}
        <button className="adm-mini" onClick={() => setLineas((ls) => [...ls, { id: prods[0]?.id || "", qty: 1 }])}>+ Otra pieza</button>
        <button className="adm-btn negro" onClick={correr} disabled={busy || !prods.length}>{busy ? "Cotizando…" : "Cotizar"}</button>
      </div>
      {err && <p className="adm-err" role="alert">{err}</p>}
      {r && (
        <>
          <p className="adm-label">Lo que devuelve Zipnova</p>
          <div className="adm-caja">
            {r.transportes.map((t, i) => (
              <div className="adm-dato" key={i}>
                <span>{t.transporte} · {t.modalidad}{t.min != null || t.max != null ? <small> · {demoraTexto(t.min, t.max)}</small> : null}{!t.seleccionable && <small> · no disponible</small>}</span>
                <b>{money(t.precio)}</b>
              </div>
            ))}
            {r.paquete?.peso_g > 0 && <p className="adm-ayuda">Paquete: {r.paquete.peso_g} g · {r.paquete.alto} × {r.paquete.ancho} × {r.paquete.largo} cm (alto × ancho × largo)</p>}
          </div>
          <p className="adm-label">Lo que vería el comprador</p>
          <div className="adm-caja">
            {Object.entries(r.referencias).map(([m, x]) => (
              <div key={m}>
                <div className="adm-dato"><span>{MODALIDADES[m]} · referencia ({x.carrier})</span><b>{money(x.ref)}</b></div>
                <div className="adm-dato"><span>Precio final al comprador</span><b>{money(x.final)}</b></div>
              </div>
            ))}
            {!Object.keys(r.referencias).length && <p className="adm-ayuda">Zipnova no devolvió opciones para ese destino.</p>}
          </div>
          <p className="adm-ayuda">Para calibrar: comparalo con el cotizador de Andreani. Si Andreani te cobra $A y la referencia es $R, probá con factor = A ÷ R (con margen 0) y después sumá el margen que quieras.</p>
        </>
      )}
    </>
  );
}
