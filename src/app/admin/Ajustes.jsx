"use client";
import { useEffect, useState } from "react";
import { useAdm, useDatos, q, fechaLarga, hace, Titulo, Esqueleto, ErrorCarga, Interruptor, Segmento, mensajeError } from "./ui";

const TEXTOS = [
  ["tagline", "Frase de arriba de la tienda", 2],
  ["instagram", "Usuario de Instagram (sin @)", 1],
  ["whatsapp", "WhatsApp del negocio", 1],
  ["produccion", "Tiempo de producción general", 2],
  ["envio", "Texto sobre envíos (se ve al pagar)", 2],
];
const NEGOCIO = [
  ["negocio_nombre", "Nombre o razón social"],
  ["negocio_cuit", "CUIT"],
  ["negocio_direccion", "Dirección"],
];

export default function Ajustes() {
  const { db, session, toast, refrescarTienda } = useAdm();
  const datos = useDatos(async () => Object.fromEntries(((await q(db.from("settings").select("*"))) || []).map((r) => [r.key, r.value])), [db]);
  const [v, setV] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sucio, setSucio] = useState(false);
  useEffect(() => { if (datos.data) setV({ ...datos.data, vacaciones: { activo: false, vuelta: "", mensaje: "", ...(datos.data.vacaciones || {}) } }); }, [datos.data]);
  const set = (k, x) => { setV((s) => ({ ...s, [k]: x })); setSucio(true); };
  const setVac = (k, x) => set("vacaciones", { ...v.vacaciones, [k]: x });

  const guardar = async () => {
    if (v.vacaciones.activo && !v.vacaciones.vuelta) return toast("Poné la fecha en que vuelven de vacaciones");
    setBusy(true);
    const claves = [...TEXTOS.map(([k]) => k), ...NEGOCIO.map(([k]) => k)];
    const rows = [
      ...claves.map((k) => ({ key: k, value: String(v[k] ?? "").trim().replace(/^@/, k === "instagram" ? "" : "@") })),
      { key: "pedestal", value: v.pedestal || "travertino" },
      { key: "vacaciones", value: v.vacaciones },
    ];
    const { error } = await db.from("settings").upsert(rows);
    setBusy(false);
    if (error) return toast(mensajeError(error));
    await refrescarTienda();
    setSucio(false);
    toast("Ajustes guardados ✓ La tienda ya está actualizada");
  };

  return (
    <>
      <Titulo accion={<button className="adm-btn negro" onClick={guardar} disabled={!v || busy || !sucio}>{busy ? "Guardando…" : "Guardar"}</button>}>Ajustes</Titulo>
      {datos.error && !v ? (
        <ErrorCarga error={datos.error} reintentar={datos.recargar} />
      ) : !v ? (
        <Esqueleto filas={5} alto={52} />
      ) : (
        <>
          <p className="adm-label">Modo vacaciones</p>
          <div className={"adm-caja" + (v.vacaciones.activo ? " vacaciones-on" : "")}>
            <label className="adm-check sin-fondo">
              <span>Pausar las compras<small>La tienda se sigue viendo, con un cartel y la fecha de vuelta.</small></span>
              <Interruptor checked={v.vacaciones.activo} onChange={(x) => setVac("activo", x)} label="Modo vacaciones" />
            </label>
            {v.vacaciones.activo && (
              <div className="adm-grupo campos">
                <label>Volvemos el<input type="date" value={v.vacaciones.vuelta || ""} onChange={(e) => setVac("vuelta", e.target.value)} /></label>
                <label>Mensaje <small>(opcional)</small><input value={v.vacaciones.mensaje || ""} onChange={(e) => setVac("mensaje", e.target.value)} placeholder="Podés mirar todo y escribirnos; las compras vuelven a abrir a la vuelta." /></label>
                {v.vacaciones.vuelta && <p className="adm-ayuda">En la tienda se lee: «Estamos de vacaciones · volvemos el {fechaLarga(v.vacaciones.vuelta).replace(/ de \d{4}$/, "")}».</p>}
              </div>
            )}
          </div>

          <p className="adm-label">La tienda</p>
          <div className="adm-grupo campos">
            {TEXTOS.map(([k, t, filas]) => (
              <label key={k}>{t}
                {filas > 1
                  ? <textarea rows={filas} value={v[k] || ""} onChange={(e) => set(k, e.target.value)} />
                  : <input value={v[k] || ""} onChange={(e) => set(k, e.target.value)} placeholder={k === "whatsapp" ? "ej: 11 5555 5555" : ""} inputMode={k === "whatsapp" ? "tel" : undefined} />}
              </label>
            ))}
          </div>

          <p className="adm-label">Pedestal de la tienda <small>(cada pieza puede cambiarlo)</small></p>
          <Segmento valor={v.pedestal || "travertino"} onChange={(x) => set("pedestal", x)} opciones={[["travertino", "Travertino"], ["torno", "Torno de alfarero"]]} />

          <p className="adm-label">Datos del negocio <small>(van al pie de la tienda y al comprobante)</small></p>
          <div className="adm-grupo campos">
            {NEGOCIO.map(([k, t]) => (
              <label key={k}>{t}<input value={v[k] || ""} onChange={(e) => set(k, e.target.value)} inputMode={k === "negocio_cuit" ? "numeric" : undefined} placeholder={k === "negocio_cuit" ? "ej: 27-12345678-3" : ""} /></label>
            ))}
          </div>
          {sucio && <button className="adm-btn negro" onClick={guardar} disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button>}
        </>
      )}

      <EstadoTienda />
      <Administradores />

      <p className="adm-label">Cuenta</p>
      <MiClave />
      <div className="adm-lista">
        <a className="adm-fila-nav" href="/" target="_blank" rel="noreferrer">Ver la tienda<i aria-hidden>↗</i></a>
        <button className="adm-fila-nav rojo" onClick={() => db.auth.signOut()}>Cerrar sesión <small>({session.user.email})</small></button>
      </div>
    </>
  );
}

