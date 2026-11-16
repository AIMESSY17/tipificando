"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { medidas, anchoPed, estilo } from "@/lib/medir";

const Escena3D = dynamic(() => import("./Escena3D"), { ssr: false });

// =====================================================================
//  Escena "estudio de fotos": pared + mesa + luz de ventana + planta,
//  palabra gigante detrás, pedestal 3D y la pieza (todo el 3D en un solo canvas).
//  Pensado para que el navegador dibuje lo mínimo: las capas que se mueven
//  solo cambian transform u opacity.
// =====================================================================

// Fondo de pared ya calculado para un color: color liso + luz de ventana a la izquierda y
// sombra a la derecha (antes era una capa aparte con color-mix animado).
export function fondoPared(c) {
  const luz = `color-mix(in oklch, color-mix(in oklch, ${c} 72%, #fff6e6) 55%, transparent)`;
  const sombra = `color-mix(in oklch, color-mix(in oklch, ${c} 70%, #1a0c08) 55%, transparent)`;
  return `linear-gradient(115deg, ${luz} 0%, transparent 42%, transparent 60%, ${sombra} 100%) top / 100% var(--horizonte) no-repeat, ${c}`;
}

// ---------- Pared + mesa de la tienda: dos capas (la actual y la que viene) ----------
// La que viene sube (o baja) como una persiana ligada al dedo; la mesa nueva aparece con opacidad.
// Se maneja desde afuera con `control`: preparar(pared, mesa, dir), progreso(p), confirmar().
export function Fondo({ control, pared, mesa }) {
  const pa = useRef(null), ps = useRef(null), ma = useRef(null), msg = useRef(null);
  const st = useRef({ dir: 1, pared, mesa });

  useLayoutEffect(() => {
    pa.current.style.background = fondoPared(pared);
    ma.current.style.backgroundColor = mesa;
  }, [pared, mesa]);

  useEffect(() => {
    if (!control) return;
    const progreso = (p) => {
      const a = Math.min(1, Math.abs(p));
      const sube = st.current.dir >= 0;
      ps.current.style.transform = `translate3d(0, ${sube ? 100 - 120 * a : -100 + 120 * a}%, 0)`;
      ps.current.style.visibility = a > 0 ? "visible" : "hidden";
      msg.current.style.opacity = String(a);
    };
    control.current = {
      preparar(p2, m2, dir) {
        st.current.dir = dir;
        st.current.pared = p2;
        st.current.mesa = m2;
        ps.current.style.background = fondoPared(p2);
        ps.current.className = "pared-capa sig " + (dir < 0 ? "baja" : "sube");
        msg.current.style.backgroundColor = m2;
      },
      progreso,
      confirmar() {
        pa.current.style.background = fondoPared(st.current.pared);
        ma.current.style.backgroundColor = st.current.mesa;
        progreso(0);
      },
    };
    return () => { control.current = null; };
  }, [control]);

  return (
    <div className="pared" aria-hidden>
      <div className="pared-capa actual" ref={pa} />
      <div className="pared-capa sig sube" ref={ps} style={{ visibility: "hidden" }} />
      <div className="mesa">
        <div className="mesa-capa" ref={ma} />
        <div className="mesa-capa" ref={msg} style={{ opacity: 0 }} />
        <div className="mesa-luz" />
        <div className="mesa-canto" />
      </div>
    </div>
  );
}

// ---------- Ambiente: luz de ventana + planta + grano + viñeta, dibujados UNA vez en un PNG ----------
const PLANTA = [
  "M60 60 C110 40 160 70 170 120 C120 140 75 115 60 60Z",
  "M45 110 C0 100 -30 140 -20 180 C25 185 50 150 45 110Z",
  "M100 190 C160 170 215 205 220 260 C160 275 110 245 100 190Z",
  "M95 240 C45 235 15 275 25 320 C75 320 100 285 95 240Z",
  "M140 320 C200 310 245 350 240 405 C180 410 140 375 140 320Z",
  "M135 380 C90 380 60 420 70 465 C120 462 140 425 135 380Z",
];
const TALLO = "M30 -10 C40 80 60 160 110 250 C140 300 150 360 140 430";
const VENTANA = [
  [250, 0, 410, 0, 300, 420, 110, 420],
  [430, 0, 600, 0, 520, 420, 320, 420],
  [105, 440, 295, 440, 170, 900, -60, 900],
  [315, 440, 515, 440, 420, 900, 190, 900],
];

