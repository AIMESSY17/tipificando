"use client";
// La hoja de la máquina de escribir: lo que comparten la hoja del catálogo (Store → HojaMaquina)
// y las hojas formales (/preguntas, /cambios, /envios, /terminos): el tipeo letra por letra, la
// tinta irregular, el pie y la hoja de texto tipeado.
import { Fragment, useEffect, useState } from "react";
import { Logo } from "./Logo";
import { LINKS_FORMALES } from "@/data/textos";

// Texto que se tipea letra por letra (lo que falta ocupa su lugar invisible: el renglón no salta)
export function Tipeo({ texto, ms = 22, demora = 0, activo = true, reducido, cursor = false }) {
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

// Tinta de máquina de escribir: cada letra con su opacidad (0.74–1) y alguna apenas corrida
// (0.5 px), siempre igual para el mismo texto (pseudoazar por posición).
const azar = (i, s = 0) => {
  const x = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const tinta = (i) => {
  const o = 0.74 + 0.26 * azar(i);
  const r = azar(i, 1);
  const dx = r > 0.84 ? 0.5 : r < 0.1 ? -0.5 : 0;
  const dy = azar(i, 2) > 0.86 ? 0.5 : 0;
  return { opacity: o.toFixed(2), transform: dx || dy ? `translate(${dx}px, ${dy}px)` : undefined };
};

// Título tipeado con tinta irregular. Con `clave`, se tipea una sola vez por visita (sessionStorage);
// las siguientes aparece entero.
export function TipeoTinta({ texto, ms = 55, demora = 0, activo = true, reducido, clave, cursor = true }) {
  const L = texto.length;
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!activo) return;
    let ya = reducido;
    if (!ya && clave) try { ya = sessionStorage.getItem(clave) === "1"; } catch {}
    if (ya) return setN(L);
    let i = 0, t = 0;
    const paso = () => {
      i++;
      setN(i);
      if (i < L) t = setTimeout(paso, ms * (0.75 + azar(i, 3) * 0.6)); // ritmo de dedo, no de metrónomo
      else if (clave) try { sessionStorage.setItem(clave, "1"); } catch {}
    };
    t = setTimeout(paso, demora);
    return () => clearTimeout(t);
  }, [texto, L, ms, demora, activo, reducido, clave]);
  // las letras van agrupadas por palabra: el renglón corta entre palabras, nunca adentro de una
  const palabras = [];
  let i0 = 0;
  for (const w of texto.split(/(\s+)/)) {
    if (w) palabras.push({ w, i0 });
    i0 += [...w].length;
  }
  const letra = (c, i) => (
    <span key={i} className={"tinta" + (i < n ? "" : " tipeo-resto")} style={tinta(i)} aria-hidden={i >= n || undefined}>{c}</span>
  );
  return (
    <>
      {palabras.map(({ w, i0 }) => /^\s+$/.test(w) ? <Fragment key={i0}>{w}</Fragment> : (
        <span key={i0} className="tinta-palabra">{[...w].map((c, k) => letra(c, i0 + k))}</span>
      ))}
      {cursor && <span className="cursor-barra" />}
    </>
  );
}

// Pie: @instagram a la izquierda y botón de arrepentimiento a la derecha, en un renglón.
// `formales`: arriba, los links a las hojas formales (solo en la hoja abierta y en las hojas de texto).
export function PieHoja({ settings = {}, formales = false, legal = true, lados = true }) {
  const ig = settings.instagram || "tipificado_";
  const negocio = [settings.negocio_nombre, settings.negocio_cuit && "CUIT " + settings.negocio_cuit, settings.negocio_direccion].filter(Boolean).join(" · ");
  return (
    <>
      {formales && (
        <nav className="pie-formales" aria-label="Información">
          {LINKS_FORMALES.map((l, k) => (
            <Fragment key={l.href}>
              {k > 0 && <span aria-hidden>·</span>}
              <a href={l.href}>{l.txt}</a>
            </Fragment>
          ))}
        </nav>
      )}
      {lados && (
        <div className="pie-linea">
          <a href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer">@{ig}</a>
          <a href="/arrepentimiento">Botón de arrepentimiento</a>
        </div>
      )}
      {legal && negocio && <small className="pie-legal">{negocio}</small>}
    </>
  );
}

// Pie de la página principal: @instagram abajo a la izquierda y el botón de arrepentimiento abajo a la derecha
export function PieLados({ settings = {} }) {
  const ig = settings.instagram || "tipificado_";
  return (
    <>
      <a className="pie-izq" href={`https://instagram.com/${ig}`} target="_blank" rel="noreferrer" draggable={false}>@{ig}</a>
      <a className="pie-der" href="/arrepentimiento" draggable={false}>Botón de arrepentimiento</a>
    </>
  );
}

// [texto](/ruta) → link; el resto, texto
function ConLinks({ txt }) {
  const partes = txt.split(/(\[[^\]]+\]\([^)]+\))/g);
  return partes.map((x, k) => {
    const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(x);
    if (!m) return <Fragment key={k}>{x}</Fragment>;
    const externo = /^https?:/.test(m[2]);
    return <a key={k} href={m[2]} {...(externo ? { target: "_blank", rel: "noreferrer" } : {})}>{m[1]}</a>;
  });
}

function useReducido() {
  const [r, setR] = useState(false);
  useEffect(() => setR(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return r;
}

// ---------- Hoja de texto tipeado (las hojas formales) ----------
// La misma hoja de papel del catálogo, ya abierta: sale del rodillo al entrar, título tipeado con
// tinta irregular y el texto a máquina. ✕ vuelve a la tienda.
export function HojaTexto({ hoja, settings, borrador }) {
  const reducido = useReducido();
  return (
    <div className="hoja-maquina abierta visible hoja-formal">
      <div className="hoja-papel">
        <div className="hoja-contenido">
          <header className="todo-head">
            <div>
              <a className="todo-kicker" href="/" aria-label="tipificado, volver a la tienda"><Logo titila={false} /></a>
              <h1 className="formal-titulo" aria-label={hoja.titulo}>
                <TipeoTinta texto={hoja.titulo} ms={38} demora={380} reducido={reducido} />
              </h1>
              {hoja.bajada && <p className="formal-bajada">{hoja.bajada}</p>}
            </div>
            <a className="cerrar hoja-cerrar" href="/" aria-label="Volver a la tienda">×</a>
          </header>
          <article className="formal-cuerpo">
            {borrador && <p className="sello-borrador" role="note">borrador · texto a revisar</p>}
            {hoja.secciones.map((s) => (
              <section key={s.t}>
                <h2>{s.t}</h2>
                {s.p.map((p, k) => <p key={k}><ConLinks txt={p} /></p>)}
              </section>
            ))}
            <p className="formal-volver"><a href="/">← volver a la tienda</a></p>
          </article>
          <footer className="hoja-pie-abierta"><PieHoja settings={settings} formales /></footer>
        </div>
      </div>
    </div>
  );
}
