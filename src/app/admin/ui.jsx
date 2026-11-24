"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
import { numPedido } from "@/lib/precios";

// =====================================================================
//  Piezas compartidas del panel: contexto, hojas, esqueletos, vacíos,
//  confirmaciones y formatos. Estilo iOS, todo en castellano simple.
// =====================================================================

export const Ctx = createContext(null);
export const useAdm = () => useContext(Ctx);

export { money, numPedido };

export const ETIQUETA_ESTADO = {
  pendiente: "Pendiente", pagado: "Pagado", "en produccion": "En producción", enviado: "Enviado",
  entregado: "Entregado", cancelado: "Cancelado", rechazado: "Pago rechazado", devuelto: "Devuelto",
};
export const PASOS = ["pendiente", "pagado", "en produccion", "enviado", "entregado"];

export const fecha = (iso, conHora = false) =>
  iso ? new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}) }) : "";
export const fechaLarga = (iso) => (iso ? new Date(iso.length === 10 ? iso + "T12:00" : iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }) : "");
export function hace(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

export function Estado({ s }) {
  return <span className={"adm-estado e-" + String(s).replace(" ", "-")}>{ETIQUETA_ESTADO[s] || s}</span>;
}

export function Interruptor({ checked, onChange, label, disabled }) {
  return (
    <label className={"adm-switch" + (disabled ? " off" : "")} title={label}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} disabled={disabled} />
      <span />
    </label>
  );
}

export function Segmento({ valor, opciones, onChange }) {
  return (
    <div className="adm-segmento" role="radiogroup">
      {opciones.map(([v, t]) => (
        <button key={v} role="radio" aria-checked={valor === v} className={valor === v ? "on" : ""} onClick={() => onChange(v)}>{t}</button>
      ))}
    </div>
  );
}

export function Buscador({ valor, onChange, placeholder = "Buscar" }) {
  return (
    <label className="adm-buscador">
      <svg viewBox="0 0 20 20" aria-hidden><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      <input type="search" value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {valor && <button onClick={() => onChange("")} aria-label="Borrar búsqueda">×</button>}
    </label>
  );
}

export function Filtros({ valor, opciones, onChange }) {
  return (
    <div className="adm-filtros">
      {opciones.map(([v, t, n]) => (
        <button key={v} className={valor === v ? "on" : ""} onClick={() => onChange(v)}>
          {t}{n != null && <i>{n}</i>}
        </button>
      ))}
    </div>
  );
}

export function Titulo({ children, accion }) {
  return (
    <div className="adm-titulo">
      <h2>{children}</h2>
      {accion}
    </div>
  );
}

// Esqueleto de carga: filas grises que "respiran"
export function Esqueleto({ filas = 5, alto = 56, tarjetas = 0 }) {
  return (
    <div aria-busy="true" aria-label="Cargando">
      {tarjetas > 0 && (
        <div className="adm-tarjetas">
          {Array.from({ length: tarjetas }, (_, i) => <div key={i} className="adm-tarjeta esq" style={{ height: 92 }} />)}
        </div>
      )}
      <div className="adm-lista">
        {Array.from({ length: filas }, (_, i) => (
          <div key={i} className="adm-esq-fila" style={{ height: alto }}>
            <i className="esq" style={{ width: alto - 16, height: alto - 16 }} />
            <span><i className="esq" style={{ width: `${55 + ((i * 17) % 30)}%` }} /><i className="esq" style={{ width: "35%" }} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Vacio({ icono = "✦", titulo, texto, accion }) {
  return (
    <div className="adm-vacio">
      <span className="adm-vacio-icono" aria-hidden>{icono}</span>
      <b>{titulo}</b>
      {texto && <p>{texto}</p>}
      {accion}
    </div>
  );
}

export function ErrorCarga({ error, reintentar }) {
  return (
    <Vacio icono="⚠︎" titulo="No pudimos cargar esto" texto={mensajeError(error)}
      accion={reintentar && <button className="adm-mini" onClick={reintentar}>Probar de nuevo</button>} />
  );
}

// Errores en castellano (nada de jerga)
export function mensajeError(e) {
  const m = String(e?.message || e || "");
  if (/duplicate|23505/i.test(m)) return "Ya existe uno igual. Cambiá el nombre o el código.";
  if (/fetch|network|Failed/i.test(m)) return "Parece que no hay conexión. Revisá internet y probá de nuevo.";
  if (/permission|policy|JWT|not authorized|401/i.test(m)) return "Tu sesión venció o no tenés permiso. Salí y volvé a entrar.";
  if (/does not exist|column|relation/i.test(m)) return "Falta actualizar la base de datos: corré de nuevo supabase/schema.sql (ver README).";
  return m || "Algo salió mal. Probá de nuevo.";
}

// Hoja que sube desde abajo (en compu, ventana centrada)
export function Hoja({ titulo, onCerrar, cancelar = "Cerrar", accion, children, ancha }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onCerrar?.();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [onCerrar]);
  return (
    <div className="adm-capa" onClick={onCerrar}>
      <div className={"adm-hoja" + (ancha ? " ancha" : "")} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <div className="adm-hoja-head">
          <button onClick={onCerrar}>{cancelar}</button>
          <b>{titulo}</b>
          {accion || <span style={{ width: 60 }} />}
        </div>
        <div className="adm-hoja-cuerpo">{children}</div>
      </div>
    </div>
  );
}

// Confirmación tipo iOS: const ok = await confirmar({ titulo, texto, si: "Borrar" })
export function useConfirmar() {
  const [p, setP] = useState(null);
  const res = useRef(null);
  const confirmar = useCallback((o) => new Promise((ok) => { res.current = ok; setP(o); }), []);
  const cerrar = (v) => { res.current?.(v); setP(null); };
  const ui = p && (
    <div className="adm-capa centro" onClick={() => cerrar(false)}>
      <div className="adm-alerta-ios" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label={p.titulo}>
        <div className="adm-alerta-txt">
          <b>{p.titulo}</b>
          {p.texto && <p>{p.texto}</p>}
        </div>
        <div className="adm-alerta-btns">
          <button onClick={() => cerrar(false)}>{p.no || "Cancelar"}</button>
          <button className={p.peligro === false ? "fuerte" : "rojo"} onClick={() => cerrar(true)} autoFocus>{p.si || "Borrar"}</button>
        </div>
      </div>
    </div>
  );
  return [confirmar, ui];
}

// Carga de datos con estados: { data, error, cargando, recargar }
export function useDatos(fn, deps = []) {
  const [st, setSt] = useState({ data: null, error: null, cargando: true });
  const vivo = useRef(true);
  const correr = useCallback(async () => {
    setSt((s) => ({ ...s, cargando: true, error: null }));
    try {
      const data = await fn();
      if (vivo.current) setSt({ data, error: null, cargando: false });
    } catch (error) {
      if (vivo.current) setSt((s) => ({ ...s, error, cargando: false }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    vivo.current = true;
    correr();
    return () => { vivo.current = false; };
  }, [correr]);
  return { ...st, recargar: correr };
}

// supabase devuelve { data, error }: esto tira el error para que lo agarre useDatos
export async function q(promesa) {
  const { data, error, count } = await promesa;
  if (error) throw error;
  return count != null && data == null ? count : data;
}

// Descarga un archivo generado en el navegador
export function descargar(nombre, contenido, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
