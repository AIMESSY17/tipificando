"use client";
import { useEffect, useState } from "react";

// ---------- Loader: "tipificado..." escribiéndose (el telón) ----------
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
