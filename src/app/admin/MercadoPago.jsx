"use client";
import { useCallback, useEffect, useState } from "react";
import { useAdm, Titulo, Esqueleto, ErrorCarga, Interruptor, hace } from "./ui";

// =====================================================================
//  Ajustes → Mercado Pago. El dueño carga sus credenciales solo, sin pasárselas a nadie.
//  Lo que se pega acá viaja una sola vez al servidor, se guarda cifrado y NUNCA vuelve:
//  la pantalla solo conoce «•••• 1234» y la fecha (ver api/admin/mercadopago).
// =====================================================================

const LINKS = {
  integraciones: "https://www.mercadopago.com.ar/developers/panel/app",
  checkoutPro: "https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/landing",
  credenciales: "https://www.mercadopago.com.ar/developers/es/docs/your-integrations/credentials",
  webhooks: "https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks",
};

const NOMBRES = { mp_access_token: "Access Token", mp_webhook_secret: "Clave secreta del webhook", mp_modo_prueba: "Modo prueba" };
const ACCIONES = { mp_webhook_secret: { cargado: "cargada", cambiado: "cambiada" } }; // «la clave… cargada»
const accion = (c) => ACCIONES[c.proveedor]?.[c.accion] || c.accion;

const AVISAR = "Avisale a quien te hizo la tienda.";
const PROBLEMA = {
  falta_clave: "Hay una guardada, pero falta CREDENCIALES_KEY en Vercel para leerla.",
  clave_invalida: "CREDENCIALES_KEY no es válida: la guardada no se puede leer.",
  otra_clave: "Se guardó con otra CREDENCIALES_KEY y ya no se puede leer: pegala de nuevo.",
  formato: "La guardada está dañada: pegala de nuevo.",
  no_descifra: "La guardada no se puede leer: pegala de nuevo.",
};

// Lo que ve el dueño (sin nombrar variables ni Vercel)
const PROBLEMA_SIMPLE = {
  falta_clave: `Hay una guardada, pero falta un ajuste técnico para leerla. ${AVISAR}`,
  clave_invalida: `Hay una guardada, pero un ajuste técnico está mal y no se puede leer. ${AVISAR}`,
  otra_clave: "La guardada ya no se puede leer: pegala de nuevo.",
};

const dia = (iso) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "");
const diaHora = (iso) => (iso ? new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) : "");

