"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { EscenaAuto } from "./Escena";
import { Loader } from "./Effects";
import { Logo } from "./Logo";
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
    // La pieza vuela a la tacita (desde la foto de la ficha o, si no hay, desde la pieza del taller)
    const desde = imgEl || document.querySelector(".pieza-activa");
    if (desde && cartBtn.current && !reduced) {
      const a = desde.getBoundingClientRect();
      const b = cartBtn.current.getBoundingClientRect();
      const ghost = imgEl ? imgEl.cloneNode() : Object.assign(document.createElement("img"), { src: prod.image_url, alt: "" });
      Object.assign(ghost.style, {
        position: "fixed", left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px",
        objectFit: "contain", objectPosition: "50% 100%", zIndex: 999, pointerEvents: "none",
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
          <button className="chip-btn" onClick={() => setPanel("todo")}>Ver todo <span className="chip-num">{N}</span></button>
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

      {/* con más de una pieza, el pie (Instagram y botón de arrepentimiento) va en la hoja de la máquina de escribir */}
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
          pie={<Pie settings={settings} />}
        />
      ) : (
        <footer className="pie"><Pie settings={settings} /></footer>
      )}

      {sheet !== null && (
        <Ficha prod={products[sheet]} settings={settings} vacaciones={vacaciones} con3d={!sin3d} cerrando={cerrando} onClose={cerrarFicha} onAdd={add} />
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
function Ficha({ prod, settings, vacaciones, con3d, cerrando, onClose, onAdd }) {
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
          <p className="categoria mano">{prod.category}{prod.badge && <span className="etiqueta">{prod.badge === "ultimas" ? "Últimas" : "Nuevo"}</span>}</p>
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

// ---------- Pie (Instagram, arrepentimiento y datos del negocio) ----------
function Pie({ settings }) {
  return (
    <>
      <a href={`https://instagram.com/${settings.instagram}`} target="_blank" rel="noreferrer">@{settings.instagram}</a>
      <span>·</span>
      <a href="/arrepentimiento">Botón de arrepentimiento</a>
      {(settings.negocio_nombre || settings.negocio_cuit || settings.negocio_direccion) && (
        <small className="pie-legal">{[settings.negocio_nombre, settings.negocio_cuit && "CUIT " + settings.negocio_cuit, settings.negocio_direccion].filter(Boolean).join(" · ")}</small>
      )}
    </>
  );
}

// Texto que se tipea letra por letra (lo que falta ocupa su lugar invisible: el renglón no salta)
function Tipeo({ texto, ms = 22, demora = 0, activo = true, reducido, cursor = false }) {
  const [n, setN] = useState(reducido || !activo ? texto.length : 0);
  useEffect(() => {
    if (reducido || !activo) return setN(texto.length);
    setN(0);
    let i = 0, t = 0;
    const paso = () => {
      i++;
      setN(i);
      if (i < texto.length) t = setTimeout(paso, ms);
    };
    t = setTimeout(paso, demora);
    return () => clearTimeout(t);
  }, [texto, ms, demora, activo, reducido]);
  return (
    <>
      {texto.slice(0, n)}
      {cursor && <span className="cursor-barra" />}
      <span className="tipeo-resto" aria-hidden>{texto.slice(n)}</span>
    </>
  );
}

// ---------- Ver todo: la hoja de la máquina de escribir ----------
// Abajo de la pantalla asoma el borde de una hoja de papel saliendo del rodillo, con las miniaturas
// de TODAS las piezas en fila y «catálogo completo · N piezas ↑» tipeado. La hoja respira (sube
// 4 px y baja cada ~4 s). Al tocarla o arrastrarla hacia arriba sube y cubre la pantalla, con la
// grilla de siempre (filtros, tarjetas; al tocar una pieza la mesa gira hasta ella). Se cierra
// bajándola (gesto desde la cabecera) o con ✕ / Escape.
const etiquetaDe = (b) => (b === "ultimas" ? "Últimas" : b ? "Nuevo" : "");
const catDe = (c = "") => c.split(/[/·]/)[0].trim();
const MINI = 30, MINI_GAP = 6;
function HojaMaquina({ products, actual, abierta, visible, reducido, onAbrir, onCerrar, onPick, pie }) {
  const N = products.length;
  const cats = ["todo", ...new Set(products.map((p) => catDe(p.category)).filter(Boolean))];
  const [cat, setCat] = useState("todo");
  const [dy, setDy] = useState(0); // arrastre en curso (px; negativo = hacia arriba)
  const [montada, setMontada] = useState(abierta); // la grilla se arma al abrir y se desarma al terminar de bajar
  const [cabe, setCabe] = useState(N);
  const tira = useRef(null);
  const gesto = useRef(null);
  const raiz = useRef(null);
  const list = products.map((p, i) => ({ p, i })).filter(({ p }) => cat === "todo" || catDe(p.category) === cat);
  const texto = `catálogo completo · ${N} piezas`;

  useEffect(() => {
    if (abierta) return setMontada(true);
    const t = setTimeout(() => setMontada(false), reducido ? 0 : 560);
    return () => clearTimeout(t);
  }, [abierta, reducido]);

  // cuántas miniaturas entran en la fila (si no entran todas: las que entren + «+N»)
  useEffect(() => {
    const el = tira.current;
    if (!el) return;
    const medir = () => {
      const n = Math.floor((el.clientWidth + MINI_GAP) / (MINI + MINI_GAP));
      setCabe(n >= N ? N : Math.max(1, n - 1));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [N]);

  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  useEffect(() => {
    if (!abierta) return;
    const k = (e) => e.key === "Escape" && cerrarRef.current();
    window.addEventListener("keydown", k);
    raiz.current?.querySelector(".hoja-cerrar")?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", k);
  }, [abierta]);

  // Gesto: cerrada, toda la hoja se toca o se arrastra hacia arriba; abierta, se baja desde la cabecera.
  const down = (e) => {
    if (e.button > 0) return;
    if (abierta ? !e.target.closest(".hoja-tirador, .todo-head") || e.target.closest("button") : e.target.closest("a")) return;
    gesto.current = { y: e.clientY, t: e.timeStamp, id: e.pointerId, mov: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const move = (e) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    const d = e.clientY - g.y;
    if (!g.mov && Math.abs(d) < 6) return;
    g.mov = true;
    setDy(abierta ? Math.max(0, d) : Math.min(0, d));
  };
  const up = (e, cancelado) => {
    const g = gesto.current;
    if (!g || g.id !== e.pointerId) return;
    gesto.current = null;
    const d = e.clientY - g.y, v = d / Math.max(1, e.timeStamp - g.t); // px/ms
    setDy(0);
    if (cancelado) return;
    if (!abierta && (!g.mov || d < -36 || v < -0.4)) onAbrir();
    else if (abierta && g.mov && (d > 90 || v > 0.5)) onCerrar();
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
      role={abierta ? "dialog" : undefined}
      aria-modal={abierta || undefined}
      aria-label={abierta ? "Todas las piezas" : undefined}
    >
      <div className="hoja-papel">
        <div
          className="hoja-asoma"
          role="button"
          tabIndex={abierta ? -1 : 0}
          aria-label={`Ver el catálogo completo: ${N} piezas`}
          aria-hidden={abierta || undefined}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onAbrir())}
        >
          <div className="hoja-tira" ref={tira} aria-hidden>
            {visible && products.slice(0, cabe).map((x, k) => (
              <img key={x.id} src={fotoChica(x.image_url)} alt="" decoding="async" style={{ "--k": k }} />
            ))}
            {visible && cabe < N && <span className="hoja-mas">+{N - cabe}</span>}
          </div>
          <p className="hoja-tipeo" aria-hidden>
            {visible ? <Tipeo texto={texto + " ↑"} ms={45} demora={700} reducido={reducido} cursor /> : <span className="tipeo-resto">{texto} ↑</span>}
          </p>
          <div className="maquina-pie">{pie}</div>
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
          {montada && <footer className="hoja-pie-abierta">{pie}</footer>}
        </div>
      </div>
      <div className="rodillo" aria-hidden />
    </div>
  );
}