function MiClave() {
  const { db, toast } = useAdm();
  const [abierto, setAbierto] = useState(false);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const guardar = async (e) => {
    e.preventDefault();
    if (a.length < 8) return toast("La contraseña tiene que tener al menos 8 caracteres");
    if (a !== b) return toast("Las dos contraseñas no coinciden");
    setBusy(true);
    const { error } = await db.auth.updateUser({ password: a });
    setBusy(false);
    if (error) return toast(/different|same/i.test(error.message) ? "Elegí una contraseña distinta a la actual" : "No se pudo guardar la contraseña. Probá de nuevo.");
    setA(""); setB(""); setAbierto(false);
    toast("Contraseña guardada ✓ Ya podés entrar con mail y contraseña");
  };
  return (
    <>
      <div className="adm-lista">
        <button className="adm-fila-nav" onClick={() => setAbierto((x) => !x)} aria-expanded={abierto}>Crear / cambiar mi contraseña<i aria-hidden>{abierto ? "⌃" : "›"}</i></button>
      </div>
      {abierto && (
        <form className="adm-grupo campos" onSubmit={guardar}>
          <label>Contraseña nueva <small>(mínimo 8 caracteres)</small><input type="password" value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" /></label>
          <label>Repetila<input type="password" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" /></label>
          <button className="adm-btn negro" disabled={busy || !a || !b}>{busy ? "Guardando…" : "Guardar contraseña"}</button>
        </form>
      )}
    </>
  );
}

