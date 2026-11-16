import Comprobante from "./Comprobante";
import "../../admin.css";

export const metadata = { title: "Comprobante · tipificado…|", robots: { index: false } };

export default async function Page({ params }) {
  const { id } = await params;
  return <Comprobante id={id} />;
}
