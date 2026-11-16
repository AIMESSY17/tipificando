import Form from "./Form";

export const metadata = { title: "Botón de arrepentimiento · tipificado…|" };

export default function Arrepentimiento() {
  return (
    <main className="simple">
      <h1>Botón de arrepentimiento</h1>
      <p>
        Si compraste online, tenés 10 días corridos desde que recibiste la pieza para arrepentirte de la compra.
        Completá el formulario y te damos un código de solicitud.
      </p>
      <Form />
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        Defensa del Consumidor:{" "}
        <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor" target="_blank" rel="noreferrer">argentina.gob.ar/defensadelconsumidor</a>
      </p>
      <p><a href="/">Volver a la tienda</a></p>
    </main>
  );
}
