"use client";
import { useEffect, useRef, useState } from "react";

// ---------- Nombre que se reescribe a máquina (y se "amasa") ----------
export function NombreTipeado({ text, reduced, as: Tag = "h2", className = "" }) {
  const [shown, setShown] = useState(text);
  const [kneading, setKneading] = useState(false);
  const cur = useRef(text);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    if (reduced) {
      setShown(text);
      cur.current = text;
      return;
    }
    setKneading(true);
    let s = cur.current;
    // prefijo común: no hace falta borrar lo que ya coincide
    let common = 0;
    while (common < s.length && s[common] === text[common]) common++;
    const delStep = () => {
      if (s.length > common) {
        s = s.slice(0, -1);
        cur.current = s;
        setShown(s);
        timer.current = setTimeout(delStep, 14);
      } else typeStep();
    };
    const typeStep = () => {
      if (s.length < text.length) {
        s = text.slice(0, s.length + 1);
        cur.current = s;
        setShown(s);
        timer.current = setTimeout(typeStep, 32);
      } else setKneading(false);
    };
    delStep();
    return () => clearTimeout(timer.current);
  }, [text, reduced]);

  return (
    <Tag className={`tipeado ${kneading ? "amasando" : ""} ${className}`} aria-label={text}>
      <span aria-hidden>{shown || " "}</span>
      <span className="cursor" aria-hidden>|</span>
    </Tag>
  );
}

// ---------- Precio que gira como contador ----------
export function Contador({ value, reduced }) {
  const [v, setV] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduced) {
      setV(value);
      from.current = value;
      return;
    }
    const a = from.current, b = value, t0 = performance.now(), dur = 520;
    let r;
    const f = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setV(a + (b - a) * e);
      if (k < 1) r = requestAnimationFrame(f);
      else from.current = b;
    };
    r = requestAnimationFrame(f);
    return () => {
      cancelAnimationFrame(r);
      from.current = b;
    };
  }, [value, reduced]);
  return <>{"$ " + (Math.round(v / 100) * 100).toLocaleString("es-AR")}</>;
}

// ---------- Loader: "tipificado..." escribiéndose ----------
export function Loader({ hidden }) {
  const word = "tipificado...";
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x < word.length ? x + 1 : x)), 55);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={"loader" + (hidden ? " is-hidden" : "")} aria-hidden={hidden}>
      <span className="loader-word">
        {word.slice(0, n)}
        <span className="cursor">|</span>
      </span>
    </div>
  );
}