const Ic = ({ d, className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden><path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const CANDADO = "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2";
const OJO = "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";
const OJO_NO = "M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2";
const TILDE = "M5 12.5l4.5 4.5L19 7.5";
const ALERTA = "M12 8v5M12 16.5v.5M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z";
const ENCHUFE = "M9 7V3M15 7V3M6 7h12v4a6 6 0 0 1-12 0zM12 17v4";
export const TARJETA = "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h4";

export default function MercadoPago({ onVolver }) {
  const { api, toast, confirmar, session } = useAdm();
  const [s, setS] = useState(null);
  const [token, setToken] = useState("");
  const [secreto, setSecreto] = useState("");
  const [vuelta, setVuelta] = useState(0); // al guardar, los campos se rearman (y se vuelven a ocultar)
  const [pidiendo, setPidiendo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [probando, setProbando] = useState(false);
  const [modoBusy, setModoBusy] = useState(false);

  const cargar = useCallback(async () => setS(await api("admin/mercadopago")), [api]);
  useEffect(() => { cargar(); }, [cargar]);

  const listo = s && !s.error;
  const puedeGuardar = listo && s.clave === "ok" && s.tabla === true;
  const hayAlgo = Boolean(token.trim() || secreto.trim());

  // Guarda con la contraseña ya escrita. Devuelve un texto si hay que mostrarlo en la ventanita.
  const guardar = async (clave, confirmarPrueba = false) => {
    setBusy(true);
    const r = await api("admin/mercadopago", "POST", {
      accion: "guardar", clave, confirmarPrueba,
      ...(token.trim() ? { token: token.trim() } : {}),
      ...(secreto.trim() ? { secreto: secreto.trim() } : {}),
    });
    setBusy(false);
    if (r.error) {
      if (r.status === 403 && r.clave) return r.error; // contraseña incorrecta: queda abierta
      setPidiendo(false);
      toast(r.error, { dur: 6000 });
      return null;
    }
    if (r.necesitaConfirmar === "prueba") {
      setPidiendo(false);
      const apagado = !s.modo.activo;
      const ok = await confirmar({
        titulo: "⚠︎ Es una cuenta de PRUEBA",
        texto: `${r.cuenta.texto || "Esa cuenta"} es un usuario de prueba de Mercado Pago: NO cobra plata real.${apagado ? " Con el modo prueba apagado, nadie va a poder pagar en la tienda." : ""} ¿La guardás igual?`,
        si: "Guardar igual",
        no: "No, cancelar",
      });
      if (ok) return guardar(clave, true);
      return null;
    }
    setPidiendo(false);
    setToken("");
    setSecreto("");
    setVuelta((v) => v + 1);
    setS(r.estado);
    const g = r.guardados || [];
    const que = g.length === 2 ? "Access Token y clave secreta guardados" : g[0] === "mp_access_token" ? "Access Token guardado" : "Clave secreta guardada";
    toast(`${que} ✓ Quedaron cifrados y no se vuelven a mostrar.`, { dur: 5000 });
    return null;
  };

  const probar = async () => {
    setProbando(true);
    const r = await api("admin/mercadopago", "POST", { accion: "probar" });
    setProbando(false);
    if (r.error) return toast(r.error, { dur: 4500 });
    setS(r.estado);
    const e = r.estado;
    toast(
      e.conexion === "ok" ? `Conexión OK ✓ ${e.cuenta?.texto || ""}`
        : e.conexion === "invalido" ? "Mercado Pago rechaza el Access Token: pegá uno nuevo."
          : "Mercado Pago no respondió. Probá de nuevo en un ratito.",
      { dur: 4500 },
    );
  };

  const cambiarModo = async (activo) => {
    if (activo) {
      const real = s.cuenta && !s.cuenta.prueba;
      const ok = await confirmar({
        titulo: "¿Activar el modo prueba?",
        texto: real
          ? "La cuenta cargada es REAL: los pagos se van a cobrar igual, pero la tienda va a decir «no se cobra de verdad». Usalo solo con una cuenta de prueba."
          : "La tienda va a mostrar la franja «Modo prueba: no se cobra de verdad».",
        si: "Activar",
        peligro: real ? undefined : false,
      });
      if (!ok) return;
    }
    setModoBusy(true);
    const r = await api("admin/mercadopago", "POST", { accion: "modo", activo });
    setModoBusy(false);
    if (r.error) return toast(r.error, { dur: 5000 });
    setS(r.estado);
    toast(activo ? "Modo prueba activado: la tienda muestra la franja" : "Modo prueba apagado ✓ La tienda cobra de verdad");
  };

  return (
    <div className="mp">
      <button className="mp-volver" onClick={onVolver}><span aria-hidden>‹</span> Ajustes</button>
      <Titulo>Mercado Pago</Titulo>
      {!s ? (
        <Esqueleto filas={4} alto={64} />
      ) : s.error ? (
        <ErrorCarga error={s.error} reintentar={() => { setS(null); cargar(); }} />
      ) : (
        <div className="mp-cols">
          <div className="mp-col">
            <EstadoConexion s={s} onProbar={probar} probando={probando} />

            <p className="adm-label">Credenciales de producción</p>
            <Alertas s={s} />
            <div className="adm-lista mp-creds">
              <Credencial key={"t" + vuelta} id="mp-token" titulo="Access Token de producción" info={s.token} variable="MP_ACCESS_TOKEN" soporte={s.soporte}
                valor={token} onChange={setToken} disabled={!puedeGuardar || busy} placeholder="APP_USR-…" />
              <Credencial key={"s" + vuelta} id="mp-secreto" titulo="Clave secreta del webhook" info={s.secreto} variable="MP_WEBHOOK_SECRET" soporte={s.soporte}
                valor={secreto} onChange={setSecreto} disabled={!puedeGuardar || busy} placeholder="La que da Mercado Pago en Webhooks" />
            </div>
            <button className="adm-btn negro mp-guardar" disabled={!puedeGuardar || !hayAlgo || busy} onClick={() => setPidiendo(true)}>
              {busy ? "Verificando con Mercado Pago…" : "Guardar"}
            </button>
            <p className="mp-candado"><Ic d={CANDADO} />Se guardan cifradas y solo las lee el servidor. Una vez guardadas no se vuelven a mostrar: para cambiarlas, pegalas de nuevo. Antes de guardar te pedimos tu contraseña del panel.</p>

            <p className="adm-label">Modo prueba</p>
            <Modo s={s} onCambiar={cambiarModo} busy={modoBusy} />
          </div>

          <div className="mp-col">
            <p className="adm-label mp-label-arriba">Aviso de pagos (webhook)</p>
            <Webhook s={s} toast={toast} />

            <Guia abierta={s.conexion !== "ok" || !s.secreto.fuente} />

            <p className="adm-label">Registro de cambios</p>
            <Registro cambios={s.cambios} />
          </div>
        </div>
      )}
      {pidiendo && <PedirClave email={session.user.email} onCancelar={() => !busy && setPidiendo(false)} onConfirmar={guardar} />}
    </div>
  );
}

// ---------- Estado de arriba: verde / amarillo / gris / rojo ----------
function EstadoConexion({ s, onProbar, probando }) {
  const c = s.cuenta;
  const hay = Boolean(s.token.fuente);
  let tono, icono, titulo, texto;
  if (!hay) {
    tono = "gris"; icono = ENCHUFE; titulo = "Sin conectar";
    texto = "Cargá el Access Token y la clave secreta del webhook para cobrar con Mercado Pago. Mientras tanto, los clientes compran con «Copiar pedido» o DM.";
  } else if (s.conexion === "invalido") {
    tono = "rojo"; icono = ALERTA; titulo = "El Access Token no funciona";
    texto = "Mercado Pago lo rechaza (¿lo regeneraron o se borró la aplicación?). Pegá uno nuevo abajo.";
  } else if (c?.prueba) {
    tono = "amarillo"; icono = ALERTA;
    titulo = <>Cuenta de PRUEBA{c.apodo ? <> (<span className="mp-apodo">{c.apodo}</span>)</> : null}</>;
    texto = "No cobra plata real.";
  } else if (c) {
    tono = "verde"; icono = TILDE; titulo = "Conectado a la cuenta de";
    texto = <b className="mp-cuenta">{c.texto || `ID ${c.id}`}</b>;
  } else {
    tono = "gris"; icono = ALERTA; titulo = "No pudimos consultar a Mercado Pago";
    texto = "Probá de nuevo en un ratito.";
  }
  const datos = [
    c?.id && `ID ${c.id}`,
    s.token.fuente === "panel" ? "cargado en el panel" : s.token.fuente === "vercel" ? (s.soporte ? "desde las variables de Vercel" : "configurado por tu desarrollador") : null,
    s.conexion === "sin_respuesta" && c?.guardada && "Mercado Pago no respondió: son los datos guardados",
  ].filter(Boolean);
  return (
    <section className={"mp-estado " + tono} aria-live="polite">
      <span className="mp-estado-ic"><Ic d={icono} /></span>
      <div className="mp-estado-txt">
        <b className="mp-estado-titulo">{titulo}</b>
        <p>{texto}</p>
        {datos.length > 0 && <small>{datos.join(" · ")}</small>}
        {c?.prueba && s.conexion !== "invalido" && !s.modo.activo && <p className="mp-estado-falta">Con el modo prueba apagado, nadie va a poder pagar en la tienda.</p>}
        {hay && s.conexion === "ok" && !s.secreto.fuente && <p className="mp-estado-falta">Falta la clave secreta del webhook: sin ella los pedidos no pasan solos a «Pagado».</p>}
        {hay && <button className="adm-mini mp-probar" onClick={onProbar} disabled={probando}>{probando ? "Probando…" : "Probar conexión"}</button>}
      </div>
    </section>
  );
}

function Alertas({ s }) {
  if (s.errorBase) return <Alerta tono="rojo" titulo="No pudimos leer la base">Probá de nuevo en un ratito.</Alerta>;
  if (s.tabla === null) return <Alerta tono="rojo" titulo="Falta conectar la base de datos">Sin Supabase no se pueden guardar credenciales.</Alerta>;
  if (s.clave !== "ok" && !s.soporte) {
    return (
      <Alerta tono="rojo" titulo="Falta un ajuste técnico">
        Falta un ajuste técnico para guardar las claves. Avisale a quien te hizo la tienda.
        {(s.token.fuente === "vercel" || s.secreto.fuente === "vercel") && " Mientras tanto siguen valiendo las que ya están configuradas."}
      </Alerta>
    );
  }
  if (s.clave !== "ok") {
    return (
      <Alerta tono="rojo" titulo={s.clave === "falta" ? "Falta la clave del servidor" : "La clave del servidor no es válida"}>
        Para guardar credenciales hace falta la variable <code>CREDENCIALES_KEY</code> en Vercel{s.clave === "invalida" ? " (32 bytes en base64)" : ""}. Pedile a quien maneja Vercel que la {s.clave === "falta" ? "cree" : "corrija"} (README → «Mercado Pago desde el panel») y haga Redeploy.
        {(s.token.fuente === "vercel" || s.secreto.fuente === "vercel") && " Mientras tanto se usan las variables de Vercel."}
      </Alerta>
    );
  }
  if (s.tabla === false && !s.soporte) {
    return <Alerta tono="amarillo" titulo="Falta un ajuste técnico">Falta una actualización técnica para guardar las claves. Avisale a quien te hizo la tienda.</Alerta>;
  }
  if (s.tabla === false) {
    return <Alerta tono="amarillo" titulo="Falta actualizar la base">Corré <code>supabase/credenciales.sql</code> en Supabase → SQL Editor (README → «Mercado Pago desde el panel»).</Alerta>;
  }
  return null;
}

function Alerta({ tono = "amarillo", titulo, children }) {
  return (
    <div className={"mp-alerta " + tono} role="alert">
      <Ic d={ALERTA} />
      <span><b>{titulo}</b>{children}</span>
    </div>
  );
}

// ---------- Un campo de credencial ----------
function Credencial({ id, titulo, info, variable, soporte, valor, onChange, disabled, placeholder }) {
  const [ver, setVer] = useState(false);
  const g = info.guardado;
  let estado;
  if (info.fuente === "panel") estado = <span className="mp-guardada"><b>•••• {g.ultimos4}</b> · {dia(g.actualizado_en)}</span>;
  else if (info.fuente === "vercel") estado = <span className="mp-guardada vercel" title={soporte ? `Variable ${variable}` : undefined}>{soporte ? "Desde Vercel" : "Ya configurada"}</span>;
  else estado = <span className="mp-guardada falta">Sin cargar</span>;
  return (
    <div className="mp-cred">
      <div className="mp-cred-cab">
        <label htmlFor={id}>{titulo}</label>
        {estado}
      </div>
      {info.problema && <p className="mp-cred-problema">{(soporte ? PROBLEMA : PROBLEMA_SIMPLE)[info.problema] || "La guardada no se puede leer: pegala de nuevo."}</p>}
      <div className={"mp-secreto" + (disabled ? " off" : "")}>
        <input
          id={id} name={id} type={ver ? "text" : "password"} value={valor} onChange={(e) => onChange(e.target.value)}
          placeholder={info.fuente ? "Pegá uno nuevo para cambiarlo" : placeholder} disabled={disabled}
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          data-1p-ignore="" data-lpignore="true" data-bwignore="" data-form-type="other"
        />
        <button type="button" onClick={() => setVer((v) => !v)} disabled={disabled || !valor} aria-pressed={ver} aria-label={ver ? "Ocultar lo que escribí" : "Ver lo que escribí"} title={ver ? "Ocultar" : "Ver lo que escribí"}>
          <Ic d={ver ? OJO_NO : OJO} />
        </button>
      </div>
    </div>
  );
}

// ---------- Webhook: URL para copiar y último aviso ----------
function Webhook({ s, toast }) {
  const [copiada, setCopiada] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(s.webhookUrl);
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2200);
    } catch {
      toast("No se pudo copiar: mantené apretada la URL y copiala a mano.");
    }
  };
  const a = s.ultimoAviso;
  return (
    <div className="adm-lista">
      <div className="mp-url">
        <span className="mp-url-txt">
          <small>URL para pegar en Mercado Pago</small>
          {s.webhookUrl ? <code>{s.webhookUrl}</code> : <em>{s.soporte ? "Falta NEXT_PUBLIC_SITE_URL en Vercel" : "Falta un ajuste técnico. Avisale a quien te hizo la tienda."}</em>}
        </span>
        <button className="adm-mini" onClick={copiar} disabled={!s.webhookUrl}>{copiada ? "Copiada ✓" : "Copiar"}</button>
      </div>
      <div className="adm-salud-fila">
        <span className={"adm-tilde " + (!a ? "off" : a.firma_ok ? "si" : "no")} aria-hidden>{!a ? "–" : a.firma_ok ? "✓" : "✕"}</span>
        <span>
          <b>Último aviso de Mercado Pago</b>
          <small>
            {!a ? "Todavía no llegó ninguno. Después de guardar, en Mercado Pago tocá «Simular notificación»."
              : a.firma_ok ? `${hace(a.created_at)} · firma válida (${a.resultado})`
                : `${hace(a.created_at)} · firma inválida: revisá que la clave secreta sea la de esta aplicación, en modo productivo.`}
          </small>
        </span>
      </div>
    </div>
  );
}