// Dibuja en chico y agranda: el suavizado del navegador hace de desenfoque (sin ctx.filter, que Safari no tiene)
function borroso(w, h, escala, dibujar) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * escala));
  c.height = Math.max(1, Math.round(h * escala));
  const x = c.getContext("2d");
  x.scale(escala, escala);
  dibujar(x);
  return c;
}

function pintarAmbiente(w, h, vw, vh) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  const ox = (w - vw) / 2, oy = (h - vh) / 2;

  // grano (revoque de la pared y textura de la mesa)
  const img = x.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = Math.random();
    const v = r < 0.5 ? 24 : 255;
    d[i] = v;
    d[i + 1] = v - 6;
    d[i + 2] = v - 12;
    d[i + 3] = Math.random() * 15;
  }
  x.putImageData(img, 0, 0);
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";

  // luz de ventana: caja en right -18%, top -4%, 95% × 108%, inclinada -8°
  const bw = vw * 0.95, bh = vh * 1.08, bl = ox + vw * 1.18 - bw, bt = oy - vh * 0.04;
  const luz = borroso(w, h, 1 / 6, (k) => {
    k.translate(bl + bw / 2, bt + bh / 2);
    k.transform(1, 0, Math.tan((-8 * Math.PI) / 180), 1, 0, 0);
    k.translate(-bw / 2, -bh / 2);
    k.scale(bw / 600, bh / 900);
    k.fillStyle = "#fff6e8";
    for (const p of VENTANA) {
      k.beginPath();
      k.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) k.lineTo(p[i], p[i + 1]);
      k.closePath();
      k.fill();
    }
  });
  x.globalAlpha = 0.13;
  x.drawImage(luz, 0, 0, w, h);

  // sombra de la planta: arriba a la izquierda
  const pw = Math.min(vw * 0.64, 440), ph = (pw * 520) / 420;
  const planta = borroso(w, h, 1 / 3, (k) => {
    k.translate(ox - vw * 0.08, oy - vh * 0.03);
    k.scale(pw / 420, ph / 520);
    k.fillStyle = k.strokeStyle = "#1e1009";
    k.lineWidth = 5;
    k.stroke(new Path2D(TALLO));
    for (const p of PLANTA) k.fill(new Path2D(p));
  });
  x.globalAlpha = 0.24;
  x.drawImage(planta, 0, 0, w, h);

  // viñeta (radial-gradient(130% 95% at 45% 40%, transparent 58%, oscuro))
  x.globalAlpha = 1;
  x.save();
  x.translate(ox + vw * 0.45, oy + vh * 0.4);
  x.scale(vw * 1.3, vh * 0.95);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0.58, "rgba(18, 8, 4, 0)");
  g.addColorStop(1, "rgba(18, 8, 4, 0.3)");
  x.fillStyle = g;
  x.fillRect(-2, -2, 4, 4);
  x.restore();
  return c;
}

export function Ambiente({ mesa, calida }) {
  const ref = useRef(null);
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const el = ref.current;
    let vivo = true, actual = null, t = 0, ult = null;
    const dibujar = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      if (!w || !h) return;
      // la barra del navegador del celu cambia el alto todo el tiempo: solo se redibuja si cambia de verdad
      if (ult && ult.w === w && Math.abs(ult.h - h) / ult.h < 0.18) return;
      ult = { w, h };
      const c = pintarAmbiente(w, h, w / 1.06, h / 1.06);
      c.toBlob((b) => {
        if (!vivo || !b) return;
        const u = URL.createObjectURL(b);
        if (actual) URL.revokeObjectURL(actual);
        actual = u;
        setUrl(u);
      }, "image/png");
    };
    dibujar();
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(dibujar, 300);
    });
    ro.observe(el);
    return () => {
      vivo = false;
      ro.disconnect();
      clearTimeout(t);
      if (actual) URL.revokeObjectURL(actual);
    };
  }, []);
  return (
    <div className="ambiente" aria-hidden>
      {mesa && (
        <div className="mesa">
          <div className="mesa-capa" style={{ backgroundColor: mesa }} />
          <div className="mesa-luz" />
          <div className="mesa-canto" />
        </div>
      )}
      <div className={"calidez" + (calida ? " on" : "")} />
      <div className="amb-capa" ref={ref} style={url ? { backgroundImage: `url(${url})` } : undefined} />
    </div>
  );
}

