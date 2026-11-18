"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { isLight, vivo } from "@/lib/format";
import { quitarFondo, tieneTransparencia, encuadrar } from "@/lib/recorte";
import { analizar, PARES } from "@/lib/arte";
import { enOferta, precioDe, piezaAgotada } from "@/lib/precios";
import { tieneMedidas } from "@/lib/envio";
import { EscenaAuto } from "@/components/Escena";
import { useAdm, useDatos, q, money, Buscador, Filtros, Titulo, Esqueleto, Vacio, ErrorCarga, Interruptor, Segmento, Hoja, mensajeError } from "./ui";

// Paleta curada (la misma que usa la dirección de arte automática)
const PALETA = PARES.map((x) => x.pared);
const MESAS = [...new Set(PARES.map((x) => x.mesa)), "#f2ece2"];
const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ETIQUETAS = { nuevo: "Nuevo", ultimas: "Últimas" };

// Link directo a la pieza (para historias de Instagram): abre la tienda en esa pieza
const linkPieza = (p) => `${(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/+$/, "")}/?pieza=${encodeURIComponent(p.slug)}`;
async function copiarLink(p, toast) {
  if (!p.slug) return toast("Guardá la pieza primero para tener su link.");
  const link = linkPieza(p);
  try {
    await navigator.clipboard.writeText(link);
    toast(p.active ? "Link copiado ✓ Pegalo en la historia" : "Link copiado. Ojo: la pieza está oculta y el link abre la tienda en la primera pieza.", { dur: 4000 });
  } catch {
    window.prompt("Copiá el link:", link);
  }
}
const IconoLink = () => (
  <svg viewBox="0 0 24 24" aria-hidden><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
);