// ---------- Modo prueba ----------
function Modo({ s, onCambiar, busy }) {
  const m = s.modo;
  const c = s.cuenta;
  return (
    <>
      <div className={"adm-caja" + (m.activo ? " vacaciones-on" : "")}>
        <label className="adm-check sin-fondo">
          <span>Modo prueba<small>La tienda muestra la franja «Modo prueba: no se cobra de verdad». Solo para probar con una cuenta de prueba.</small></span>
          <Interruptor checked={m.activo} onChange={onCambiar} label="Modo prueba" disabled={m.fuente === "vercel" || busy} />
        </label>
        {m.fuente === "vercel" && !s.soporte && <p className="mp-nota">El modo prueba lo controla tu desarrollador.</p>}
        {m.fuente === "vercel" && s.soporte && (
          <p className="mp-nota">Lo fija la variable <code>MP_MODO</code> de Vercel («{m.entorno}») y gana sobre este interruptor. Para manejarlo desde acá, borrala en Vercel y hacé Redeploy.</p>
        )}
      </div>
      {c?.prueba && !m.activo && s.conexion !== "invalido" && (
        <Alerta tono="rojo" titulo="Nadie va a poder pagar">La cuenta cargada es de prueba y el modo prueba está apagado: Mercado Pago no acepta tarjetas reales en una cuenta de prueba. Cargá el Access Token de producción de la cuenta del negocio (o activá el modo prueba para probar).</Alerta>
      )}
      {c && !c.prueba && m.activo && (
        <Alerta tono="amarillo" titulo="Ojo: la cuenta es real">Aunque la tienda diga «Modo prueba», los pagos se cobran de verdad.</Alerta>
      )}
    </>
  );
}

