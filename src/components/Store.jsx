"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Fondo, Ambiente, EscenaAuto, PalabraGigante } from "./Escena";
import { NombreTipeado, Contador, Loader } from "./Effects";
import { money, isLight, orderText, vivo } from "@/lib/format";
import { precioDe, enOferta, primerColorLibre, nombreEnvio, detalleEnvio, costoEnvio, copiaEnvio, normalizarCodigo } from "@/lib/precios";
import { centroBase, medidas, estilo } from "@/lib/medir";
import { fotoChica, usarChica, cargarImagen } from "@/lib/fotos";
import { pedirGiroscopio } from "@/lib/inclinacion";

const CART_KEY = "tipificado-carrito";
const MESA_DEF = "#e6ded2";
const palabraDe = (p) => (p.word || p.name.split(/[\s/]+/).sort((a, b) => b.length - a.length)[0] || "").toUpperCase();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fechaLarga = (iso) => new Date(iso + "T12:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" });

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const f = () => setR(m.matches);
    m.addEventListener?.("change", f);
    return () => m.removeEventListener?.("change", f);
  }, []);
  return r;
}

function Tacita({ count }) {
  return (
    <span className="tacita">
      <svg viewBox="0 0 32 32" aria-hidden>
        <path d="M5 11h17v8a7 7 0 0 1-7 7h-3a7 7 0 0 1-7-7z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M22 13h2.5a3.5 3.5 0 0 1 0 7H22" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M10 4c0 2 2 2 2 4M15 4c0 2 2 2 2 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <b>{count}</b>
    </span>
  );
}

