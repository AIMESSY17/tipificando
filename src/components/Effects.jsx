// ---------- Loader: el logo "tipificado…" escribiéndose, con el cursor (el telón) ----------
// Cubre la pantalla hasta que la escena 3D ya está dibujada (la tienda decide cuándo).
export function Loader({ hidden }) {
  return (
    <div className={"loader" + (hidden ? " is-hidden" : "")} aria-hidden={hidden} role="status" aria-label="Cargando">
      <span className="marca loader-marca" aria-hidden>
        <span className="loader-tipeo"><span className="marca-texto" /></span>
        <span className="marca-cursor" />
      </span>
    </div>
  );
}
