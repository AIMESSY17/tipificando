"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browserDb } from "@/lib/supabase-browser";
import { Ctx, useConfirmar, numPedido, money } from "./ui";
import Inicio from "./Inicio";
import Piezas from "./Piezas";
import Pedidos, { DetallePedido } from "./Pedidos";
import Clientes from "./Clientes";
import Cupones from "./Cupones";
import Envios from "./Envios";
import Ajustes from "./Ajustes";
import { Logo } from "@/components/Logo";

export { Editor } from "./Piezas";

// Pestañas: en el celu van abajo (4 + "Más"); en compu, todas al costado
const TABS = [
  ["inicio", "Inicio", "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"],
  ["piezas", "Piezas", "M6 4h12l-1.2 13.2A3 3 0 0 1 13.8 20h-3.6a3 3 0 0 1-3-2.8zM5 4h14"],
  ["pedidos", "Pedidos", "M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2zM9 9h6M9 13h6"],
  ["clientes", "Clientes", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0"],
  ["cupones", "Cupones", "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM10 5v12"],
  ["envios", "Envíos", "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"],
  ["ajustes", "Ajustes", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 14H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.4 10H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"],
];
const MAS = ["cupones", "envios", "ajustes"];
const Icono = ({ d }) => (
  <svg viewBox="0 0 24 24" aria-hidden><path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export default function Admin() {
  const db = browserDb();

  const [session, setSession] = useState(null);
  const [ok, setOk] = useState(null); // null = cargando, true/false = es admin
  const [recuperando, setRecuperando] = useState(false); // volvió del mail de "olvidé mi contraseña"

  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY") setRecuperando(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!db || !session) return;
    db.from("admins").select("email").then(({ data }) => setOk(Boolean(data?.length)));
  }, [db, session]);

  // App instalable: service worker solo del panel
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" }).catch(() => {});
  }, []);

  if (!db) return <SinSupabase />;
  if (!session) return <Login db={db} />;
  if (recuperando) return <NuevaClave db={db} onListo={() => setRecuperando(false)} />;
  if (ok === null) return <div className="adm-centro"><span className="adm-logo grande"><Logo /></span><p className="adm-cargando">Entrando…</p></div>;
  if (!ok)
    return (
      <div className="adm-centro">
        <h1>Sin acceso</h1>
        <p>{session.user.email} no está cargado como administrador. Pedile a quien maneja el panel que te invite desde Ajustes.</p>
        <button className="adm-btn" onClick={() => db.auth.signOut()}>Salir</button>
      </div>
    );
  return <Panel db={db} session={session} />;
}