export default function Store({ products, settings, envios = [], inicial = 0, modoPrueba = false, pagos = true }) {
  const vacaciones = settings.vacaciones?.activo ? settings.vacaciones : null;
  const reduced = useReducedMotion();
  const N = products.length;
  const [active, setActive] = useState(() => (inicial > 0 && inicial < products.length ? inicial : 0));
  const [dir, setDir] = useState(1);
  const [pedestalUrl, setPedestalUrl] = useState(null); // ?pedestal=torno para comparar
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("pedestal");
    if (q === "torno" || q === "travertino") setPedestalUrl(q);
  }, []);
  const [visto, setVisto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [panel, setPanel] = useState(null); // "carrito" | "pagar" | "todo"
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState(null);
  const [ar, setAr] = useState({});
  const [cx, setCx] = useState({}); // centro real de la pieza (sin el asa) para centrarla en el pedestal
  const [vp, setVp] = useState({ w: 390, h: 800 });
  // Celular → fotos de 800. Solo lo usa el 3D (no se pinta en el HTML del servidor).
  const [chica] = useState(() => usarChica());
  const cartBtn = useRef(null);

  // El gesto: refs para que arrastrar no cause renders
  const escena = useRef(null);  // 3D (o respaldo): progreso(p, destino), confirmar(destino, signo)
  const fondo = useRef(null);   // pared + mesa: preparar, progreso, confirmar
  const palabraRef = useRef(null);
  const activo = useRef(active); // espejo síncrono de `active`
  const M = useRef({ p: 0, dest: -1, clave: "", v: 0, obj: 0, raf: 0, drag: null, palabraPend: false, rueda: { acc: 0, t: 0, fuego: 0, listo: true } });

  const p = products[active] || products[0];
  const mesa = p?.table_color || MESA_DEF;

  useEffect(() => {
    const r = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    r();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);

  // Carrito guardado en el navegador
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (Array.isArray(c)) setCart(c);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // Precarga: medimos cada foto (para que todas se vean del mismo tamaño) + loader
  useEffect(() => {
    const t0 = Date.now();
    const cargas = products.map((x, i) => new Promise((ok) => {
      cargarImagen(chica ? fotoChica(x.image_url) : x.image_url, x.image_url)
        .then((im) => {
          setAr((m) => ({ ...m, [x.id]: im.naturalWidth / im.naturalHeight }));
          setCx((m) => ({ ...m, [x.id]: centroBase(im) }));
        })
        .catch(() => {})
        .finally(ok);
      if (i > 2) ok();
    }));
    const max = setTimeout(() => setLoading(false), 2800);
    Promise.all([...cargas, document.fonts?.ready]).then(() => {
      setTimeout(() => setLoading(false), Math.max(0, 1000 - (Date.now() - t0)));
    });
    return () => clearTimeout(max);
  }, [products, chica]);

  // Colores ya calculados de cada pieza (pared y mesa "vivas")
  const colores = useMemo(() => products.map((x) => ({ pared: vivo(x.bg), mesa: vivo(x.table_color || MESA_DEF, 1.06) })), [products]);

  // Lo que necesita el 3D de cada pieza
  const piezas = useMemo(() => products.map((x) => ({
    src: chica ? fotoChica(x.image_url) : x.image_url,
    grande: x.image_url,
    ratio: ar[x.id],
    cx: cx[x.id],
    tipo: pedestalUrl || x.pedestal || settings.pedestal || "travertino",
    mesa: x.table_color || MESA_DEF,
    glow: !!x.glow,
  })), [products, chica, ar, cx, pedestalUrl, settings.pedestal]);

  // =================== El gesto ===================
  // p va de -1 a 1: positivo = siguiente pieza (deslizar para arriba), negativo = anterior.
  // Mueve en vivo el giro del torno, la persiana de la pared y la opacidad de la palabra.
  const vecino = useCallback((s) => (activo.current + s + N) % N, [N]);

  const aplicar = useCallback((pp, dest) => {
    const m = M.current;
    const clave = dest + (pp < 0 ? "-" : "+");
    if (dest >= 0 && clave !== m.clave) {
      m.clave = clave;
      m.dest = dest;
      const c = colores[dest];
      if (c) fondo.current?.preparar(c.pared, c.mesa, pp < 0 ? -1 : 1);
    }
    m.p = pp;
    escena.current?.progreso(pp, m.dest);
    fondo.current?.progreso(pp);
    if (palabraRef.current) palabraRef.current.style.opacity = m.palabraPend ? "0" : String(clamp(1 - Math.abs(pp) * 1.6, 0, 1));
  }, [colores]);

  const confirmar = useCallback(() => {
    const m = M.current;
    const dest = m.dest;
    const s = m.p < 0 ? -1 : 1;
    if (dest < 0) return aplicar(0, -1);
    escena.current?.confirmar(dest, s);
    fondo.current?.confirmar();
    m.palabraPend = true;
    if (palabraRef.current) palabraRef.current.style.opacity = "0";
    m.p = 0;
    m.dest = -1;
    m.clave = "";
    m.v = 0;
    m.obj = 0;
    activo.current = dest;
    // la palabra gigante y el nombre a máquina se disparan acá, al confirmar
    flushSync(() => {
      setActive(dest);
      setDir(s);
      setVisto(true);
    });
  }, [aplicar]);

  // la palabra nueva ya está en pantalla: vuelve a verse
  useLayoutEffect(() => {
    M.current.palabraPend = false;
    if (palabraRef.current) palabraRef.current.style.opacity = "1";
  }, [active]);

  const terminar = useCallback((obj) => {
    if (Math.abs(obj) === 1) confirmar();
    else aplicar(0, M.current.dest);
  }, [aplicar, confirmar]);

  // Resorte suave hacia obj (-1, 0 o 1), con la velocidad que traía el dedo
  const animar = useCallback((obj, v0 = 0) => {
    const m = M.current;
    cancelAnimationFrame(m.raf);
    m.raf = 0;
    m.obj = obj;
    m.v = v0;
    if (reduced) {
      aplicar(obj, m.dest);
      return terminar(obj);
    }
    const K = 160, C = 2 * Math.sqrt(K) * 1.02;
    let last = performance.now();
    const paso = (now) => {
      const dt = Math.min(0.034, Math.max(0.001, (now - last) / 1000));
      last = now;
      // dos sub-pasos para que el resorte sea estable con cualquier fps
      let pp = m.p;
      for (let i = 0; i < 2; i++) {
        const h = dt / 2;
        m.v += (K * (m.obj - pp) - C * m.v) * h;
        pp += m.v * h;
      }
      const llego = Math.abs(m.obj - pp) < 0.002 && Math.abs(m.v) < 0.06;
      const paso0 = m.obj === 0 && m.p !== 0 && Math.sign(pp) !== Math.sign(m.p); // volvió y se pasó
      const tope = Math.abs(m.obj) === 1 && Math.abs(pp) >= 1;
      if (llego || paso0 || tope) {
        m.raf = 0;
        aplicar(m.obj, m.dest);
        return terminar(m.obj);
      }
      aplicar(clamp(pp, -1, 1), m.dest);
      m.raf = requestAnimationFrame(paso);
    };
    m.raf = requestAnimationFrame(paso);
  }, [aplicar, terminar, reduced]);

  // Si llega otro gesto en medio de una animación: la actual termina al instante y se encadena la nueva
  const terminarYa = useCallback(() => {
    const m = M.current;
    if (!m.raf) return;
    cancelAnimationFrame(m.raf);
    m.raf = 0;
    aplicar(m.obj, m.dest);
    terminar(m.obj);
  }, [aplicar, terminar]);

  const irA = useCallback((i, d) => {
    terminarYa();
    const m = M.current;
    if (m.drag?.eje || N < 2 || i === activo.current || i < 0 || i >= N) return;
    const s = d < 0 ? -1 : 1;
    aplicar(s * 0.0001, i);
    animar(s, s * 3);
  }, [terminarYa, aplicar, animar, N]);
  const go = useCallback((d) => {
    terminarYa();
    irA(vecino(d), d);
  }, [terminarYa, irA, vecino]);

  // Teclado
  useEffect(() => {
    const k = (e) => {
      if (sheet !== null || panel) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "PageDown") go(1);
      if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      if (e.key === "Enter") setSheet(activo.current);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [go, sheet, panel]);

  // Ruedita / trackpad: un paso por gesto (la inercia del trackpad no dispara diez cambios)
  const onWheel = (e) => {
    if (sheet !== null || panel) return;
    const r = M.current.rueda;
    const now = performance.now();
    if (now - r.t > 220) { r.acc = 0; r.listo = true; }
    r.t = now;
    r.acc += e.deltaY;
    if (Math.abs(r.acc) >= 40 && (r.listo || now - r.fuego > 700)) {
      r.listo = false;
      r.fuego = now;
      go(r.acc > 0 ? 1 : -1);
      r.acc = 0;
    }
  };

  // Deslizar como en Reels: el escenario sigue al dedo
  const onDown = (e) => {
    if (e.button > 0 || e.target.closest("button, a, input, textarea, select, .capa, .reel-nav")) return (M.current.drag = null);
    terminarYa();
    pedirGiroscopio();
    M.current.drag = { x: e.clientX, y: e.clientY, id: e.pointerId, eje: null, enPieza: !!e.target.closest(".pieza-activa"), muestras: [{ d: 0, t: e.timeStamp || performance.now() }] };
  };
  const onMove = (e) => {
    const m = M.current, g = m.drag;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.eje) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      g.eje = Math.abs(dy) >= Math.abs(dx) ? "y" : "x";
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
    if (N < 2) return;
    const d = g.eje === "y" ? dy : dx;
    const tam = (g.eje === "y" ? window.innerHeight : window.innerWidth) * 0.35;
    g.tam = tam;
    const pp = clamp(-d / tam, -1, 1);
    const t = e.timeStamp || performance.now();
    g.muestras.push({ d, t });
    while (g.muestras.length > 2 && t - g.muestras[0].t > 100) g.muestras.shift();
    aplicar(pp, vecino(pp < 0 ? -1 : 1));
  };
  const onUp = (e, cancelado) => {
    const m = M.current, g = m.drag;
    if (!g || e.pointerId !== g.id) return;
    m.drag = null;
    if (!g.eje) {
      if (!cancelado && g.enPieza) setSheet(activo.current);
      return;
    }
    if (N < 2) return;
    // velocidad de los últimos 100 ms de movimiento; si el dedo se quedó quieto antes de soltar, es 0
    const tf = e.timeStamp || performance.now();
    const ult = g.muestras[g.muestras.length - 1];
    const recientes = g.muestras.filter((s) => ult.t - s.t <= 100);
    const a = recientes[0];
    const v = tf - ult.t < 70 && ult.t - a.t > 8 ? (ult.d - a.d) / (ult.t - a.t) : 0; // px/ms (negativo = hacia arriba = siguiente)
    const pp = m.p;
    let obj = 0;
    if (!cancelado) {
      if (Math.abs(v) > 0.5) {
        const s = v < 0 ? 1 : -1;
        obj = pp === 0 || Math.sign(pp) === s ? s : 0;
      } else if (Math.abs(pp) > 0.25) obj = Math.sign(pp);
    }
    if (obj !== 0 && Math.sign(pp) !== obj) aplicar(obj * 0.0001, vecino(obj));
    animar(obj, (-v * 1000) / (g.tam || window.innerHeight * 0.35));
  };

  // Tamaño de cada pieza: misma "superficie visual" sin importar la forma de la foto
  const dims = (prod) => medidas(ar[prod.id] || 1, cx[prod.id] ?? 0.5, vp.w, vp.h);
  const dActiva = dims(p);

  const count = cart.reduce((s, it) => s + it.qty, 0);
  const flash = (msg) => {
    setToast(msg);
    clearTimeout(flash.t);
    flash.t = setTimeout(() => setToast(null), 2200);
  };

  const add = (prod, color, qty, imgEl) => {
    setCart((c) => {
      const key = prod.id + "|" + color;
      const ex = c.find((x) => x.key === key);
      if (ex) return c.map((x) => (x.key === key ? { ...x, qty: x.qty + qty } : x));
      const foto = prod.colors?.find((x) => x.name === color)?.image_url || prod.image_url;
      return [...c, { key, id: prod.id, name: prod.name, color, price: precioDe(prod), image: foto, qty }];
    });
    // La pieza vuela a la tacita
    if (imgEl && cartBtn.current && !reduced) {
      const a = imgEl.getBoundingClientRect();
      const b = cartBtn.current.getBoundingClientRect();
      const ghost = imgEl.cloneNode();
      Object.assign(ghost.style, {
        position: "fixed", left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px",
        objectFit: "contain", zIndex: 999, pointerEvents: "none",
      });
      document.body.appendChild(ghost);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      ghost.animate(
        [
          { transform: "translate(0,0) scale(1) rotate(0)", opacity: 1 },
          { transform: `translate(${dx * 0.6}px, ${dy * 0.3 - 80}px) scale(.45) rotate(-14deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx}px, ${dy}px) scale(.06) rotate(-30deg)`, opacity: 0.6 },
        ],
        { duration: 780, easing: "cubic-bezier(.5,0,.3,1)" }
      ).onfinish = () => {
        ghost.remove();
        cartBtn.current?.animate(
          [{ transform: "rotate(0)" }, { transform: "rotate(-16deg) scale(1.15)" }, { transform: "rotate(10deg)" }, { transform: "rotate(0)" }],
          { duration: 420 }
        );
      };
    }
    setSheet(null);
    flash(`Agregado: ${prod.name} · ${color}`);
  };

  if (!p) return <main className="vacio">Pronto hay piezas nuevas ✦</main>;
  const paredClara = isLight(p.bg, 0.55);
  const { pared: paredViva, mesa: mesaViva } = colores[active] || colores[0];

  return (
    <main
      className={"tienda " + (paredClara ? "pared-clara" : "pared-oscura") + (isLight(mesa) ? " mesa-clara" : " mesa-oscura") + (modoPrueba ? " con-franja" : "")}
      style={{ "--pared": paredViva, "--mesa": mesaViva }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={(e) => onUp(e, false)}
      onPointerCancel={(e) => onUp(e, true)}
      onWheel={onWheel}
    >
      <Loader hidden={!loading} />
      {modoPrueba && <div className="franja-prueba">Modo prueba: no se cobra de verdad</div>}
      <Fondo control={fondo} pared={paredViva} mesa={mesaViva} />
      <Ambiente calida={p.glow} />

      <section className="set" aria-live="polite">
        <div className="palabra-caja" ref={palabraRef}>
          <PalabraGigante
            key={"we" + p.id}
            palabra={palabraDe(p)}
            estado={"entra " + (dir < 0 ? "desde-arriba" : "desde-abajo")}
            oscura={!paredClara}
          />
        </div>
        <EscenaAuto control={escena} piezas={piezas} actual={active} reducido={reduced} pausado={sheet !== null || !!panel} />
        <div className="pieza-box pieza-activa" style={estilo(dActiva)} role="img" aria-label={p.name} />
      </section>

      <header className="top">
        <a className="logo" href="/" aria-label="tipificado, inicio">
          tipificado…<span className="cursor">|</span>
        </a>
        <div className="top-acciones">
          <button className="chip-btn" onClick={() => setPanel("todo")}>Ver todo</button>
          <button className="carrito-btn" ref={cartBtn} onClick={() => setPanel("carrito")} aria-label={`Carrito, ${count} piezas`}>
            <Tacita count={count} />
          </button>
        </div>
      </header>
      {vacaciones ? (
        <p className="tagline aviso-vacaciones">
          Estamos de vacaciones{vacaciones.vuelta ? ` · volvemos el ${fechaLarga(vacaciones.vuelta)}` : ""}
          <small>{vacaciones.mensaje || "Podés mirar todo y escribirnos; las compras vuelven a abrir a la vuelta."}</small>
        </p>
      ) : (
        <p className="tagline">{settings.tagline}</p>
      )}

      <nav className="reel-nav" aria-label="Piezas">
        <button onClick={() => go(-1)} aria-label="Pieza anterior">↑</button>
        <div className="reel-puntos">
          {products.map((x, i) => (
            <i key={x.id} className={i === active ? "on" : ""} onClick={() => irA(i, i > active ? 1 : -1)} />
          ))}
        </div>
        <span className="reel-num">{String(active + 1).padStart(2, "0")}/{String(N).padStart(2, "0")}</span>
        <button onClick={() => go(1)} aria-label="Pieza siguiente">↓</button>
      </nav>

      <section className="info">
        <p className="categoria">{p.category}{p.badge && <span className="etiqueta">{p.badge === "ultimas" ? "Últimas" : "Nuevo"}</span>}</p>
        <NombreTipeado text={p.name} reduced={reduced} />
        <div className="fila-precio">
          {enOferta(p) && <s className="precio-antes">{money(p.price)}</s>}
          <span className="precio"><Contador value={precioDe(p)} reduced={reduced} /></span>
          <span className="puntos-color">
            {(p.colors || []).map((c) => <span key={c.name} className={c.agotado ? "agotado" : ""} style={{ "--c": c.hex }} title={c.name + (c.agotado ? " (agotado)" : "")} />)}
          </span>
        </div>
        <button className="btn-principal" onClick={() => setSheet(active)}>Elegir color</button>
        {!visto && <p className="pista"><span>↑</span> deslizá para ver la próxima pieza</p>}
      </section>

      <footer className="pie">
        <a href={`https://instagram.com/${settings.instagram}`} target="_blank" rel="noreferrer">@{settings.instagram}</a>
        <span>·</span>
        <a href="/arrepentimiento">Botón de arrepentimiento</a>
        {(settings.negocio_nombre || settings.negocio_cuit || settings.negocio_direccion) && (
          <small className="pie-legal">{[settings.negocio_nombre, settings.negocio_cuit && "CUIT " + settings.negocio_cuit, settings.negocio_direccion].filter(Boolean).join(" · ")}</small>
        )}
      </footer>

      {sheet !== null && (
        <Ficha prod={products[sheet]} settings={settings} vacaciones={vacaciones} onClose={() => setSheet(null)} onAdd={add} />
      )}
      {panel === "carrito" && (
        <Carrito cart={cart} setCart={setCart} vacaciones={vacaciones} onClose={() => setPanel(null)} onPay={() => setPanel("pagar")} />
      )}
      {panel === "pagar" && (
        <Pagar cart={cart} settings={settings} envios={envios} vacaciones={vacaciones} pagos={pagos} onBack={() => setPanel("carrito")} onClose={() => setPanel(null)} flash={flash} />
      )}
      {panel === "todo" && (
        <VerTodo products={products} onClose={() => setPanel(null)} onPick={(i) => { setPanel(null); irA(i, i > activo.current ? 1 : -1); }} />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

// ---------- Ficha del producto ----------
function Ficha({ prod, settings, vacaciones, onClose, onAdd }) {
  const libre = primerColorLibre(prod);
  const [color, setColor] = useState(libre?.name || prod.colors?.[0]?.name || "Único");
  const [qty, setQty] = useState(1);
  const img = useRef(null);
  const sel = prod.colors?.find((c) => c.name === color);
  // foto propia del color (opcional): si no tiene, la de la pieza
  const foto = sel?.image_url || prod.image_url;
  const fotoColor = sel?.image_url ? color : prod.colors?.[0]?.name;
  const precio = precioDe(prod);
  const agotada = prod.colors?.length > 0 && !libre;
  return (
    <div className="capa" onClick={onClose}>
      <div className="hoja ficha" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={prod.name}>
        <button className="cerrar" onClick={onClose} aria-label="Cerrar">×</button>
        <div className="ficha-foto" style={{ "--pared": vivo(sel?.bg || prod.bg), "--mesa": vivo(sel?.table_color || prod.table_color || MESA_DEF, 1.06) }}>
          <img ref={img} key={foto} src={foto} alt={prod.name + (sel?.image_url ? " en " + color : "")} />
        </div>
        <div className="ficha-cuerpo">
          <p className="categoria">{prod.category}{prod.badge && <span className="etiqueta">{prod.badge === "ultimas" ? "Últimas" : "Nuevo"}</span>}</p>
          <h3>{prod.name}</h3>
          <p className="desc">{prod.description}</p>
          <p className="ficha-precio">
            {enOferta(prod) && <s className="precio-antes">{money(prod.price)}</s>}
            {money(precio)}
          </p>
          {prod.colors?.length > 0 && (
            <>
              <div className="fila-label"><span>COLOR</span><span>{color}</span></div>
              <div className="chips">
                {prod.colors.map((c) => (
                  <button
                    key={c.name}
                    className={"chip" + (c.name === color ? " on" : "") + (c.agotado ? " agotado" : "")}
                    disabled={c.agotado}
                    aria-label={c.name + (c.agotado ? ", agotado" : "")}
                    onClick={() => setColor(c.name)}
                  >
                    <i style={{ "--c": c.hex }} /> {c.name}{c.agotado && <small> · agotado</small>}
                  </button>
                ))}
              </div>
              <p className="nota">
                {sel?.image_url ? `La foto muestra el color ${color.toLowerCase()}.` : `La foto muestra el color ${fotoColor?.toLowerCase()}.`} Cada pieza se hace en el color que elijas.
              </p>
            </>
          )}
          <p className="nota">{prod.production_time ? `Tiempo de producción: ${prod.production_time}.` : settings.produccion}</p>
          {vacaciones && <p className="nota aviso">Estamos de vacaciones: las compras vuelven a abrir{vacaciones.vuelta ? ` el ${fechaLarga(vacaciones.vuelta)}` : " pronto"}.</p>}
          <div className="comprar">
            <div className="cantidad">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos">−</button>
              <span>{qty}</span>
              <button onClick={() => setQty((q) => Math.min(20, q + 1))} aria-label="Más">+</button>
            </div>
            <button className="btn-oscuro" disabled={!!vacaciones || agotada} onClick={() => onAdd(prod, color, qty, img.current)}>
              {agotada ? "Agotada por ahora" : vacaciones ? "Volvemos pronto" : `Agregar al carrito · ${money(precio * qty)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Carrito ----------
function Carrito({ cart, setCart, vacaciones, onClose, onPay }) {
  const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const upd = (key, d) => setCart((c) => c.map((x) => (x.key === key ? { ...x, qty: Math.max(1, x.qty + d) } : x)));
  const del = (key) => setCart((c) => c.filter((x) => x.key !== key));
  return (
    <div className="capa" onClick={onClose}>
      <aside className="hoja lateral" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Tu carrito">
        <div className="hoja-head"><h3>Tu carrito</h3><button className="cerrar" onClick={onClose} aria-label="Cerrar">×</button></div>
        <div className="lista">
          {cart.length === 0 && <p className="vacio-txt">Todavía no elegiste ninguna pieza.</p>}
          {cart.map((it) => (
            <div className="item" key={it.key}>
              <img src={it.image} alt="" />
              <div>
                <b>{it.name}</b>
                <small>{it.color}</small>
                <div className="cantidad chica">
                  <button onClick={() => upd(it.key, -1)}>−</button><span>{it.qty}</span><button onClick={() => upd(it.key, 1)}>+</button>
                </div>
              </div>
              <div className="item-der">
                <b>{money(it.price * it.qty)}</b>
                <button className="link" onClick={() => del(it.key)}>Quitar</button>
              </div>
            </div>
          ))}
        </div>
        <div className="hoja-pie">
          <div className="total"><span>Subtotal</span><b>{money(total)}</b></div>
          {vacaciones && <p className="nota">Estamos de vacaciones: las compras vuelven a abrir{vacaciones.vuelta ? ` el ${fechaLarga(vacaciones.vuelta)}` : " pronto"}.</p>}
          <button className="btn-azul" disabled={!cart.length || !!vacaciones} onClick={onPay}>Continuar al pago</button>
        </div>
      </aside>
    </div>
  );
}

// ---------- Pagar ----------
// Envío y cupón se eligen acá; el servidor (api/cotizar) calcula todo y api/checkout lo vuelve a calcular al pagar.
function Pagar({ cart, settings, envios, vacaciones, pagos, onBack, onClose, flash }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [envioId, setEnvioId] = useState(envios[0]?.id ?? null);
  const [cuponAbierto, setCuponAbierto] = useState(false);
  const [cupon, setCupon] = useState("");
  const [cuponAplicado, setCuponAplicado] = useState("");
  const [cuponMsg, setCuponMsg] = useState(null); // { ok, txt }
  const [q, setQ] = useState(null); // cotización del servidor
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const envio = envios.find((e) => e.id === envioId) || null;
  const items = useMemo(() => cart.map(({ id, color, qty }) => ({ id, color, qty })), [cart]);
  const clave = JSON.stringify(items);

  useEffect(() => {
    let vivo = true;
    fetch("/api/cotizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, coupon: cuponAplicado, shippingId: envioId }),
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!vivo) return;
        if (!ok) { setErr(j.error || ""); return; }
        setErr("");
        if (cuponAplicado) {
          if (j.cuponError) { setCuponMsg({ ok: false, txt: j.cuponError }); setCuponAplicado(""); }
          else setCuponMsg({ ok: true, txt: `Cupón ${j.cupon.code}: ${j.cupon.texto}` });
        }
        setQ(j);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [clave, cuponAplicado, envioId]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotalLocal = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const t = q || { subtotal: subtotalLocal, discount: 0, shipping_cost: costoEnvio(envio), total: subtotalLocal + costoEnvio(envio) };
  const text = useMemo(
    () => orderText(cart, { name, contact, note, envio: copiaEnvio(envio), cupon: q?.cupon?.code, t }),
    [cart, name, contact, note, envio, q, t]
  );

  const aplicar = () => {
    const c = normalizarCodigo(cupon);
    if (!c) return;
    setCuponMsg(null);
    setCuponAplicado(c);
  };
  const quitarCupon = () => { setCuponAplicado(""); setCupon(""); setCuponMsg(null); setQ((x) => x && { ...x, discount: 0, cupon: null }); };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash("Pedido copiado ✦");
      return true;
    } catch {
      flash("No se pudo copiar, copialo a mano");
      return false;
    }
  };
  const dm = async () => {
    await copy();
    window.open(`https://ig.me/m/${settings.instagram}`, "_blank");
  };
  const mp = async () => {
    if (!name.trim()) return setErr("Poné tu nombre así sabemos de quién es el pedido.");
    if (!contact.trim()) return setErr("Dejanos un WhatsApp o Instagram para avisarte cómo va tu pedido.");
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, note, coupon: cuponAplicado, shippingId: envioId, items }),
      });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || "Error");
      window.location.href = j.url;
    } catch (e) {
      setErr(e.message === "Error" ? "No pudimos abrir Mercado Pago. Probá de nuevo o mandá el pedido por DM." : e.message);
      setBusy(false);
    }
  };

  return (
    <div className="capa" onClick={onClose}>
      <aside className="hoja lateral" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pagar">
        <div className="hoja-head"><h3>Pagar</h3><button className="cerrar" onClick={onClose} aria-label="Cerrar">×</button></div>
        <div className="lista form">
          <label>Tu nombre<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label>Tu WhatsApp o Instagram<input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="ej: 11 5555 5555 o @tuusuario" autoComplete="tel" /></label>

          {envios.length > 0 && (
            <fieldset className="entrega">
              <legend>¿Cómo lo recibís?</legend>
              {envios.map((op) => (
                <label key={op.id} className={"opcion-envio" + (op.id === envioId ? " on" : "")}>
                  <input type="radio" name="envio" checked={op.id === envioId} onChange={() => setEnvioId(op.id)} />
                  <span><b>{nombreEnvio(op)}</b><small>{detalleEnvio(op)}</small></span>
                  <em>{op.kind === "zona" ? money(costoEnvio(op)) : op.kind === "retiro" ? "Gratis" : "A coordinar"}</em>
                </label>
              ))}
            </fieldset>
          )}

          <div className="cupon">
            {cuponAplicado && cuponMsg?.ok ? (
              <p className="cupon-ok">✓ {cuponMsg.txt} <button className="link" onClick={quitarCupon}>Quitar</button></p>
            ) : !cuponAbierto ? (
              <button className="link" onClick={() => setCuponAbierto(true)}>¿Tenés un cupón?</button>
            ) : (
              <div className="cupon-fila">
                <input value={cupon} onChange={(e) => setCupon(e.target.value.toUpperCase())} placeholder="Código" autoCapitalize="characters"
                  onKeyDown={(e) => e.key === "Enter" && aplicar()} aria-label="Código del cupón" />
                <button className="btn-linea" onClick={aplicar} disabled={!cupon.trim()}>Aplicar</button>
              </div>
            )}
            {cuponMsg && !cuponMsg.ok && <p className="error">{cuponMsg.txt}</p>}
          </div>

          <label>Nota para el envío o la entrega (opcional)<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <pre className="resumen">{text}</pre>
          <p className="nota">{settings.envio}</p>
        </div>
        <div className="hoja-pie">
          {(t.discount > 0 || t.shipping_cost > 0) && (
            <div className="desglose">
              <span>Subtotal</span><span>{money(t.subtotal)}</span>
              {t.discount > 0 && <><span>Cupón</span><span>− {money(t.discount)}</span></>}
              {t.shipping_cost > 0 && <><span>Envío</span><span>{money(t.shipping_cost)}</span></>}
            </div>
          )}
          <div className="total"><span>Total a pagar</span><b>{money(t.total)}</b></div>
          {err && <p className="error">{err}</p>}
          {pagos && <button className="btn-azul" onClick={mp} disabled={busy || !!vacaciones}>{busy ? "Abriendo Mercado Pago…" : "Pagar con Mercado Pago"}</button>}
          <button className={pagos ? "btn-linea" : "btn-azul"} onClick={copy}>Copiar pedido</button>
          <button className="btn-linea" onClick={dm}>Enviar por DM de Instagram</button>
          <button className="btn-gris" onClick={onBack}>Volver al carrito</button>
        </div>
      </aside>
    </div>
  );
}

// ---------- Ver todo ----------
function VerTodo({ products, onClose, onPick }) {
  const cats = ["todo", ...new Set(products.map((p) => p.category.split("/")[0].trim()))];
  const [cat, setCat] = useState("todo");
  const list = products.map((p, i) => ({ p, i })).filter(({ p }) => cat === "todo" || p.category.startsWith(cat));
  return (
    <div className="capa todo" onClick={onClose}>
      <div className="todo-caja" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Todas las piezas">
        <div className="hoja-head"><h3>Todas las piezas</h3><button className="cerrar" onClick={onClose} aria-label="Cerrar">×</button></div>
        <div className="filtros">
          {cats.map((c) => <button key={c} className={"chip" + (c === cat ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <div className="grilla">
          {list.map(({ p, i }, k) => (
            <button key={p.id} className="card" style={{ "--pared": vivo(p.bg), "--mesa": vivo(p.table_color || MESA_DEF, 1.06), "--r": `${(k % 3) - 1}deg` }} onClick={() => onPick(i)}>
              <img src={p.image_url} alt="" loading="lazy" />
              <span className="oscuro"><b>{p.name}</b>{money(precioDe(p))}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
