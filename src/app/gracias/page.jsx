import ClearCart from "./ClearCart";
import { adminDb } from "@/lib/server";
import { procesarPago, esUuid } from "@/lib/pagos";
import { numPedido } from "@/lib/precios";

export const metadata = { title: "¡Gracias! · tipificado…|", robots: { index: false } };
export const dynamic = "force-dynamic";

const TXT = {
  aprobado: ["¡Gracias por tu compra!", "Tu pago se acreditó. Ya empezamos a preparar tu pieza: te escribimos para coordinar la entrega."],
  pendiente: ["Tu pago está pendiente", "Mercado Pago todavía lo está procesando. Apenas se acredite, te avisamos."],
  rechazado: ["El pago no se completó", "No se cobró nada. Podés volver a intentar o mandarnos el pedido por DM."],
  devuelto: ["El pago fue devuelto", "Mercado Pago devolvió el dinero de este pedido. Si tenés dudas, escribinos."],
  desconocido: ["No encontramos tu pedido", "Si pagaste, quedate tranquilo: te escribimos apenas se acredite. Ante cualquier duda, mandanos un mensaje."],
};
const GRUPO = {
  pagado: "aprobado", "en produccion": "aprobado", enviado: "aprobado", entregado: "aprobado",
  pendiente: "pendiente", rechazado: "rechazado", cancelado: "rechazado", devuelto: "devuelto",
};

// Al volver de Mercado Pago: el estado sale de la BASE, no del parámetro de la URL.
// Si el pedido sigue pendiente y MP trajo el número de pago, lo consultamos a MP en el momento
// (por si el webhook todavía no llegó). Es idempotente: no duplica nada.
async function leerPedido(id, paymentId) {
  const db = adminDb();
  if (!db || !esUuid(id)) return null;
  const leer = async () => (await db.from("orders").select("number, status").eq("id", id).maybeSingle()).data;
  let o = await leer();
  if (o?.status === "pendiente" && /^\d{1,20}$/.test(paymentId || "")) {
    await procesarPago(paymentId, { pedidoEsperado: id }).catch(() => {});
    o = await leer();
  }
  return o;
}

export default async function Gracias({ searchParams }) {
  const sp = await searchParams;
  const id = String(sp.pedido || sp.external_reference || "");
  const paymentId = String(sp.payment_id || sp.collection_id || "");
  const o = await leerPedido(id, paymentId);
  const estado = o ? GRUPO[o.status] || "pendiente" : "desconocido";
  const [t, d] = TXT[estado];
  return (
    <main className="simple">
      {estado === "aprobado" && <ClearCart />}
      {o?.number && <p className="nota">Pedido {numPedido(o.number)}</p>}
      <h1>{t}</h1>
      <p>{d}</p>
      <p><a className="btn-oscuro" href="/">Volver a la tienda</a></p>
    </main>
  );
}