// ---------- Guía paso a paso ----------
function Guia({ abierta }) {
  return (
    <details className="mp-guia" open={abierta}>
      <summary>Cómo conectarlo, paso a paso</summary>
      <ol>
        <li>Entrá a <a href={LINKS.integraciones} target="_blank" rel="noreferrer">Tus integraciones ↗</a> con la cuenta de Mercado Pago <b>del negocio</b> y tocá <b>Crear aplicación</b>. Elegí pagos online con <a href={LINKS.checkoutPro} target="_blank" rel="noreferrer">Checkout Pro ↗</a>.</li>
        <li>En la aplicación, abrí <b>Credenciales de producción</b> y copiá el <b>Access Token</b> (empieza con <code>APP_USR-</code>). Pegalo acá. <a href={LINKS.credenciales} target="_blank" rel="noreferrer">¿Dónde está? ↗</a></li>
        <li>Andá a <b>Webhooks → Configurar notificaciones</b>, en <b>Modo productivo</b>. Pegá la URL de arriba, marcá el evento <b>Pagos</b> y guardá. <a href={LINKS.webhooks} target="_blank" rel="noreferrer">Guía de webhooks ↗</a></li>
        <li>Mercado Pago muestra una <b>clave secreta</b>: copiala y pegala acá en «Clave secreta del webhook». Tocá <b>Guardar</b>.</li>
        <li>Tocá <b>Probar conexión</b> y, en Mercado Pago, <b>Simular notificación</b>: en «Último aviso» tiene que decir <b>firma válida</b> (figura «ignorado» porque el pago simulado no existe).</li>
      </ol>
      <p className="mp-guia-pie">No le pases estas claves a nadie, ni por WhatsApp ni por mail: con el Access Token se puede operar tu cuenta. Cargalas vos acá.</p>
    </details>
  );
}

