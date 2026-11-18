// Logo de la marca: "tipificado…" vectorizado del logo oficial (public/marca/logo-texto.svg,
// pintado con el color del texto vía máscara) + el cursor "|" que titila.
// El tamaño lo da font-size (1em = alto del logo). Sirve en la tienda, el telón y el panel.
export function Logo({ className = "", titila = true }) {
  return (
    <span className={"marca " + className} role="img" aria-label="tipificado…">
      <span className="marca-texto" />
      <span className={"marca-cursor" + (titila ? "" : " quieto")} />
    </span>
  );
}