// ===================== LISTA =====================
export default function Piezas() {
  const { db, refrescarTienda, toast } = useAdm();
  const datos = useDatos(async () => {
    const [list, ajustes] = await Promise.all([
      q(db.from("products").select("*").order("sort")),
      q(db.from("settings").select("*")),
    ]);
    const s = Object.fromEntries((ajustes || []).map((r) => [r.key, r.value]));
    return { list: list || [], pedGen: s.pedestal || "travertino", produccion: s.produccion || "" };
  }, [db]);
  const [list, setList] = useState(null);
  useEffect(() => { if (datos.data) setList(datos.data.list); }, [datos.data]);
  const [edit, setEdit] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [cat, setCat] = useState("");

  const cats = useMemo(() => [...new Set((list || []).map((p) => p.category.split("/")[0].trim()).filter(Boolean))].sort(), [list]);
  const cuenta = (f) => (list || []).filter(f).length;
  const FILTROS = {
    todas: () => true,
    visibles: (p) => p.active,
    ocultas: (p) => !p.active,
    agotadas: (p) => piezaAgotada(p),
    oferta: (p) => enOferta(p),
  };
  const texto = busca.trim().toLowerCase();
  const filtrando = Boolean(texto || filtro !== "todas" || cat);
  const vis = (list || []).filter((p) => FILTROS[filtro](p) && (!cat || p.category.startsWith(cat)) && (!texto || (p.name + " " + p.category).toLowerCase().includes(texto)));

  // ---- reordenar: arrastrando (dedo o mouse) o con flechas ----
  const [arr, setArr] = useState(null); // { id, dy, ids }
  const drag = useRef(null);
  const guardarOrden = async (nl) => {
    setList(nl);
    try {
      await Promise.all(nl.map((p, k) => (p.sort !== k ? q(db.from("products").update({ sort: k }).eq("id", p.id)) : null)));
      setList(nl.map((p, k) => ({ ...p, sort: k })));
      refrescarTienda();
      toast("Orden guardado ✓");
    } catch (e) {
      toast(mensajeError(e));
      datos.recargar();
    }
  };
  const mover = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const nl = [...list];
    [nl[i], nl[j]] = [nl[j], nl[i]];
    guardarOrden(nl);
  };
  const tomar = (e, id) => {
    if (filtrando) return;
    e.preventDefault();
    const fila = e.currentTarget.closest(".adm-fila");
    drag.current = { id, y0: e.clientY, h: fila.offsetHeight, desde: list.findIndex((x) => x.id === id), ids: list.map((x) => x.id) };
    e.currentTarget.setPointerCapture(e.pointerId);
    setArr({ id, dy: 0, ids: drag.current.ids });
    try { navigator.vibrate?.(15); } catch {}
  };
  const arrastrar = (e) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y0;
    const destino = Math.max(0, Math.min(d.ids.length - 1, d.desde + Math.round(dy / d.h)));
    const ids = d.ids.filter((x) => x !== d.id);
    ids.splice(destino, 0, d.id);
    setArr({ id: d.id, dy: dy - (destino - d.desde) * d.h, ids });
  };
  const soltar = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !arr) return setArr(null);
    const cambio = arr.ids.some((id, k) => id !== d.ids[k]);
    setArr(null);
    if (cambio) {
      const porId = new Map(list.map((p) => [p.id, p]));
      guardarOrden(arr.ids.map((id) => porId.get(id)));
    }
  };
  const mostradas = arr ? arr.ids.map((id) => list.find((p) => p.id === id)) : vis;

  const toggle = async (p) => {
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, active: !p.active } : x)));
    try {
      await q(db.from("products").update({ active: !p.active }).eq("id", p.id));
      refrescarTienda();
      toast(p.active ? `${p.name}: oculta en la tienda` : `${p.name}: visible en la tienda`);
    } catch (e) {
      toast(mensajeError(e));
      datos.recargar();
    }
  };

  const nueva = () => setEdit({ name: "", slug: "", category: "", price: 0, sale_price: null, badge: "", production_time: "", description: "", image_url: "", bg: PALETA[3], table_color: MESAS[0], word: "", pedestal: "", colors: [], glow: false, active: true, sort: list.length, weight_g: null, height_cm: null, width_cm: null, length_cm: null, ship_estimado: false });

  return (
    <>
      <Titulo accion={<button className="adm-btn negro" onClick={nueva} disabled={!list}>+ Nueva</button>}>Piezas</Titulo>
      {datos.error && !list ? (
        <ErrorCarga error={datos.error} reintentar={datos.recargar} />
      ) : !list ? (
        <Esqueleto filas={6} alto={74} />
      ) : !list.length ? (
        <Vacio icono="◐" titulo="Todavía no hay piezas" texto="Cargá la primera: subí una foto y el panel hace el resto." accion={<button className="adm-btn negro" onClick={nueva}>Cargar una pieza</button>} />
      ) : (
        <>
          <Buscador valor={busca} onChange={setBusca} placeholder="Buscar por nombre o categoría" />
          <Filtros valor={filtro} onChange={setFiltro} opciones={[
            ["todas", "Todas", list.length], ["visibles", "Visibles", cuenta(FILTROS.visibles)], ["ocultas", "Ocultas", cuenta(FILTROS.ocultas)],
            ["agotadas", "Agotadas", cuenta(FILTROS.agotadas)], ["oferta", "En oferta", cuenta(FILTROS.oferta)],
          ]} />
          {cats.length > 1 && (
            <div className="adm-filtros sub">
              <button className={!cat ? "on" : ""} onClick={() => setCat("")}>Todas las categorías</button>
              {cats.map((c) => <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(cat === c ? "" : c)}>{c}</button>)}
            </div>
          )}
          {list.some((p) => p.active && !tieneMedidas(p)) && (
            <div className="adm-alerta">Faltan peso o medidas de la caja en: {list.filter((p) => p.active && !tieneMedidas(p)).map((p) => p.name).join(", ")}. Sin eso no se puede cotizar el envío por Andreani. Abrí la pieza y completalos.</div>
          )}
          {list.some((p) => p.ship_estimado && tieneMedidas(p)) && (
            <p className="adm-ayuda">📦 Las piezas marcadas «Envío estimado» tienen peso y caja aproximados: pesalas ya embaladas y corregilos para que el costo sea justo.</p>
          )}
          <p className="adm-ayuda">{filtrando ? "Para reordenar, sacá la búsqueda y los filtros." : "Mantené apretado ≡ y arrastrá para cambiar el orden de la tienda."}</p>
          {!mostradas.length ? (
            <Vacio icono="⌕" titulo="No hay piezas con ese filtro" accion={<button className="adm-mini" onClick={() => { setBusca(""); setFiltro("todas"); setCat(""); }}>Ver todas</button>} />
          ) : (
            <div className={"adm-lista" + (arr ? " ordenando" : "")} onPointerMove={arrastrar} onPointerUp={soltar} onPointerCancel={soltar}>
              {mostradas.map((p) => {
                const i = list.findIndex((x) => x.id === p.id);
                const moviendo = arr?.id === p.id;
                return (
                  <div className={"adm-fila pieza" + (p.active ? "" : " apagada") + (moviendo ? " arrastrando" : "")} key={p.id}
                    style={moviendo ? { transform: `translateY(${arr.dy}px)` } : undefined}>
                    <button className="adm-thumb" style={{ background: `linear-gradient(${p.bg} 0 62%, ${p.table_color || "#e6ded2"} 62%)` }} onClick={() => setEdit(p)} aria-label={"Editar " + p.name}>
                      {p.image_url && <img src={p.image_url} alt="" draggable={false} />}
                    </button>
                    <button className="adm-fila-txt" onClick={() => setEdit(p)}>
                      <b>{p.name}</b>
                      <small>
                        {enOferta(p) ? <><s>{money(p.price)}</s> {money(precioDe(p))}</> : money(p.price)} · {(p.colors || []).length} colores
                      </small>
                      <span className="adm-insignias">
                        {p.badge && <em className="ins-etiqueta">{ETIQUETAS[p.badge]}</em>}
                        {enOferta(p) && <em className="ins-oferta">Oferta</em>}
                        {piezaAgotada(p) ? <em className="ins-agotada">Agotada</em> : (p.colors || []).some((c) => c.agotado) && <em className="ins-agotada suave">Algún color agotado</em>}
                        {!p.active && <em>Oculta</em>}
                        {!tieneMedidas(p) ? <em className="ins-agotada suave">Sin peso/medidas</em> : p.ship_estimado && <em>Envío estimado</em>}
                      </span>
                    </button>
                    <div className="adm-fila-acc">
                      <button className="adm-copiar" onClick={() => copiarLink(p, toast)} aria-label={"Copiar link de " + p.name} title="Copiar link"><IconoLink /></button>
                      <Interruptor checked={p.active} onChange={() => toggle(p)} label={p.active ? "Visible en la tienda" : "Oculta"} />
                      {!filtrando && (
                        <>
                          <span className="adm-flechas solo-compu">
                            <button onClick={() => mover(i, -1)} aria-label="Subir" disabled={i === 0}>↑</button>
                            <button onClick={() => mover(i, 1)} aria-label="Bajar" disabled={i === list.length - 1}>↓</button>
                          </span>
                          <button className="adm-agarre" onPointerDown={(e) => tomar(e, p.id)} aria-label={"Arrastrar " + p.name + " para reordenar"}
                            onKeyDown={(e) => { if (e.key === "ArrowUp") mover(i, -1); if (e.key === "ArrowDown") mover(i, 1); }}>≡</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {edit && (
        <Editor prod={edit} usados={list.filter((x) => x.id !== edit.id).map((x) => x.bg)} pedestalGeneral={datos.data?.pedGen} produccionGeneral={datos.data?.produccion}
          ultimoSort={list.length} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); datos.recargar(); }} />
      )}
    </>
  );
}

// ===================== FOTOS =====================
function aWebp(canvas) {
  return new Promise((ok) => canvas.toBlob(ok, "image/webp", 0.88));
}

// Versión de 800 px (lado más largo) para celulares; la tienda la busca con el sufijo "-800"
function achicar(canvas, lado = 800) {
  const k = lado / Math.max(canvas.width, canvas.height);
  if (k >= 1) return canvas;
  const c = document.createElement("canvas");
  c.width = Math.round(canvas.width * k);
  c.height = Math.round(canvas.height * k);
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

// Cualquier foto sirve: si no viene sin fondo, se lo sacamos acá mismo (gratis, en el navegador).
async function recortar(file, pro, session, setBusy) {
  if (pro) {
    setBusy("Recorte pro…");
    const fd = new FormData();
    fd.append("image", file);
    const r = await fetch("/api/quitar-fondo", { method: "POST", headers: { Authorization: "Bearer " + session.access_token }, body: fd });
    if (!r.ok) throw new Error((await r.json()).error || "No se pudo quitar el fondo");
    const bmp = await createImageBitmap(await r.blob());
    const c = document.createElement("canvas");
    c.width = bmp.width; c.height = bmp.height;
    c.getContext("2d").drawImage(bmp, 0, 0);
    return encuadrar(c);
  }
  setBusy("Leyendo la foto…");
  const bmp = await createImageBitmap(file);
  if (tieneTransparencia(bmp)) {
    const c = document.createElement("canvas");
    c.width = bmp.width; c.height = bmp.height;
    c.getContext("2d").drawImage(bmp, 0, 0);
    return encuadrar(c);
  }
  return quitarFondo(bmp, setBusy);
}

// ---------- Vista previa: la estación de la pieza en el mismo taller 3D que la tienda ----------
// (pedestal + pared + palabra pintada, con sus colores), sin gestos.
function Escenita({ p, foto, pedestalGeneral }) {
  const src = foto?.image_url || p.image_url;
  const bg = foto?.bg || p.bg;
  const mesa = foto?.table_color || p.table_color || MESAS[0];
  const tipo = p.pedestal || pedestalGeneral || "travertino";
  const palabra = (p.word || p.name.split(/[s/]+/).sort((a, b) => b.length - a.length)[0] || "").toUpperCase();
  const piezas = useMemo(
    () => [{ src: src || "", grande: src || "", tipo, glow: !!p.glow, palabra, pared: bg, mesa, clara: isLight(bg, 0.55) }],
    [src, tipo, p.glow, palabra, bg, mesa]
  );
  return (
    <div className="adm-escena" style={{ "--pared": vivo(bg), "--mesa": vivo(mesa, 1.06) }}>
      <div className="set">
        <EscenaAuto piezas={piezas} mesa={tipo} vista={{ w: 330, h: 640 }} pedMin={70} techo={8} />
        {!src && <p className="adm-esc-vacia">Subí una foto de la pieza 📸<br />Cualquier foto: el fondo se quita solo.</p>}
      </div>
    </div>
  );
}

// ===================== EDITOR =====================
export function Editor({ prod, usados = [], pedestalGeneral = "travertino", produccionGeneral = "", ultimoSort = 0, onClose, onSaved }) {
  const { db, session, refrescarTienda, toast, confirmar } = useAdm();
  const [p, setP] = useState({ ...prod, sale_price: prod.sale_price ?? null, badge: prod.badge || "", production_time: prod.production_time || "", weight_g: prod.weight_g ?? null, height_cm: prod.height_cm ?? null, width_cm: prod.width_cm ?? null, length_cm: prod.length_cm ?? null, colors: (prod.colors || []).map((c) => ({ ...c })) });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [canRemove, setCanRemove] = useState(false);
  const [arte, setArte] = useState(null); // lo que propuso la dirección de arte automática
  const [vista, setVista] = useState(-1); // -1 = foto principal; i = foto del color i
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setColor = (i, patch) => setP((x) => ({ ...x, colors: x.colors.map((c, k) => (k === i ? { ...c, ...patch } : c)) }));
  const cambios = useRef(false);
  useEffect(() => { cambios.current = JSON.stringify(p) !== JSON.stringify({ ...prod, sale_price: prod.sale_price ?? null, badge: prod.badge || "", production_time: prod.production_time || "", weight_g: prod.weight_g ?? null, height_cm: prod.height_cm ?? null, width_cm: prod.width_cm ?? null, length_cm: prod.length_cm ?? null, colors: prod.colors || [] }); }, [p, prod]);

  useEffect(() => {
    fetch("/api/quitar-fondo").then((r) => r.json()).then((j) => setCanRemove(Boolean(j.enabled))).catch(() => {});
  }, []);

  const subirCanvas = async (canvas, nombre) => {
    setBusy("Subiendo…");
    const base = `${slugify(nombre || p.name || "pieza")}-${Date.now()}`;
    const [grande, chica] = await Promise.all([aWebp(canvas), aWebp(achicar(canvas))]);
    const subida = (path, blob) => db.storage.from("productos").upload(path, blob, { contentType: "image/webp", upsert: true });
    // la de 1600 y la de 800 ("-800", la misma convención que deriva la tienda desde image_url)
    const [r1, r2] = await Promise.all([subida(`${base}.webp`, grande), subida(`${base}-800.webp`, chica)]);
    if (r1.error) throw r1.error;
    if (r2.error) console.warn("No se pudo subir la versión de 800:", r2.error.message); // la tienda vuelve a la grande sola
    const { data } = db.storage.from("productos").getPublicUrl(`${base}.webp`);
    return data.publicUrl;
  };

  // Foto principal: recorte + dirección de arte (pared, mesa y brillo)
  const subir = async (file, pro) => {
    setErr("");
    try {
      const canvas = await recortar(file, pro, session, setBusy);
      setBusy("Eligiendo colores…");
      const a = analizar(canvas, { evitar: usados });
      const url = await subirCanvas(canvas);
      setP((x) => ({ ...x, image_url: url, bg: a.pared, table_color: a.mesa, glow: a.conLuces }));
      setArte(a);
      setVista(-1);
    } catch (e) {
      setErr(mensajeError(e));
    }
    setBusy("");
  };

  // Foto de un color: el mismo recorte y la misma dirección de arte
  const subirFotoColor = async (i, file) => {
    setErr("");
    try {
      const canvas = await recortar(file, false, session, setBusy);
      setBusy("Eligiendo colores…");
      const a = analizar(canvas, { evitar: usados });
      const url = await subirCanvas(canvas, `${p.name}-${p.colors[i].name}`);
      setColor(i, { image_url: url, bg: a.pared, table_color: a.mesa });
      setVista(i);
    } catch (e) {
      setErr(mensajeError(e));
    }
    setBusy("");
  };

  const otraCombinacion = () => {
    const i = PARES.findIndex((x) => x.pared === p.bg);
    const n = PARES[(i + 1) % PARES.length];
    setP((x) => ({ ...x, bg: n.pared, table_color: n.mesa }));
    setArte((a) => (a ? { ...a, nombre: n.nombre, razon: `Probando ${n.nombre.toLowerCase()}.` } : a));
  };

  // Vuelve a correr la dirección de arte sobre la foto actual
  const sugerir = () => {
    if (!p.image_url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      const a = analizar(c, { evitar: usados });
      setP((x) => ({ ...x, bg: a.pared, table_color: a.mesa, glow: a.conLuces }));
      setArte(a);
    };
    img.src = p.image_url;
  };

  const fila = () => ({
    slug: p.slug || slugify(p.name), name: p.name.trim(), category: p.category.trim(), price: Math.round(Number(p.price) || 0),
    sale_price: Number(p.sale_price) > 0 ? Math.round(Number(p.sale_price)) : null, badge: p.badge || "", production_time: (p.production_time || "").trim(),
    description: p.description.trim(), image_url: p.image_url, bg: p.bg, table_color: p.table_color || MESAS[0], word: (p.word || "").trim(), pedestal: p.pedestal || "",
    colors: p.colors.filter((c) => c.name.trim()).map((c) => Object.fromEntries(Object.entries({ ...c, name: c.name.trim() }).filter(([, v]) => v !== undefined && v !== "" && v !== false))),
    glow: p.glow, active: p.active, sort: p.sort ?? 0,
    weight_g: Number(p.weight_g) > 0 ? Math.round(Number(p.weight_g)) : null,
    height_cm: Number(p.height_cm) > 0 ? Number(p.height_cm) : null,
    width_cm: Number(p.width_cm) > 0 ? Number(p.width_cm) : null,
    length_cm: Number(p.length_cm) > 0 ? Number(p.length_cm) : null,
    // si el dueño tocó el peso o la caja, dejan de ser «estimados»
    ship_estimado: ["weight_g", "height_cm", "width_cm", "length_cm"].some((k) => Number(p[k] ?? 0) !== Number(prod[k] ?? 0)) ? false : !!prod.ship_estimado,
  });

  const guardar = async () => {
    setErr("");
    if (!p.name.trim()) return setErr("Ponele nombre a la pieza.");
    if (!p.image_url) return setErr("Falta la foto.");
    if (!(Number(p.price) > 0)) return setErr("Poné el precio.");
    if (p.sale_price && Number(p.sale_price) >= Number(p.price)) return setErr("El precio de oferta tiene que ser menor al precio normal.");
    setBusy("Guardando…");
    const row = fila();
    const { error } = p.id ? await db.from("products").update(row).eq("id", p.id) : await db.from("products").insert(row);
    setBusy("");
    if (error) return setErr(/duplicate/.test(error.message) ? "Ya hay una pieza con ese nombre. Cambiale el nombre." : mensajeError(error));
    await refrescarTienda();
    toast("Guardado ✓ La tienda ya está actualizada");
    onSaved();
  };

  const duplicar = async () => {
    setBusy("Duplicando…");
    const row = { ...fila(), name: p.name.trim() + " (copia)", slug: slugify(p.name) + "-copia-" + Math.random().toString(36).slice(2, 6), active: false, sort: ultimoSort };
    const { error } = await db.from("products").insert(row);
    setBusy("");
    if (error) return setErr(mensajeError(error));
    toast("Copia creada. Queda oculta hasta que la actives.");
    onSaved();
  };

  const eliminar = async () => {
    const ok = await confirmar({ titulo: `¿Borrar «${p.name}»?`, texto: "Se borra para siempre de la tienda. Los pedidos viejos no se tocan. Si solo querés esconderla, apagá el interruptor «Visible».", si: "Borrar pieza" });
    if (!ok) return;
    const { error } = await db.from("products").delete().eq("id", p.id);
    if (error) return setErr(mensajeError(error));
    await refrescarTienda();
    toast("Pieza borrada");
    onSaved();
  };

  const cerrar = async () => {
    if (cambios.current && !(await confirmar({ titulo: "¿Salir sin guardar?", texto: "Los cambios que hiciste se pierden.", si: "Salir sin guardar" }))) return;
    onClose();
  };

  const descuento = p.sale_price && Number(p.price) > 0 ? Math.round((1 - Number(p.sale_price) / Number(p.price)) * 100) : 0;
  const fotoVista = vista >= 0 ? p.colors[vista] : null;

  return (
    <Hoja titulo={p.id ? "Editar pieza" : "Nueva pieza"} onCerrar={cerrar} cancelar="Cancelar"
      accion={<button className="azul" onClick={guardar} disabled={!!busy}>Guardar</button>}>
      <div className="adm-preview-wrap">
        <Escenita p={p} foto={fotoVista} pedestalGeneral={pedestalGeneral} />
        {busy && <div className="adm-busy">{busy}</div>}
      </div>
      {p.colors.some((c) => c.image_url) && (
        <div className="adm-vistas">
          <span>Ver con:</span>
          <button className={vista < 0 ? "on" : ""} onClick={() => setVista(-1)}>Foto principal</button>
          {p.colors.map((c, i) => c.image_url && (
            <button key={i} className={vista === i ? "on" : ""} onClick={() => setVista(i)}><i style={{ background: c.hex }} />{c.name || "Color"}</button>
          ))}
        </div>
      )}
      <div className="adm-grupo">
        <label className="adm-btn negro">
          {p.image_url ? "Cambiar foto" : "Subir foto de la pieza"}
          <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) subir(f, false); }} />
        </label>
        <p className="adm-ayuda">Cualquier foto sirve, aunque tenga fondo: lo sacamos solos y elegimos los colores. Para que salga perfecta: la pieza entera, con buena luz, sobre un fondo liso y sin textos encima.</p>
        {canRemove && (
          <label className="adm-btn">
            ¿El recorte quedó feo? Probá el recorte pro
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) subir(f, true); }} />
          </label>
        )}
      </div>
      {arte && (
        <div className="adm-arte">
          <b>✨ {arte.nombre}{arte.conLuces ? " · brillo de luces activado 💡" : ""}</b>
          <span>{arte.razon}</span>
          {arte.avisos.map((t) => <span key={t} className="adm-aviso">⚠️ {t}</span>)}
          <button className="adm-mini" onClick={otraCombinacion}>Probar otra combinación</button>
        </div>
      )}

      <div className="adm-grupo campos">
        <label>Nombre<input value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="ej: Taza panzona" /></label>
        <label>Categoría<input value={p.category} placeholder="ej: taza panzona" onChange={(e) => set("category", e.target.value)} /></label>
        <div className="adm-dos">
          <label>Precio<input inputMode="numeric" value={p.price || ""} placeholder="$" onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} /></label>
          <label>Precio de oferta <small>(opcional)</small><input inputMode="numeric" value={p.sale_price || ""} placeholder="sin oferta" onChange={(e) => set("sale_price", e.target.value.replace(/\D/g, "") || null)} /></label>
        </div>
        {descuento > 0 && descuento < 100 && <p className="adm-ayuda">En la tienda se ve <s>{money(p.price)}</s> <b>{money(p.sale_price)}</b> ({descuento}% menos).</p>}
        <label>Descripción<textarea rows={3} value={p.description} onChange={(e) => set("description", e.target.value)} /></label>
        <label>Tiempo de producción <small>(si lo dejás vacío, usa el general)</small><input value={p.production_time} placeholder={produccionGeneral ? "General: " + produccionGeneral.slice(0, 60) : "ej: 15 a 20 días"} onChange={(e) => set("production_time", e.target.value)} /></label>
        <label>Palabra gigante de fondo <small>(opcional)</small><input value={p.word || ""} placeholder="ej: PANZONA" onChange={(e) => set("word", e.target.value.toUpperCase().slice(0, 12))} /></label>
      </div>

      <p className="adm-label">Envío: peso y caja {p.ship_estimado && <small>· valores estimados, revisalos</small>}</p>
      <div className="adm-grupo campos">
        <label>Peso con la pieza ya embalada <small>(gramos)</small><input inputMode="numeric" value={p.weight_g ?? ""} placeholder="ej: 800" onChange={(e) => set("weight_g", e.target.value.replace(/\D/g, "") || null)} /></label>
        <div className="adm-tres">
          <label>Alto <small>(cm)</small><input inputMode="decimal" value={p.height_cm ?? ""} placeholder="15" onChange={(e) => set("height_cm", e.target.value.replace(/[^\d.]/g, "") || null)} /></label>
          <label>Ancho <small>(cm)</small><input inputMode="decimal" value={p.width_cm ?? ""} placeholder="15" onChange={(e) => set("width_cm", e.target.value.replace(/[^\d.]/g, "") || null)} /></label>
          <label>Largo <small>(cm)</small><input inputMode="decimal" value={p.length_cm ?? ""} placeholder="15" onChange={(e) => set("length_cm", e.target.value.replace(/[^\d.]/g, "") || null)} /></label>
        </div>
        {!tieneMedidas(p) ? <p className="adm-aviso">⚠️ Sin peso y medidas completos no se puede cotizar el envío de esta pieza.</p> : <p className="adm-ayuda">Medidas de la caja con la que la mandás. Con esto se calcula el envío.</p>}
      </div>

      <p className="adm-label">Etiqueta en la tienda</p>
      <Segmento valor={p.badge || ""} onChange={(v) => set("badge", v)} opciones={[["", "Ninguna"], ["nuevo", "Nuevo"], ["ultimas", "Últimas"]]} />

      <p className="adm-label">Colores (el primero es el de la foto)</p>
      <div className="adm-grupo">
        {p.colors.map((c, i) => (
          <div className={"adm-color" + (c.agotado ? " agotado" : "")} key={i}>
            <input type="color" value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value })} aria-label="Color" />
            <input value={c.name} placeholder="Nombre del color" onChange={(e) => setColor(i, { name: e.target.value })} />
            <label className="adm-color-foto" title={c.image_url ? "Cambiar la foto de este color" : "Agregar una foto de este color (opcional)"}>
              {c.image_url ? <img src={c.image_url} alt="" /> : <span>+ Foto</span>}
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) subirFotoColor(i, f); }} />
            </label>
            <button onClick={async () => { if (await confirmar({ titulo: `¿Quitar el color «${c.name || "sin nombre"}»?`, si: "Quitar" })) { setP((x) => ({ ...x, colors: x.colors.filter((_, k) => k !== i) })); setVista(-1); } }} aria-label="Quitar color">×</button>
            <div className="adm-color-pie">
              <span className="adm-check-mini">
                <Interruptor checked={!c.agotado} onChange={(v) => setColor(i, { agotado: !v })} label={c.agotado ? "Agotado" : "Hay"} />
                {c.agotado ? "Agotado (se ve tachado)" : "Hay"}
              </span>
              {c.image_url && <button className="adm-link" onClick={() => { setColor(i, { image_url: undefined, bg: undefined, table_color: undefined }); setVista(-1); }}>Quitar foto</button>}
            </div>
          </div>
        ))}
        <button className="adm-mini" onClick={() => set("colors", [...p.colors, { name: "", hex: "#b3262b" }])}>+ Agregar color</button>
        <p className="adm-ayuda">La foto por color es opcional: si el cliente elige ese color en la ficha, ve esa foto.</p>
      </div>

      <p className="adm-label">Color de la pared</p>
      <div className="adm-paleta">
        {PALETA.map((c) => <button key={c} style={{ background: c }} className={p.bg === c ? "on" : ""} onClick={() => set("bg", c)} aria-label={c} />)}
        <label className="adm-picker" style={{ background: p.bg }}><input type="color" value={p.bg} onChange={(e) => set("bg", e.target.value)} />+</label>
        <button className="adm-mini" onClick={sugerir}>✨ Elegir solo</button>
      </div>

      <p className="adm-label">Color de la mesa</p>
      <div className="adm-paleta">
        {MESAS.map((c) => <button key={c} style={{ background: c }} className={(p.table_color || MESAS[0]) === c ? "on" : ""} onClick={() => set("table_color", c)} aria-label={c} />)}
        <label className="adm-picker" style={{ background: p.table_color || MESAS[0], color: "#26201c" }}><input type="color" value={p.table_color || MESAS[0]} onChange={(e) => set("table_color", e.target.value)} />+</label>
      </div>

      <p className="adm-label">Pedestal</p>
      <Segmento valor={p.pedestal || ""} onChange={(v) => set("pedestal", v)} opciones={[["", "El general"], ["travertino", "Travertino"], ["torno", "Torno de alfarero"]]} />

      <div className="adm-grupo">
        <label className="adm-check"><span>Visible en la tienda</span><Interruptor checked={p.active} onChange={(v) => set("active", v)} label="Visible en la tienda" /></label>
        <label className="adm-check"><span>Brillo de luz <small>(piezas con luz adentro)</small></span><Interruptor checked={p.glow} onChange={(v) => set("glow", v)} label="Brillo de luz" /></label>
      </div>
      {err && <p className="adm-err" role="alert">{err}</p>}
      <button className="adm-btn azul-txt" onClick={guardar} disabled={!!busy}>Guardar cambios</button>
      {p.id && <button className="adm-btn" onClick={() => copiarLink(prod, toast)}>Copiar link para historias</button>}
      {p.id && <button className="adm-btn" onClick={duplicar} disabled={!!busy}>Duplicar pieza</button>}
      {p.id && <button className="adm-btn rojo" onClick={eliminar}>Borrar pieza</button>}
    </Hoja>
  );
}
