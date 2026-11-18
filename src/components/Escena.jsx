"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { medidas, anchoPed, estilo } from "@/lib/medir";
import { vivo } from "@/lib/format";
import { modN } from "@/lib/recorrido";

const Taller = dynamic(() => import("./Taller"), { ssr: false });

// =====================================================================
//  El escenario: EL TALLER en 3D (Taller.jsx) si hay WebGL; si no, una versión DOM simple
//  (pared, mesa, palabra, pedestal de CSS y la foto) que se maneja con el mismo recorrido.
// =====================================================================

// Fondo de pared ya calculado para un color: color liso + luz de ventana a la izquierda y sombra a la derecha
export function fondoPared(c) {
  const luz = `color-mix(in oklch, color-mix(in oklch, ${c} 72%, #fff6e6) 55%, transparent)`;
  const sombra = `color-mix(in oklch, color-mix(in oklch, ${c} 70%, #1a0c08) 55%, transparent)`;
  return `linear-gradient(115deg, ${luz} 0%, transparent 42%, transparent 60%, ${sombra} 100%) top / 100% var(--horizonte) no-repeat, ${c}`;
}

// ---------- Ambiente (solo respaldo sin WebGL): grano + viñeta + calidez del pino ----------
export function Ambiente({ mesa, calida }) {
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
      <div className="amb-vineta" />
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

// ---------- Palabra gigante (respaldo sin WebGL; en el 3D se pinta en la pared con el mismo layout) ----------
export function PalabraGigante({ palabra, oscura, size: tam }) {
  const letras = [...palabra];
  const size = tam || `min(calc(94vw / (${Math.max(letras.length, 4)} * 0.46)), 30dvh, 340px)`;
  return (
    <div className="palabra" style={{ fontSize: size }} aria-hidden>
      <span className={"palabra-linea" + (oscura ? " clara" : "")}>
        {letras.map((l, i) => <span key={i} className="letra">{l}</span>)}
      </span>
    </div>
  );
}

// ---------- Escenario ----------
// piezas: [{ sd (foto 800), hd (foto 1600), tipo, glow, palabra, pared, mesa, clara }]
export function EscenaAuto(props) {
  const [falla, setFalla] = useState(false);
  if (falla) return <Respaldo {...props} />;
  return <Taller {...props} onFalla={() => { setFalla(true); props.onSinWebGL?.(); }} />;
}

function Respaldo({ recorrido, piezas = [], vista, pedMin = 120, onListo }) {
  const N = piezas.length;
  const [idx, setIdx] = useState(() => (recorrido && N ? modN(recorrido.indice, N) : 0));
  const [vp, setVp] = useState(null);
  const caja = useRef(null);
  const raiz = useRef(null);

  useEffect(() => {
    const r = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    r();
    window.addEventListener("resize", r);
    onListo?.();
    return () => window.removeEventListener("resize", r);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // mismo recorrido que el 3D: la pieza sigue al dedo y cambia al pasar la mitad
  useEffect(() => {
    if (!recorrido || !N) return;
    let raf = 0;
    const bucle = (now) => {
      raf = 0;
      if (recorrido.paso(now)) raf = requestAnimationFrame(bucle);
    };
    const off = recorrido.escuchar((tipo, r) => {
      if (tipo === "indice") setIdx(modN(r.indice, N));
      const f = r.s - Math.round(r.s);
      if (caja.current) {
        caja.current.style.transform = `translate3d(${(-f * window.innerWidth * 0.9).toFixed(1)}px, 0, 0)`;
        caja.current.style.opacity = String(1 - Math.min(1, Math.abs(f) * 1.6));
      }
      if (!raf && r.moviendo) raf = requestAnimationFrame(bucle);
    });
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, [recorrido, N]);

  const pz = piezas[idx];
  const W = vista?.w || vp?.w || 390, H = vista?.h || vp?.h || 800;
  const d = medidas(1, 0.5, W, H);

  // zona para tocar la pieza (la usa la tienda)
  useEffect(() => {
    const el = raiz.current?.closest(".tienda, .adm-escena");
    if (!el) return;
    el.style.setProperty("--pz-l", `calc(50% - ${d.width / 2}px)`);
    el.style.setProperty("--pz-t", `calc(var(--apoyo) - ${d.height}px)`);
    el.style.setProperty("--pz-w", d.width + "px");
    el.style.setProperty("--pz-h", d.height + "px");
  }, [d.width, d.height]);

  if (!pz) return null;
  const pared = vivo(pz.pared || "#c46a4c"), mesa = vivo(pz.mesa || "#e6ded2", 1.06);
  return (
    <div className="respaldo" ref={raiz} style={{ "--pared": pared, "--mesa": mesa }} aria-hidden>
      <div className="respaldo-pared" style={{ background: fondoPared(pared) }} />
      <Ambiente mesa={mesa} calida={pz.glow} />
      {pz.palabra && <PalabraGigante palabra={pz.palabra} oscura={!pz.clara} />}
      <div className="respaldo-pieza" ref={caja}>
        <Pedestal ancho={anchoPed(d.width, 0.5, pedMin)} mesa={mesa} />
        {pz.sd && (
          <div className="pieza-box" style={estilo(d)}>
            <img
              className="pieza-img"
              src={pz.sd}
              alt=""
              draggable={false}
              onError={(e) => { if (pz.hd && e.currentTarget.src !== new URL(pz.hd, location.href).href) e.currentTarget.src = pz.hd; }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
