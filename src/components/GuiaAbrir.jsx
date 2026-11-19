"use client";
import { Tipeo } from "./Hoja";

// Mini guía del gesto «deslizá para abrir ↑» (primera visita en el celu; la muestra Store.jsx).
// Una manito en trazo fino sube dos veces sobre la protagonista dejando una estela, y arriba de la
// pieza se tipea el texto. Se ubica con el rectángulo de la protagonista que escribe el taller
// (--pz-*). Con movimiento reducido: solo el texto, sin animación.
export function GuiaAbrir({ reducido }) {
  return (
    <div className={"guia-abrir" + (reducido ? " quieta" : "")} aria-hidden>
      {!reducido && <span className="guia-estela" />}
      {!reducido && (
        <span className="guia-mano">
          <svg viewBox="0 0 34 44" width="34" height="44">
            <path
              d="M12.5 23V5.8a2.6 2.6 0 0 1 5.2 0V18m0-3.2a2.6 2.6 0 0 1 5.2 0V19m0-2.6a2.6 2.6 0 0 1 5.2 0v2.8m0-.4a2.5 2.5 0 0 1 5 .2V28c0 8-4.6 13.5-11.4 13.5h-1.6c-4.2 0-6.6-1.8-8.8-5.2l-5.6-8.6a2.4 2.4 0 0 1 3.7-3L12.5 28"
              fill="var(--guia-relleno)"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
      <p className="guia-txt">
        <Tipeo texto="deslizá para abrir ↑" ms={45} demora={reducido ? 0 : 350} reducido={reducido} cursor />
      </p>
    </div>
  );
}