function Panel({ db, session }) {
  const [tab, setTab] = useState("inicio");
  const [pedido, setPedido] = useState(null); // id del pedido abierto
  const [version, setVersion] = useState(0); // sube cuando cambian los pedidos (para recargar listas)
  const [nuevos, setNuevos] = useState(0);
  const [aviso, setAviso] = useState(null);
  const [confirmar, uiConfirmar] = useConfirmar();
  const tAviso = useRef(0);

  const toast = useCallback((txt, extra = {}) => {
    clearTimeout(tAviso.current);
    setAviso({ txt, ...extra });
    tAviso.current = setTimeout(() => setAviso(null), extra.dur || 2600);
  }, []);

  const api = useCallback(async (path, method = "GET", body) => {
    const r = await fetch("/api/" + path, {
      method,
      headers: { Authorization: "Bearer " + session.access_token, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { error: j.error || "Algo salió mal. Probá de nuevo." };
    return j;
  }, [session]);

  const refrescarTienda = useCallback(() => api("revalidate", "POST").catch(() => {}), [api]);

  // Pedidos nuevos sin ver (para el numerito)
  const contarNuevos = useCallback(async () => {
    const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("seen", false);
    setNuevos(count || 0);
  }, [db]);
  useEffect(() => { contarNuevos(); }, [contarNuevos, version]);

  // Aviso en tiempo real cuando entra un pedido y cuando Mercado Pago confirma un pago
  const pagosAvisados = useRef(new Set());
  useEffect(() => {
    const ch = db
      .channel("pedidos-nuevos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p) => {
        const o = p.new;
        toast(`🛎️ Pedido nuevo ${numPedido(o.number)} · ${o.customer_name} · ${money(o.total)}`, { id: o.id, dur: 7000 });
        setVersion((v) => v + 1);
        try { navigator.vibrate?.(120); } catch {}
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (p) => {
        const o = p.new;
        // paid_at lo marca solo la base cuando Mercado Pago aprueba el pago
        const reciente = o.paid_at && Date.now() - new Date(o.paid_at).getTime() < 120000;
        if (o.status !== "pagado" || !reciente || pagosAvisados.current.has(o.id)) return;
        pagosAvisados.current.add(o.id);
        setVersion((v) => v + 1);
        toast(`💳 Pago confirmado ${numPedido(o.number)} · ${o.customer_name} · ${money(o.total)}`, { id: o.id, dur: 7000 });
        try { navigator.vibrate?.([80, 60, 80]); } catch {}
      })
      .subscribe();
    return () => db.removeChannel(ch);
  }, [db, toast]);

  useEffect(() => {
    document.title = (nuevos ? `(${nuevos}) ` : "") + "Panel · tipificado…|";
  }, [nuevos]);

  const ctx = useMemo(() => ({
    db, session, toast, confirmar, api, refrescarTienda, version,
    cambio: () => setVersion((v) => v + 1),
    abrirPedido: (id) => setPedido(id),
    irA: (t) => { setTab(t); window.scrollTo(0, 0); },
  }), [db, session, toast, confirmar, api, refrescarTienda, version]);

  const ir = (t) => { setTab(t); window.scrollTo(0, 0); };
  const tabMovil = MAS.includes(tab) ? "mas" : tab;

  return (
    <Ctx.Provider value={ctx}>
      <div className="adm">
        <nav className="adm-tabs" aria-label="Secciones">
          <span className="adm-logo adm-tabs-logo"><Logo /></span>
          {TABS.map(([k, t, d]) => (
            <button key={k} className={(tab === k ? "on " : "") + (MAS.includes(k) ? "solo-compu" : "")} onClick={() => ir(k)} aria-current={tab === k ? "page" : undefined}>
              <span className="adm-tab-ic"><Icono d={d} />{k === "pedidos" && nuevos > 0 && <em>{nuevos}</em>}</span>{t}
            </button>
          ))}
          <button className={"solo-celu " + (tabMovil === "mas" ? "on" : "")} onClick={() => ir("mas")}>
            <span className="adm-tab-ic"><Icono d="M5 12h.01M12 12h.01M19 12h.01" /></span>Más
          </button>
          <a className="adm-tabs-tienda solo-compu" href="/" target="_blank" rel="noreferrer">Ver la tienda ↗</a>
        </nav>
        <main className="adm-main">
          {tab === "inicio" && <Inicio />}
          {tab === "piezas" && <Piezas />}
          {tab === "pedidos" && <Pedidos />}
          {tab === "clientes" && <Clientes />}
          {tab === "cupones" && <Cupones />}
          {tab === "envios" && <Envios />}
          {tab === "ajustes" && <Ajustes />}
          {tab === "mas" && <Mas ir={ir} />}
        </main>
        {pedido && <DetallePedido id={pedido} onCerrar={() => setPedido(null)} />}
        {aviso && (
          <div className="adm-toast" role="status">
            <span>{aviso.txt}</span>
            {aviso.id && <button onClick={() => { setPedido(aviso.id); setAviso(null); }}>Ver</button>}
          </div>
        )}
        {uiConfirmar}
      </div>
    </Ctx.Provider>
  );
}

// "Más" en el celu: lista estilo Ajustes del iPhone
function Mas({ ir }) {
  return (
    <>
      <div className="adm-titulo"><h2>Más</h2></div>
      <div className="adm-lista">
        {TABS.filter(([k]) => MAS.includes(k)).map(([k, t, d]) => (
          <button key={k} className="adm-fila-nav" onClick={() => ir(k)}>
            <span className={"adm-ic-cuadro ic-" + k}><Icono d={d} /></span>{t}<i aria-hidden>›</i>
          </button>
        ))}
        <a className="adm-fila-nav" href="/" target="_blank" rel="noreferrer">
          <span className="adm-ic-cuadro ic-tienda"><Icono d="M4 9h16l-1-5H5zM5 9v11h14V9M9 20v-6h6v6" /></span>Ver la tienda<i aria-hidden>↗</i>
        </a>
      </div>
    </>
  );
}

function SinSupabase() {
  return (
    <div className="adm-centro adm-conectar">
      <span className="adm-logo grande"><Logo /></span>
      <h1>Falta conectar la base de datos</h1>
      <p>El panel guarda las piezas, los pedidos y los cupones en Supabase (gratis). Para activarlo:</p>
      <ol>
        <li>Creá un proyecto en <b>supabase.com</b>.</li>
        <li>En <b>SQL Editor</b>, corré <code>supabase/schema.sql</code> y después <code>supabase/seed.sql</code>.</li>
        <li>Cargá tu mail en la tabla <b>admins</b>.</li>
        <li>Copiá las claves en Vercel (o en <code>.env.local</code>): <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> y <code>SUPABASE_SERVICE_ROLE_KEY</code>.</li>
      </ol>
      <p className="adm-ayuda">Faltan en este sitio: {[!process.env.NEXT_PUBLIC_SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL", !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter(Boolean).join(" y ")}. Después de cargarlas en Vercel, hacé Redeploy.</p>
      <p className="adm-ayuda">El paso a paso completo está en el README, sección «Puesta en marcha».</p>
    </div>
  );
}

function Login({ db }) {
  const [modo, setModo] = useState("clave"); // clave | link | olvide
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const redirect = () => window.location.origin + "/admin";
  const go = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    if (modo === "clave") {
      const { error } = await db.auth.signInWithPassword({ email: email.trim(), password: clave });
      if (error) setErr("Mail o contraseña incorrectos. Si todavía no creaste una contraseña, entrá con el link al mail.");
    } else {
      const { error } = modo === "olvide"
        ? await db.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect() })
        : await db.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect() } });
      if (error) setErr(/rate|limit/i.test(error.message) ? "Pediste muchos mails seguidos. Esperá un minuto y probá de nuevo." : "No pudimos mandar el mail. Revisalo y probá de nuevo.");
      else setSent(true);
    }
    setBusy(false);
  };
  const cambiar = (m) => { setModo(m); setErr(""); setSent(false); };
  return (
    <div className="adm-centro">
      <span className="adm-logo grande"><Logo /></span>
      {sent ? (
        <>
          <p>{modo === "olvide" ? "Te mandamos un mail a " : "Te mandamos un link a "}<b>{email}</b>. {modo === "olvide" ? "Abrilo para elegir una contraseña nueva." : "Abrilo desde este mismo celular o compu para entrar."}</p>
          <button className="adm-link" onClick={() => cambiar("clave")}>Volver</button>
        </>
      ) : (
        <form onSubmit={go} className="adm-form">
          <input type="email" required placeholder="tu mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          {modo === "clave" && <input type="password" required placeholder="contraseña" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" />}
          <button className="adm-btn negro" disabled={busy}>
            {busy ? "Un momento…" : modo === "clave" ? "Entrar" : modo === "olvide" ? "Mandar mail de recuperación" : "Entrar con link al mail"}
          </button>
          {err && <p className="adm-err">{err}</p>}
          {modo === "clave" && <button type="button" className="adm-link" onClick={() => cambiar("olvide")}>¿Olvidaste tu contraseña?</button>}
          {modo === "clave"
            ? <button type="button" className="adm-link" onClick={() => cambiar("link")}>Entrar con un link al mail</button>
            : <button type="button" className="adm-link" onClick={() => cambiar("clave")}>Entrar con contraseña</button>}
        </form>
      )}
    </div>
  );
}

// Pantalla a la que se llega desde el mail de recuperación
function NuevaClave({ db, onListo }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    if (a.length < 8) return setErr("La contraseña tiene que tener al menos 8 caracteres.");
    if (a !== b) return setErr("Las dos contraseñas no coinciden.");
    setBusy(true);
    const { error } = await db.auth.updateUser({ password: a });
    setBusy(false);
    if (error) return setErr("No pudimos guardar la contraseña. Pedí otro mail de recuperación y probá de nuevo.");
    onListo();
  };
  return (
    <div className="adm-centro">
      <span className="adm-logo grande"><Logo /></span>
      <h1>Nueva contraseña</h1>
      <form onSubmit={go} className="adm-form">
        <input type="password" required placeholder="contraseña nueva" value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" />
        <input type="password" required placeholder="repetila" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" />
        <button className="adm-btn negro" disabled={busy}>{busy ? "Guardando…" : "Guardar y entrar"}</button>
        {err && <p className="adm-err">{err}</p>}
      </form>
    </div>
  );
}