function EstadoTienda() {
  const { api, toast } = useAdm();
  const [s, setS] = useState(null);
  const [mandando, setMandando] = useState(false);
  const cargar = () => { setS(null); api("admin/estado").then(setS).catch(() => setS({ error: "No se pudo consultar" })); };
  useEffect(cargar, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  const mailPrueba = async () => {
    setMandando(true);
    const r = await api("admin/estado", "POST");
    setMandando(false);
    toast(r.error || "Mail de prueba enviado ✓ Revisá la casilla (y el spam).", { dur: 4500 });
  };

  let punto = "gris", titulo = "Consultando…", texto = "";
  if (s?.error) { punto = "rojo"; titulo = "No se pudo consultar"; texto = s.error; }
  else if (s) {
    punto = s.cobrando ? (s.prueba ? "amarillo" : "verde") : "rojo";
    titulo = s.cobrando ? (s.prueba ? "Modo prueba" : "Cobrando de verdad") : "Mercado Pago no está activo";
    texto = s.cobrando
      ? s.prueba ? "MP_MODO=prueba: la tienda muestra la franja «Modo prueba». Sacalo para cobrar de verdad." : "Los pagos se acreditan en tu Mercado Pago."
      : `Los clientes solo pueden comprar con «Copiar pedido» o DM.${s.faltan?.length ? ` Faltan en Vercel: ${s.faltan.join(", ")}.` : ""}`;
  }
  return (
    <>
      <p className="adm-label">Estado de la tienda</p>
      <div className="adm-caja adm-mp">
        <span className={"adm-semaforo " + punto} aria-hidden />
        <div><b>{titulo}</b>{texto && <p>{texto}</p>}</div>
        <button className="adm-mini" onClick={cargar}>Revisar</button>
      </div>
      {s?.checks && (
        <div className="adm-lista adm-salud">
          {s.checks.map((c) => (
            <div className="adm-salud-fila" key={c.titulo}>
              <span className={"adm-tilde " + (c.ok ? "si" : c.ok === false ? "no" : "off")} aria-label={c.ok ? "Bien" : c.ok === false ? "Falta" : "Opcional"}>{c.ok ? "✓" : c.ok === false ? "✕" : "–"}</span>
              <span><b>{c.titulo}</b><small>{c.texto}</small></span>
            </div>
          ))}
        </div>
      )}
      {s?.checks && (
        <p className="adm-ayuda">
          {s.ultimoAviso ? `Último aviso de Mercado Pago: ${hace(s.ultimoAviso.created_at)} (${s.ultimoAviso.resultado}).` : "Todavía no llegó ningún aviso de Mercado Pago."}
          {" "}Las claves nunca se muestran acá.
        </p>
      )}
      {s?.mails && <button className="adm-mini" onClick={mailPrueba} disabled={mandando}>{mandando ? "Mandando…" : "Mandar un mail de prueba"}</button>}
    </>
  );
}

function Administradores() {
  const { db, api, session, toast, confirmar } = useAdm();
  const datos = useDatos(() => q(db.from("admins").select("*").order("created_at")), [db]);
  const [mail, setMail] = useState("");
  const [busy, setBusy] = useState(false);
  const yo = session.user.email.toLowerCase();
  const list = datos.data || [];

  const invitar = async (e) => {
    e.preventDefault();
    const email = mail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Ese mail no parece válido");
    if (list.some((a) => a.email === email)) return toast("Ese mail ya es administrador");
    setBusy(true);
    const r = await api("admin/admins", "POST", { email });
    setBusy(false);
    if (r.error) return toast(r.error);
    setMail("");
    toast(r.aviso || "Listo ✓", { dur: 4500 });
    datos.recargar();
  };
  const quitar = async (a) => {
    if (list.length <= 1) return toast("No se puede quitar el último administrador.");
    const ok = await confirmar({ titulo: `¿Quitar a ${a.email}?`, texto: a.email === yo ? "Te vas a quedar sin acceso al panel." : "Ya no va a poder entrar al panel.", si: "Quitar" });
    if (!ok) return;
    const r = await api("admin/admins", "DELETE", { email: a.email });
    if (r.error) return toast(r.error);
    toast("Administrador quitado");
    if (a.email === yo) return db.auth.signOut();
    datos.recargar();
  };

  return (
    <>
      <p className="adm-label">Administradores</p>
      {datos.error ? <ErrorCarga error={datos.error} reintentar={datos.recargar} /> : !datos.data ? <Esqueleto filas={2} alto={48} /> : (
        <div className="adm-lista">
          {list.map((a) => (
            <div className="adm-fila admin" key={a.email}>
              <span className="adm-avatar" aria-hidden>{a.email[0].toUpperCase()}</span>
              <span className="adm-fila-txt"><b>{a.email}</b><small>{a.email === yo ? "Vos" : a.created_at ? `Desde el ${fechaLarga(a.created_at)}` : ""}</small></span>
              <button className="adm-link rojo" onClick={() => quitar(a)} disabled={list.length <= 1} title={list.length <= 1 ? "Es el único administrador" : "Quitar"}>Quitar</button>
            </div>
          ))}
        </div>
      )}
      <form className="adm-invitar" onSubmit={invitar}>
        <input type="email" value={mail} onChange={(e) => setMail(e.target.value)} placeholder="mail de la persona a invitar" aria-label="Mail a invitar" />
        <button className="adm-btn negro" disabled={busy || !mail}>{busy ? "Invitando…" : "Invitar"}</button>
      </form>
      <p className="adm-ayuda">Le llega un mail con un link para entrar. Puede ver y cambiar todo el panel.</p>
    </>
  );
}