// ---------- Pedestal de yeso en CSS (respaldo si no hay WebGL) ----------
export function Pedestal({ ancho, mesa }) {
  return (
    <div className="pedestal" style={{ width: ancho, "--mesa": mesa }} aria-hidden>
      <div className="ped-sombra" />
      <div className="ped-cuerpo"><div className="ped-giro" /></div>
      <div className="ped-tapa" />
    </div>
  );
}

// ---------- Palabra gigante detrás de la pieza ----------
export function PalabraGigante({ palabra, estado, pared, oscura, size: tam }) {
  const letras = [...palabra];
  const size = tam || `min(calc(94vw / (${Math.max(letras.length, 4)} * 0.46)), 30dvh, 340px)`;
  return (
    <div className={"palabra " + estado} style={{ fontSize: size, "--pared": pared }} aria-hidden>
      <span className={"palabra-linea" + (oscura ? " clara" : "")}>
        {letras.map((l, i) => (
          <span key={i} className="letra" style={{ animationDelay: `${i * 34}ms` }}>{l}</span>
        ))}
      </span>
    </div>
  );
}

// ---------- Escenario: el 3D si se puede; si no, pedestal CSS + foto ----------
// piezas: [{ src, grande, ratio, cx, tipo, mesa, glow }], actual: índice, control: ref para el gesto.
export function EscenaAuto(props) {
  const [falla, setFalla] = useState(false);
  if (falla) return <Respaldo {...props} />;
  return <Escena3D {...props} onFalla={() => setFalla(true)} />;
}

function Respaldo({ control, piezas = [], actual = 0, vista, pedMin = 120 }) {
  const [vp, setVp] = useState(null);
  const [idx, setIdx] = useState(actual);
  const caja = useRef(null);
  const st = useRef({ actual, mostrado: actual });

  useEffect(() => {
    const r = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    r();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);

  const quieto = () => {
    if (!caja.current) return;
    caja.current.style.transform = "";
    caja.current.style.opacity = "";
  };
  useEffect(() => {
    st.current = { actual, mostrado: actual };
    setIdx(actual);
    quieto();
  }, [actual]);

  useEffect(() => {
    if (!control) return;
    control.current = {
      progreso(p, dest) {
        const s = st.current;
        const lejos = Math.abs(p) >= 0.5 && dest >= 0;
        const m = lejos ? dest : s.actual;
        if (m !== s.mostrado) {
          s.mostrado = m;
          setIdx(m);
        }
        const a = lejos ? p - Math.sign(p) : p;
        if (caja.current) {
          caja.current.style.transform = `perspective(900px) rotateY(${a * 180}deg)`;
          caja.current.style.opacity = String(1 - Math.abs(a));
        }
      },
      confirmar(dest) {
        st.current = { actual: dest, mostrado: dest };
        setIdx(dest);
        quieto();
      },
    };
    return () => { control.current = null; };
  }, [control]);

  const pz = piezas[idx];
  const W = vista?.w || vp?.w || 390, H = vista?.h || vp?.h || 800;
  const d = medidas(pz?.ratio || 1, pz?.cx ?? 0.5, W, H);
  return (
    <>
      <Pedestal ancho={anchoPed(d.width, pz?.cx, pedMin)} mesa={pz?.mesa} />
      {pz?.src && (
        <div className="pieza-box" style={estilo(d)}>
          <div className="pieza-anim" ref={caja}>
            <img
              className="pieza-img"
              src={pz.src}
              alt=""
              draggable={false}
              onError={(e) => { if (pz.grande && e.currentTarget.src !== new URL(pz.grande, location.href).href) e.currentTarget.src = pz.grande; }}
            />
          </div>
        </div>
      )}
    </>
  );
}
