"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { EscenaAuto } from "./Escena";
import { Loader } from "./Effects";
import { Logo } from "./Logo";
import { Tipeo, TipeoTinta, PieHoja } from "./Hoja";
import { money, isLight, orderText, vivo } from "@/lib/format";
import { precioDe, enOferta, primerColorLibre, nombreEnvio, detalleEnvio, costoEnvio, copiaEnvio, normalizarCodigo } from "@/lib/precios";
import { PROVINCIAS, MODALIDADES, normalizarCp } from "@/lib/envio";
import { fotoChica } from "@/lib/fotos";
import { pedirGiroscopio } from "@/lib/inclinacion";
import { Recorrido, modN } from "@/lib/recorrido";

const CART_KEY = "tipificado-carrito";
const PISTA_KEY = "tipificado-deslizo";
const MESA_DEF = "#e6ded2";
const palabraDe = (p) => (p.word || p.name.split(/[\s/]+/).sort((a, b) => b.length - a.length)[0] || "").toUpperCase();
const fechaLarga = (iso) => new Date(iso + "T12:00").toLocaleDateString("es-AR", { day: "numeric", month: "long" });
const dos = (n) => String(n).padStart(2, "0");

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

// El carrito es una taza de café de perfil sobre dos rueditas: la manija de la taza sigue hacia
// arriba y hace de manija del carro. Las piezas se cuentan adentro, sobre el café: sube un escalón
// por pieza (llena con 5 o más) con una ondita cada vez que cambia. Trazo redondo, en currentColor.
const CUERPO_TAZA = "M11 9h17v8a7 7 0 0 1-7 7h-3a7 7 0 0 1-7-7z";
const ESCALONES = 5;
const nivelCafe = (n) => (n > 0 ? 3 + (Math.min(n, ESCALONES) / ESCALONES) * 11.5 : 0); // el interior mide 15
function Tacita({ count }) {
  const nivel = nivelCafe(count);
  const prev = useRef(count);
  const [ola, setOla] = useState(0);
  useEffect(() => {
    if (prev.current !== count) setOla((o) => o + 1);
    prev.current = count;
  }, [count]);
  return (
    <span className={"tacita" + (count > 0 ? " llena" : "") + (count >= ESCALONES ? " colmada" : "")}>
      <svg viewBox="0 0 40 32" aria-hidden>
        <defs>
          <clipPath id="tacita-interior"><path d={CUERPO_TAZA} /></clipPath>
        </defs>
        <g clipPath="url(#tacita-interior)">
          {/* el café: una superficie con onda que sube y baja (transición de CSS) */}
          <g className="tacita-cafe" style={{ transform: `translateY(${24 - nivel}px)` }}>
            <path key={ola} className={ola ? "tacita-ola" : ""} d="M-4 0.6q2.5-1.2 5 0t5 0t5 0t5 0t5 0t5 0t5 0t5 0V18H-4z" />
          </g>
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={CUERPO_TAZA} />
          {/* manija de la taza que sube y se vuelve la manija del carro */}
          <path d="M11 11.5H8a3.5 3.5 0 0 0 0 7h3M8 11.5L5.5 5H2.5" />
          <circle cx="15" cy="28" r="2" />
          <circle cx="24" cy="28" r="2" />
          <path d="M18 2.5c0 1.6 1.6 1.6 1.6 3.2M22.5 2.5c0 1.6 1.6 1.6 1.6 3.2" strokeWidth="1.6" />
        </g>
      </svg>
      <b>{count}</b>
    </span>
  );
}

// La miniatura vuela en arco (bezier cuadrática) hasta la boca de la taza y cae adentro.
function vueloATaza(src, desde, taza) {
  const a = desde.getBoundingClientRect(), t = taza.getBoundingClientRect();
  const s = Math.max(44, Math.min(96, a.width * 0.5, a.height * 0.5)); // tamaño de la miniatura
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const bx = t.left + t.width * (19.5 / 40), by = t.top + t.height * (9 / 32); // boca de la taza
  // control del arco: hacia el costado de la salida y apenas arriba de la taza (nunca fuera de pantalla),
  // así sube, se curva y entra a la taza desde arriba
  const cx = x0 - (bx - x0) * 0.3, cy = Math.max(14, Math.min(y0, by) - 50);
  const g = Object.assign(document.createElement("img"), { src, alt: "", decoding: "async" });
  Object.assign(g.style, {
    position: "fixed", left: x0 - s / 2 + "px", top: y0 - s / 2 + "px", width: s + "px", height: s + "px", objectFit: "contain",
    zIndex: 999, pointerEvents: "none", filter: "drop-shadow(0 6px 8px rgba(0,0,0,.28))", willChange: "transform",
  });
  document.body.appendChild(g);
  const fin = 12 / s; // llega del ancho de la boca
  const kf = [];
  const PASOS = 18;
  for (let i = 0; i <= PASOS; i++) {
    const u = i / PASOS;
    const k = 1 - (1 - u) * (1 - u); // arranca rápido y frena arriba de la taza
    const x = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * cx + k * k * bx;
    const y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * cy + k * k * (by - 12);
    const esc = 1 + (fin * 1.8 - 1) * k;
    kf.push({ transform: `translate(${x - x0}px, ${y - y0}px) scale(${esc}) rotate(${-22 * k}deg)`, opacity: 1, offset: u * 0.78 });
  }
  // la caída: entra por la boca y desaparece adentro
  kf.push({ transform: `translate(${bx - x0}px, ${by + 5 - y0}px) scale(${fin}) rotate(-28deg)`, opacity: 0, offset: 1 });
  return new Promise((ok) => {
    const an = g.animate(kf, { duration: 840, easing: "linear", fill: "forwards" });
    an.onfinish = an.oncancel = () => { g.remove(); ok(); };
  });
}