// ---------- Registro: quién y cuándo (nunca los valores) ----------
function Registro({ cambios }) {
  if (!cambios?.length) return <p className="adm-ayuda">Todavía no hay cambios. Acá va a quedar quién cambió cada credencial y cuándo (nunca los valores).</p>;
  return (
    <div className="adm-lista mp-registro">
      {cambios.map((c) => (
        <div className="mp-cambio" key={c.id}>
          <span className={"mp-cambio-ic " + (c.proveedor === "mp_modo_prueba" ? "modo" : "cred")}><Ic d={c.proveedor === "mp_modo_prueba" ? TARJETA : CANDADO} /></span>
          <span className="mp-cambio-txt">
            <b>{NOMBRES[c.proveedor] || c.proveedor} {accion(c)}</b>
            <small>{[c.ultimos4 && `•••• ${c.ultimos4}`, c.cuenta_nombre, c.es_prueba && "cuenta de prueba"].filter(Boolean).join(" · ")}</small>
            <small>{c.hecho_por} · {diaHora(c.hecho_en)}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------- Reautenticación: la contraseña del panel ----------
function PedirClave({ email, onCancelar, onConfirmar }) {
  const [clave, setClave] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onCancelar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCancelar]);
  const enviar = async (e) => {
    e.preventDefault();
    if (!clave || busy) return;
    setBusy(true);
    setErr("");
    const r = await onConfirmar(clave);
    setBusy(false);
    if (typeof r === "string") {
      setErr(r);
      setClave("");
    }
  };
  return (
    <div className="adm-capa centro" onClick={() => !busy && onCancelar()}>
      <form className="adm-alerta-ios mp-reauth" onClick={(e) => e.stopPropagation()} onSubmit={enviar} role="alertdialog" aria-label="Confirmá que sos vos">
        <div className="adm-alerta-txt">
          <span className="mp-reauth-ic"><Ic d={CANDADO} /></span>
          <b>Confirmá que sos vos</b>
          <p>Escribí la contraseña con la que entrás al panel. Después probamos el token con Mercado Pago antes de guardarlo.</p>
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
          <input
            type="password" name="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)}
            placeholder="Contraseña del panel" aria-label="Contraseña del panel" autoFocus disabled={busy}
          />
          {err && <p className="mp-reauth-err" role="alert">{err}</p>}
          <small>¿Entrás solo con el link al mail? Creá una contraseña en Ajustes → Cuenta.</small>
        </div>
        <div className="adm-alerta-btns">
          <button type="button" onClick={onCancelar} disabled={busy}>Cancelar</button>
          <button type="submit" className="fuerte" disabled={busy || !clave}>{busy ? "Verificando…" : "Confirmar"}</button>
        </div>
      </form>
    </div>
  );
}