export default function Store({ products, settings, envios = [], inicial = 0, modoPrueba = false, pagos = true }) {
  const vacaciones = settings.vacaciones?.activo ? settings.vacaciones : null;
  const reduced = useReducedMotion();
  const N = products.length;
  const ini = inicial > 0 && inicial < N ? inicial : 0;
  // El giro del anillo del taller: un solo ángulo (en piezas) que mueven el dedo, la ruedita, las flechas, los botones y tocar una pieza
  const [rec] = useState(() => new Recorrido(ini));
  const [active, setActive] = useState(ini);
  const [dir, setDir] = useState(1);
  const [pedestalUrl, setPedestalUrl] = useState(null); // ?pedestal=torno para comparar
  const [visto, setVisto] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [cerrando, setCerrando] = useState(false);
  const [panel, setPanel] = useState(null); // "carrito" | "pagar" | "todo"
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState(null);
  const [sin3d, setSin3d] = useState(false);
  const [enVuelo, setEnVuelo] = useState(0); // piezas volando a la taza (el café sube cuando caen)
  const cartBtn = useRef(null);
  const drag = useRef(null);
  const rueda = useRef({ x: 0, t: 0 });
  const activo = useRef(active);

  const p = products[active] || products[0];
  const mesa = p?.table_color || MESA_DEF;

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("pedestal");
    if (q === "torno" || q === "travertino") setPedestalUrl(q);
    try { setVisto(localStorage.getItem(PISTA_KEY) === "1"); } catch { setVisto(false); }
  }, []);

  useEffect(() => { rec.reducido = reduced; }, [rec, reduced]);

  // La pieza de adelante cambia al pasar la mitad del giro: ahí cambian textos y tintas
  const ultIndice = useRef(rec.indice);
  useEffect(() => rec.escuchar((tipo, r) => {
    if (tipo !== "indice" || !N) return;
    const d = r.indice >= ultIndice.current ? 1 : -1;
    ultIndice.current = r.indice;
    const i = modN(r.indice, N);
    if (i === activo.current) return;
    activo.current = i;
    setDir(d);
    setActive(i);
    setVisto((v) => {
      if (!v) try { localStorage.setItem(PISTA_KEY, "1"); } catch {}
      return true;
    });
  }), [rec, N]);

  // Cada pieza tiene su link (/pieza/<slug>): al girar la mesa, la URL y el título acompañan
  // (replaceState: no llena el historial). La primera vez no se toca: se respeta la URL de entrada.
  const primeraUrl = useRef(true);
  useEffect(() => {
    if (primeraUrl.current) return void (primeraUrl.current = false);
    const x = products[active];
    if (!x?.slug || String(x.id).includes("-demo")) return;
    const q = new URLSearchParams(window.location.search);
    q.delete("pieza");
    const qs = q.toString();
    const url = `/pieza/${encodeURIComponent(x.slug)}${qs ? "?" + qs : ""}`;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(window.history.state, "", url);
    document.title = `${x.name} — tipificado…|`;
  }, [active, products]);

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

  // Telón: tapa todo (también los textos) hasta que la escena ya está DIBUJADA con la pieza del
  // frente; nunca se ve la UI sobre la pared vacía. El tope largo es solo un seguro.
  const t0 = useRef(0);
  useEffect(() => {
    t0.current = Date.now();
    const max = setTimeout(() => setLoading(false), 9000);
    return () => clearTimeout(max);
  }, []);
  const listo = () => setTimeout(() => setLoading(false), Math.max(0, 750 - (Date.now() - t0.current)));

  // Lo que necesita el taller de cada pieza: la foto en 800 (sd) y en 1600 (hd)
  const piezas = useMemo(() => products.map((x) => ({
    sd: fotoChica(x.image_url),
    hd: x.image_url,
    tipo: pedestalUrl || x.pedestal || settings.pedestal || "travertino",
    glow: !!x.glow,
    palabra: palabraDe(x),
    pared: x.bg,
    mesa: x.table_color || MESA_DEF,
    clara: isLight(x.bg, 0.55),
  })), [products, pedestalUrl, settings.pedestal]);


  // =================== Ficha (con la cámara que se acerca a la pieza) ===================
  const abrirFicha = (i) => {
    setCerrando(false);
    setSheet(i);
  };
  const cerrarFicha = () => {
    if (reduced) return setSheet(null);
    setCerrando(true);
    clearTimeout(cerrarFicha.t);
    cerrarFicha.t = setTimeout(() => {
      setSheet(null);
      setCerrando(false);
    }, 320);
  };
  const fichaAbierta = sheet !== null && !cerrando;

  // =================== El gesto ===================
  const bloqueado = sheet !== null || !!panel;

  // Teclado
  useEffect(() => {
    const k = (e) => {
      if (bloqueado || e.target.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); rec.pasoLimitado(1); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); rec.pasoLimitado(-1); }
      if (e.key === "Enter" && !rec.moviendo) abrirFicha(activo.current);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [rec, bloqueado]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ruedita y trackpad: pasos de a una pieza, como mucho uno cada 350 ms (rec.pasoLimitado). El
  // trackpad suma su recorrido hasta un umbral; lo que llega mientras el paso está "en frío" se
  // descarta, así un scroll largo y continuo nunca acumula vueltas y siempre frena en una pieza.
  const onWheel = (e) => {
    if (bloqueado || N < 2) return;
    const r = rueda.current;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!d) return;
    const now = performance.now();
    const px = e.deltaMode === 1 ? d * 40 : e.deltaMode === 2 ? d * 400 : d;
    if (now - r.t > 200 || Math.sign(px) !== Math.sign(r.x)) r.x = 0; // gesto nuevo o cambio de sentido
    r.t = now;
    r.x += px;
    if (Math.abs(r.x) < 40) return;
    rec.pasoLimitado(r.x > 0 ? 1 : -1, now);
    r.x = 0;
  };

  // Deslizar: el anillo gira con el dedo 1:1 (horizontal). Agarrar frena cualquier giro en curso.
  const onDown = (e) => {
    if (e.button > 0 || bloqueado || e.target.closest("button, a, input, textarea, select, .capa, .nav-taller, .hoja-maquina")) return (drag.current = null);
    pedirGiroscopio();
    const t = e.timeStamp || performance.now();
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, eje: null, enPieza: !!e.target.closest(".pieza-activa"), quieto: !rec.moviendo };
    rec.agarrar(e.clientX, t);
  };
  const onMove = (e) => {
    const g = drag.current;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.eje) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      g.eje = Math.abs(dx) >= Math.abs(dy) * 0.9 ? "x" : "y";
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
    if (g.eje === "x" && N > 1) rec.arrastrar(e.clientX, e.timeStamp || performance.now());
  };
  const onUp = (e, cancelado) => {
    const g = drag.current;
    if (!g || e.pointerId !== g.id) return;
    drag.current = null;
    const t = e.timeStamp || performance.now();
    if (g.eje !== "x") {
      rec.soltar(t, true);
      if (g.eje || cancelado || !g.quieto) return;
      // tocar: la pieza activa abre la ficha; una del anillo gira hasta traerla al pedestal
      const tocada = rec.tocar ? rec.tocar(e.clientX, e.clientY) : g.enPieza ? activo.current : -1;
      if (tocada === activo.current) abrirFicha(activo.current);
      else if (tocada >= 0) rec.irAIndice(tocada, N);
      return;
    }
    rec.soltar(t, cancelado);
  };

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
    // Una miniatura vuela en arco hasta la taza y cae adentro; el café sube cuando cae.
    // Con movimiento reducido: sin vuelo, solo cambia el nivel.
    const desde = imgEl || document.querySelector(".pieza-activa");
    const taza = cartBtn.current?.querySelector(".tacita");
    if (desde && taza && !reduced && typeof document.body.animate === "function") {
      setEnVuelo((v) => v + qty);
      vueloATaza(fotoChica(prod.image_url), desde, taza).then(() => {
        setEnVuelo((v) => Math.max(0, v - qty));
        cartBtn.current?.animate(
          [{ transform: "none" }, { transform: "translateY(2px) rotate(-6deg)" }, { transform: "translateY(-1px) rotate(4deg)" }, { transform: "none" }],
          { duration: 420, easing: "ease-out" }
        );
      });
    }
    cerrarFicha();
    flash(`Agregado: ${prod.name} · ${color}`);
  };

  if (!p) return <main className="vacio">Pronto hay piezas nuevas ✦</main>;
  const paredClara = isLight(p.bg, 0.55);
  const paredViva = vivo(p.bg), mesaViva = vivo(mesa, 1.06);

  return (
    <main
      className={"tienda " + (loading ? "cargando " : "") + (paredClara ? "pared-clara" : "pared-oscura") + (isLight(mesa) ? " mesa-clara" : " mesa-oscura") + (modoPrueba ? " con-franja" : "") + (sin3d ? " sin-3d" : " con-3d") + (fichaAbierta ? " con-ficha" : "")}
      style={{ "--pared": paredViva, "--mesa": mesaViva }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={(e) => onUp(e, false)}
      onPointerCancel={(e) => onUp(e, true)}
      onWheel={onWheel}
    >
      <Loader hidden={!loading} />
      {modoPrueba && <div className="franja-prueba">Modo prueba: no se cobra de verdad</div>}

      <section className="set" aria-live="polite">
        <EscenaAuto
          recorrido={rec}
          piezas={piezas}
          pedestal={pedestalUrl || settings.pedestal || "travertino"}
          reducido={reduced}
          pausado={fichaAbierta || !!panel}
          enfoque={fichaAbierta}
          onListo={listo}
          onSinWebGL={() => setSin3d(true)}
        />
        <div className="pieza-activa" role="img" aria-label={p.name} />
      </section>

      <header className="top">
        <a className="logo" href="/" aria-label="tipificado, inicio">
          <Logo />
        </a>
        <div className="top-acciones">
          <button className="carrito-btn" ref={cartBtn} onClick={() => setPanel("carrito")} aria-label={count === 1 ? "Carrito, 1 pieza" : `Carrito, ${count} piezas`}>
            <Tacita count={Math.max(0, count - enVuelo)} />
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

      <nav className="nav-taller" aria-label="Piezas">
        <button className="nav-flecha izq" onClick={() => rec.pasoLimitado(-1)} aria-label="Pieza anterior">←</button>
        <span className="nav-num" aria-live="polite">{dos(active + 1)} / {dos(N)}</span>
        <button className="nav-flecha der" onClick={() => rec.pasoLimitado(1)} aria-label="Pieza siguiente">→</button>
      </nav>

      <section className="info">
        <div key={p.id} className={"info-anim " + (dir < 0 ? "desde-izq" : "desde-der")}>
          <p className="categoria">{p.category}{p.badge && <span className="etiqueta">{p.badge === "ultimas" ? "Últimas" : "Nuevo"}</span>}</p>
          <h2 className="nombre">{p.name}<span className="cursor-barra" aria-hidden /></h2>
          <div className="fila-precio">
            {enOferta(p) && <s className="precio-antes">{money(p.price)}</s>}
            <span className="precio">{money(precioDe(p))}</span>
            <span className="puntos-color">
              {(p.colors || []).map((c) => <span key={c.name} className={c.agotado ? "agotado" : ""} style={{ "--c": c.hex }} title={c.name + (c.agotado ? " (agotado)" : "")} />)}
            </span>
          </div>
        </div>
        <div className="acciones">
          <button className="btn-principal" onClick={() => abrirFicha(active)}>Elegir color</button>
        </div>
        {!visto && <p className="pista"><span className="pista-izq">←</span> deslizá <span className="pista-der">→</span></p>}
      </section>

      {/* con más de una pieza, el pie (Instagram a la izquierda, botón de arrepentimiento a la derecha) va en la hoja */}
      {N > 1 ? (
        <HojaMaquina
          products={products}
          actual={active}
          abierta={panel === "todo"}
          visible={!loading}
          reducido={reduced}
          onAbrir={() => setPanel("todo")}
          onCerrar={() => setPanel((x) => (x === "todo" ? null : x))}
          onPick={(i) => { setPanel(null); rec.irAIndice(i, N); }}
          settings={settings}
        />
      ) : (
        <footer className="pie"><PieHoja settings={settings} /></footer>
      )}

      {sheet !== null && (
        <Ficha prod={products[sheet]} settings={settings} flash={flash} vacaciones={vacaciones} con3d={!sin3d} cerrando={cerrando} onClose={cerrarFicha} onAdd={add} />
      )}
      {panel === "carrito" && (
        <Carrito cart={cart} setCart={setCart} vacaciones={vacaciones} onClose={() => setPanel(null)} onPay={() => setPanel("pagar")} />
      )}
      {panel === "pagar" && (
        <Pagar cart={cart} settings={settings} envios={envios} vacaciones={vacaciones} pagos={pagos} onBack={() => setPanel("carrito")} onClose={() => setPanel(null)} flash={flash} />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

// ---------- Ficha del producto ----------
// Con el taller en 3D la cámara se acerca a la pieza y la ficha entra desde abajo (celu) o desde el costado
// (compu): la foto de arriba solo aparece si el color elegido tiene foto propia.
// Compartir el link de la pieza: Web Share API (celu) o, si no hay, se copia el link.
async function compartir(prod, flash) {
  const url = `${window.location.origin}/pieza/${encodeURIComponent(prod.slug)}`;
  const datos = { title: `${prod.name} — tipificado…|`, text: `${prod.name} · cerámica hecha a mano`, url };
  if (navigator.share && (!navigator.canShare || navigator.canShare(datos))) {
    try { return void (await navigator.share(datos)); } catch (e) { if (e?.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    flash("link copiado…|");
  } catch {
    flash("No se pudo copiar: " + url);
  }
}

function Ficha({ prod, settings, flash, vacaciones, con3d, cerrando, onClose, onAdd }) {
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
  const conFoto = !con3d || !!sel?.image_url;
  return (
    <div className={"capa capa-ficha" + (con3d ? " con-3d" : "") + (cerrando ? " cerrando" : "")} onClick={onClose}>
      <div className={"hoja ficha" + (conFoto ? "" : " sin-foto")} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={prod.name}>
        <button className="cerrar" onClick={onClose} aria-label="Cerrar">×</button>
        {conFoto && (
          <div className="ficha-foto" style={{ "--pared": vivo(sel?.bg || prod.bg), "--mesa": vivo(sel?.table_color || prod.table_color || MESA_DEF, 1.06) }}>
            <img ref={img} key={foto} src={foto} alt={prod.name + (sel?.image_url ? " en " + color : "")} />
          </div>
        )}
        <div className="ficha-cuerpo">
          <div className="ficha-arriba">
            <p className="categoria mano">{prod.category}{prod.badge && <span className="etiqueta">{prod.badge === "ultimas" ? "Últimas" : "Nuevo"}</span>}</p>
            {prod.slug && (
              <button className="btn-compartir" onClick={() => compartir(prod, flash)} aria-label={`Compartir ${prod.name}`}>
                <svg viewBox="0 0 20 20" aria-hidden><path d="M10 12.5V3M6.5 6.5 10 3l3.5 3.5M5 9.5H4v7.5h12V9.5h-1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Compartir
              </button>
            )}
          </div>
          <h3>{prod.name}<span className="cursor-barra" aria-hidden /></h3>
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
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [envioId, setEnvioId] = useState(envios[0]?.id ?? null);
  // Envío por Andreani: destino y modalidad (el precio lo calcula el servidor)
  const [dest, setDest] = useState({ provincia: "", localidad: "", cp: "", modalidad: "domicilio", calle: "", numero: "", piso: "", sucursal: "" });
  const setD = (k, v) => setDest((d) => ({ ...d, [k]: v }));
  const [cotizando, setCotizando] = useState(false);
  const [cuponAbierto, setCuponAbierto] = useState(false);
  const [cupon, setCupon] = useState("");
  const [cuponAplicado, setCuponAplicado] = useState("");
  const [cuponMsg, setCuponMsg] = useState(null); // { ok, txt }
  const [q, setQ] = useState(null); // cotización del servidor
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const envio = envios.find((e) => e.id === envioId) || null;
  const esAndreani = envio?.kind === "andreani";
  const items = useMemo(() => cart.map(({ id, color, qty }) => ({ id, color, qty })), [cart]);
  const clave = JSON.stringify(items);
  // destino que se cotiza (con una pausita mientras escribe, para no cotizar letra por letra)
  const destClave = esAndreani ? JSON.stringify([dest.provincia, dest.localidad.trim().toLowerCase(), normalizarCp(dest.cp), dest.modalidad]) : "";
  const [destQ, setDestQ] = useState(destClave);
  useEffect(() => {
    const t = setTimeout(() => setDestQ(destClave), 450);
    return () => clearTimeout(t);
  }, [destClave]);
  const esperando = esAndreani && (cotizando || destQ !== destClave);

  useEffect(() => {
    let vivo = true;
    setCotizando(true);
    fetch("/api/cotizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, coupon: cuponAplicado, shippingId: envioId, destino: esAndreani ? { provincia: dest.provincia, localidad: dest.localidad, cp: dest.cp, modalidad: dest.modalidad } : undefined }),
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!vivo) return;
        setCotizando(false);
        if (!ok) { setErr(j.error || ""); return; }
        setErr("");
        // si la modalidad elegida no existe para ese destino pero la otra sí, se pasa a la otra
        const a = j.andreani;
        if (a && !a.pendiente && !a.coordinar) {
          const otra = a.modalidad === "domicilio" ? "sucursal" : "domicilio";
          if (!a.modalidades[a.modalidad] && a.modalidades[otra]) setDest((d) => (d.modalidad === a.modalidad ? { ...d, modalidad: otra } : d));
        }
        if (cuponAplicado) {
          if (j.cuponError) { setCuponMsg({ ok: false, txt: j.cuponError }); setCuponAplicado(""); }
          else setCuponMsg({ ok: true, txt: `Cupón ${j.cupon.code}: ${j.cupon.texto}` });
        }
        setQ(j);
      })
      .catch(() => { if (vivo) setCotizando(false); });
    return () => { vivo = false; };
  }, [clave, cuponAplicado, envioId, destQ]); // eslint-disable-line react-hooks/exhaustive-deps

  const andr = esAndreani ? q?.andreani : null;
  const subtotalLocal = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const t = q || { subtotal: subtotalLocal, discount: 0, shipping_cost: costoEnvio(envio), total: subtotalLocal + costoEnvio(envio) };
  const envioTxt = useMemo(() => {
    const base = copiaEnvio(envio);
    if (!esAndreani || !base) return base;
    const lugar = [dest.localidad.trim(), dest.provincia].filter(Boolean).join(", ");
    return { ...base, name: `Envío por Andreani ${dest.modalidad === "sucursal" ? "a sucursal" : "a domicilio"}${lugar ? ` (${lugar})` : ""}` };
  }, [envio, esAndreani, dest.modalidad, dest.localidad, dest.provincia]);
  const text = useMemo(
    () => orderText(cart, { name, contact: [contact, email].filter(Boolean).join(" · "), note, envio: envioTxt, cupon: q?.cupon?.code, t }),
    [cart, name, contact, email, note, envioTxt, q, t]
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
    const conEnvio = esAndreani || envio?.kind === "zona";
    if ((conEnvio || email.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr("Poné tu mail así te avisamos cuando salga el envío.");
    if (esAndreani) {
      if (!dest.provincia) return setErr("Elegí tu provincia.");
      if (dest.localidad.trim().length < 2) return setErr("Poné tu localidad.");
      if (normalizarCp(dest.cp).length !== 4) return setErr("Poné tu código postal (4 números).");
      if (dest.modalidad === "domicilio" && (!dest.calle.trim() || !dest.numero.trim())) return setErr("Poné la calle y el número de tu domicilio.");
      if (dest.modalidad === "sucursal" && dest.sucursal.trim().length < 3) return setErr("Contanos a qué sucursal Andreani te lo mandamos.");
      if (!andr || andr.pendiente) return setErr("Estamos calculando tu envío. Probá de nuevo en un segundo.");
      if (!andr.coordinar && !andr.modalidades[dest.modalidad]) return setErr("Esa modalidad no está disponible para tu destino. Elegí la otra.");
    }
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, email: email.trim(), note, coupon: cuponAplicado, shippingId: envioId, items, destino: esAndreani ? { ...dest, cp: normalizarCp(dest.cp) } : undefined }),
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
          <label>Tu mail{esAndreani || envio?.kind === "zona" ? "" : " (opcional)"}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="para avisarte cuando salga tu envío" autoComplete="email" inputMode="email" /></label>

          {envios.length > 1 && (
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

          {esAndreani && (
            <div className="envio-and">
              {envios.length <= 1 && (
                <div className="envio-head">
                  <h4>Envío</h4>
                  <p>Lo calculamos según tu ubicación</p>
                </div>
              )}
              <label>Provincia
                <select value={dest.provincia} onChange={(e) => setD("provincia", e.target.value)} autoComplete="address-level1">
                  <option value="">Elegí tu provincia</option>
                  {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <div className="dos-col">
                <label>Localidad<input value={dest.localidad} onChange={(e) => setD("localidad", e.target.value)} autoComplete="address-level2" /></label>
                <label>Código postal<input value={dest.cp} onChange={(e) => setD("cp", e.target.value.slice(0, 8))} inputMode="numeric" autoComplete="postal-code" placeholder="ej: 5000" /></label>
              </div>
              <fieldset className="entrega">
                <legend>¿Dónde lo recibís?</legend>
                {Object.entries(MODALIDADES).map(([m, titulo]) => {
                  const op = andr?.modalidades?.[m];
                  const detalle = !andr || andr.pendiente ? "Completá provincia, localidad y código postal"
                    : esperando ? "Calculando tu envío" : andr.coordinar ? "Lo coordinamos después de pagar" : !op ? "No disponible para tu destino" : op.demora || "";
                  const precio = esperando && andr && !andr.pendiente ? <span className="spin" role="status" aria-label="Calculando" /> : !andr || andr.pendiente || esperando ? "—" : andr.coordinar ? "A coordinar" : !op ? "—" : op.precio > 0 ? money(op.precio) : "Gratis";
                  return (
                    <label key={m} className={"opcion-envio" + (dest.modalidad === m ? " on" : "")}>
                      <input type="radio" name="modalidad" checked={dest.modalidad === m} onChange={() => setD("modalidad", m)} />
                      <span><b>{titulo}</b><small>{detalle}</small></span>
                      <em>{precio}</em>
                    </label>
                  );
                })}
              </fieldset>
              {dest.modalidad === "domicilio" ? (
                <>
                  <label>Calle<input value={dest.calle} onChange={(e) => setD("calle", e.target.value)} autoComplete="address-line1" /></label>
                  <div className="dos-col">
                    <label>Número<input value={dest.numero} onChange={(e) => setD("numero", e.target.value)} inputMode="numeric" /></label>
                    <label>Piso / depto (opcional)<input value={dest.piso} onChange={(e) => setD("piso", e.target.value)} autoComplete="address-line2" /></label>
                  </div>
                </>
              ) : (
                <label>¿A qué sucursal Andreani te lo mandamos?<input value={dest.sucursal} onChange={(e) => setD("sucursal", e.target.value)} placeholder="ej: Sucursal Córdoba Centro" /></label>
              )}
              {andr?.coordinar && !esperando && <p className="nota">No pudimos calcular el envío automáticamente. Pagás solo las piezas y el envío lo coordinamos por mensaje.</p>}
              {andr?.gratis && !esperando && <p className="nota">¡Envío gratis en esta compra! ✦</p>}
            </div>
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
              {t.shipping_cost > 0 && !esAndreani && <><span>Envío</span><span>{money(t.shipping_cost)}</span></>}
            </div>
          )}
          {esAndreani && andr && !andr.pendiente && !andr.coordinar && (
            <div className="envio-linea">
              <span>Envío</span>
              {esperando ? <span className="spin" role="status" aria-label="Calculando envío" /> : <b>{t.shipping_cost > 0 ? money(t.shipping_cost) : "Gratis"}</b>}
            </div>
          )}
          <div className="total"><span>Total a pagar</span><b>{money(t.total)}</b></div>
          {err && <p className="error">{err}</p>}
          {pagos && <button className="btn-azul" onClick={mp} disabled={busy || !!vacaciones || esperando}>{busy ? "Abriendo Mercado Pago…" : "Pagar con Mercado Pago"}</button>}
          <button className={pagos ? "btn-linea" : "btn-azul"} onClick={copy}>Copiar pedido</button>
          <button className="btn-linea" onClick={dm}>Enviar por DM de Instagram</button>
          <button className="btn-gris" onClick={onBack}>Volver al carrito</button>
        </div>
      </aside>
    </div>
  );
}

// ---------- Catálogo completo: la hoja de la máquina de escribir ----------
// Abajo asoma el borde de una hoja de papel saliendo del rodillo: «CATÁLOGO COMPLETO ↑» tipeado
// grande (una vez por visita) y, debajo, todas las piezas recortadas apoyadas sobre un renglón (si no
// entran, la fila se desliza de costado con inercia). Tocar una pieza gira la mesa hasta ella; tocar el
// título (o el papel) o arrastrar hacia arriba sube la hoja, que cubre la pantalla con la grilla de
// siempre (filtros, tarjetas). Se baja con el gesto desde la cabecera, ✕ o Escape. La hoja respira.
const etiquetaDe = (b) => (b === "ultimas" ? "Últimas" : b ? "Nuevo" : "");
const catDe = (c = "") => c.split(/[/·]/)[0].trim();
const TIPEO_KEY = "tipificado-tipeo-catalogo";
function HojaMaquina({ products, actual, abierta, visible, reducido, onAbrir, onCerrar, onPick, settings }) {
  const cats = ["todo", ...new Set(products.map((p) => catDe(p.category)).filter(Boolean))];
  const [cat, setCat] = useState("todo");
  const [dy, setDy] = useState(0); // arrastre en curso (px; negativo = hacia arriba)
  const [montada, setMontada] = useState(abierta); // la grilla se arma al abrir y se desarma al terminar de bajar
  const tira = useRef(null);
  const gesto = useRef(null);
  const suprimir = useRef(false); // después de un arrastre, el click que sigue no cuenta
  const inercia = useRef(0);
  const raiz = useRef(null);
  const list = products.map((p, i) => ({ p, i })).filter(({ p }) => cat === "todo" || catDe(p.category) === cat);

  useEffect(() => {
    if (abierta) return setMontada(true);
    const t = setTimeout(() => setMontada(false), reducido ? 0 : 560);
    return () => clearTimeout(t);
  }, [abierta, reducido]);

  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  useEffect(() => {
    if (!abierta) return;
    const k = (e) => e.key === "Escape" && cerrarRef.current();
    window.addEventListener("keydown", k);
    raiz.current?.querySelector(".hoja-cerrar")?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", k);
  }, [abierta]);

  // la pieza de adelante queda a la vista en la fila (si la fila se desliza)
  useEffect(() => {
    const el = tira.current;
    const b = el?.children[actual];
    if (!el || !b || abierta || gesto.current || el.scrollWidth <= el.clientWidth + 1) return;
    const l = b.offsetLeft, r = l + b.offsetWidth;
    if (l < el.scrollLeft + 16 || r > el.scrollLeft + el.clientWidth - 16)
      el.scrollTo({ left: l - (el.clientWidth - b.offsetWidth) / 2, behavior: reducido ? "auto" : "smooth" });
  }, [actual, abierta, reducido]);

  // Gesto. Cerrada: arrastrar hacia arriba abre; en la fila, de costado se desliza la fila (con el dedo
  // la desliza el navegador; con el mouse, a mano y con inercia). Abierta: se baja desde la cabecera.
  const down = (e) => {
    if (e.button > 0) return;
    if (abierta ? !e.target.closest(".hoja-tirador, .todo-head") || e.target.closest("button") : e.target.closest("a")) return;
    cancelAnimationFrame(inercia.current);
    const enTira = !abierta && !!e.target.closest(".hoja-tira");
    gesto.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, eje: null, enTira, mouse: e.pointerType === "mouse", s0: tira.current?.scrollLeft || 0, m: [] };
    // sin captura todavía: un toque tiene que llegar como click al título o a la pieza; se captura al arrastrar
  };
  const move = (e) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x, d = e.clientY - g.y;
    if (!g.eje) {
      if (Math.max(Math.abs(dx), Math.abs(d)) < 6) return;
      g.eje = g.enTira && Math.abs(dx) > Math.abs(d) ? "x" : "y";
      if (g.eje === "x" && !g.mouse) return void (gesto.current = null); // el dedo: la fila la desliza el navegador
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
    if (g.eje === "x") {
      tira.current.scrollLeft = g.s0 - dx;
      g.m.push({ x: e.clientX, t: e.timeStamp });
      if (g.m.length > 5) g.m.shift();
      return;
    }
    setDy(abierta ? Math.max(0, d) : Math.min(0, d));
  };
  const up = (e, cancelado) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    gesto.current = null;
    if (!g.eje) return; // un toque: lo resuelve el click
    suprimir.current = true;
    setTimeout(() => (suprimir.current = false), 0);
    if (g.eje === "x") {
      // inercia del mouse: la velocidad del final del arrastre, frenando
      const a = g.m[0], b = g.m[g.m.length - 1];
      let v = a && b && b.t > a.t ? -(b.x - a.x) / (b.t - a.t) * 16 : 0; // px por cuadro
      const el = tira.current;
      const paso = () => {
        if (!el || Math.abs(v) < 0.4) return;
        el.scrollLeft += v;
        v *= 0.93;
        inercia.current = requestAnimationFrame(paso);
      };
      if (!reducido) paso();
      return;
    }
    const d = e.clientY - g.y, v = d / Math.max(1, e.timeStamp - g.t); // px/ms
    setDy(0);
    if (cancelado) return;
    if (!abierta && (d < -36 || v < -0.4)) onAbrir();
    else if (abierta && (d > 90 || v > 0.5)) onCerrar();
  };
  // ruedita sobre la fila: la desliza (y no gira la mesa)
  const rueda = (e) => {
    const el = tira.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    e.stopPropagation();
    el.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  };

  return (
    <div
      ref={raiz}
      className={"hoja-maquina" + (abierta ? " abierta" : "") + (visible ? " visible" : "") + (dy ? " arrastrando" : "")}
      style={{ "--dy": dy + "px" }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={(e) => up(e, false)}
      onPointerCancel={(e) => up(e, true)}
      onClickCapture={(e) => { if (suprimir.current) { e.stopPropagation(); e.preventDefault(); } }}
      role={abierta ? "dialog" : undefined}
      aria-modal={abierta || undefined}
      aria-label={abierta ? "Todas las piezas" : undefined}
    >
      <div className="hoja-papel">
        <div className="hoja-asoma" aria-hidden={abierta || undefined} onClick={(e) => !abierta && !e.target.closest("a, .tira-pieza") && onAbrir()}>
          <button className="hoja-titulo" tabIndex={abierta ? -1 : 0} aria-label="Ver el catálogo completo">
            {visible ? <TipeoTinta texto="CATÁLOGO COMPLETO ↑" ms={62} demora={650} reducido={reducido} clave={TIPEO_KEY} />
              : <span className="tipeo-resto">CATÁLOGO COMPLETO ↑</span>}
          </button>
          <div className="hoja-renglon">
            <div className="hoja-tira" ref={tira} onWheel={rueda}>
              {products.map((x, k) => (
                <button
                  key={x.id}
                  className={"tira-pieza" + (k === actual ? " actual" : "")}
                  style={{ "--k": k }}
                  tabIndex={abierta ? -1 : 0}
                  aria-label={x.name}
                  aria-current={k === actual || undefined}
                  onClick={() => onPick(k)}
                >
                  {visible && <img src={fotoChica(x.image_url)} alt="" decoding="async" draggable={false} />}
                </button>
              ))}
            </div>
          </div>
          <div className="maquina-pie"><PieHoja settings={settings} legal={false} /></div>
        </div>

        <div className="hoja-contenido" aria-hidden={!abierta || undefined}>
          <div className="hoja-tirador" aria-hidden><span /></div>
          <header className="todo-head">
            <div>
              <p className="todo-kicker"><Logo titila={false} /></p>
              <h3>{montada ? <Tipeo texto="Todas las piezas" ms={18} demora={260} activo={abierta} reducido={reducido} /> : "Todas las piezas"} <span className="todo-cuenta">{list.length}</span></h3>
            </div>
            <button className="cerrar hoja-cerrar" onClick={onCerrar} aria-label="Cerrar" tabIndex={abierta ? 0 : -1}>×</button>
          </header>
          {montada && cats.length > 2 && (
            <div className="filtros" role="tablist" aria-label="Categorías">
              {cats.map((c) => (
                <button key={c} role="tab" aria-selected={c === cat} className={"chip" + (c === cat ? " on" : "")} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
          )}
          {montada && (
            <div className="grilla" key={cat}>
              {list.map(({ p, i }, k) => (
                <button
                  key={p.id}
                  className={"card" + (i === actual ? " actual" : "")}
                  style={{ "--pared": vivo(p.bg), "--mesa": vivo(p.table_color || MESA_DEF, 1.06), "--k": k }}
                  onClick={() => onPick(i)}
                  aria-label={`${p.name}, ${money(precioDe(p))}`}
                >
                  <span className="card-foto">
                    <img
                      src={fotoChica(p.image_url)}
                      alt=""
                      loading={k < 6 ? "eager" : "lazy"}
                      decoding="async"
                      onError={(e) => { if (e.currentTarget.src !== new URL(p.image_url, location.href).href) e.currentTarget.src = p.image_url; }}
                    />
                    {p.badge && <span className="card-etiqueta">{etiquetaDe(p.badge)}</span>}
                  </span>
                  <span className="card-info">
                    <b className="card-nombre"><Tipeo texto={p.name} ms={14} demora={320 + Math.min(k, 12) * 40} activo={abierta} reducido={reducido} /></b>
                    <span className="card-fila">
                      <span className="card-precio">{enOferta(p) && <s>{money(p.price)}</s>}{money(precioDe(p))}</span>
                      <span className="puntos-color">
                        {(p.colors || []).slice(0, 5).map((c) => <span key={c.name} className={c.agotado ? "agotado" : ""} style={{ "--c": c.hex }} />)}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {montada && <footer className="hoja-pie-abierta"><PieHoja settings={settings} formales /></footer>}
        </div>
      </div>
      <div className="rodillo" aria-hidden />
    </div>
  );
}
