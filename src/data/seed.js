// Catálogo inicial armado a partir de las fotos del cliente (respaldo: el catálogo real vive en
// Supabase y lo carga el cliente desde el panel). Precios de la lista oficial (lista-precios).
// Los marcados "a confirmar" no figuran en la lista: se corrigen desde /admin.
// Si Supabase no está configurado, la tienda usa este archivo tal cual.

export const seedSettings = {
  tagline: "cerámica para la mesa, el escritorio y la casa",
  instagram: "tipificado_",
  produccion: "Cada pieza se hace a pedido, en el color que elijas. Demora aprox. 10 a 15 días.",
  envio: "Envío a coordinar por DM una vez confirmado el pedido.",
  pedestal: "travertino", // travertino | torno
  whatsapp: "",
  negocio_nombre: "",
  negocio_cuit: "",
  negocio_direccion: "",
  vacaciones: { activo: false, vuelta: "", mensaje: "" },
  // Privados: no se mandan al navegador (ver page.jsx) ni los lee el público (ver schema.sql)
  envio_cfg: { referencia: "andreani", factor: 1, margen: 10, redondeo: 100, gratis_desde: 0 },
  envio_respaldo: {},
};

// Opciones de entrega por defecto
export const seedEnvios = [
  { id: "retiro", kind: "retiro", name: "Retiro en el taller", address: "", hours: "Lunes a viernes de 10 a 18 h", price: 0, active: true, sort: 0 },
  { id: "coordinar", kind: "coordinar", name: "Envío a coordinar", address: "", hours: "", price: 0, active: true, sort: 1 },
  { id: "andreani", kind: "andreani", name: "Envío por Andreani", address: "", hours: "", price: 0, active: true, sort: 2 },
];

const productosBase = [
  {
    slug: "palta",
    name: "Palta",
    category: "plato palta",
    price: 45000,
    description: "Plato con forma de palta y el logo estampado a mano. Para la picada, las tostadas del desayuno o el centro de la mesa.",
    image_url: "/productos/palta.webp",
    bg: "#6f7a3f",
    table_color: "#d7b48c",
    word: "PALTA",
    badge: "nuevo",
    // REVISAR: colores a definir con el cliente (por ahora solo el de la foto)
    colors: [{ name: "Crema", hex: "#ecd59c" }],
  },
  {
    slug: "pino-navidad",
    name: "Pino de navidad",
    category: "deco / navidad",
    price: 28000, // a confirmar (no está en la lista)
    description: "Pino de cerámica calado con luz adentro. Cuando lo prendés, los agujeritos tiran puntos de luz por toda la mesa.",
    image_url: "/productos/pino-navidad.webp",
    bg: "#6e1a22",
    table_color: "#c9a48a",
    word: "PINO",
    glow: true,
    colors: [
      { name: "Rojo moteado", hex: "#b3262b" },
      { name: "Crudo", hex: "#efe4cc" },
      { name: "Verde", hex: "#3f6b4a" },
    ],
  },
  {
    slug: "taza-panzona",
    name: "Taza panzona",
    category: "taza panzona",
    price: 35000,
    description: "La taza redondita, de las que se agarran con las dos manos. Para el mate cocido de la tarde o el café largo.",
    image_url: "/productos/taza-panzona.webp",
    bg: "#c46a4c",
    table_color: "#e9d2bf",
    word: "PANZONA",
    colors: [
      { name: "Marrón", hex: "#5b2a1f" },
      { name: "Verde", hex: "#3f6b4a" },
      { name: "Rojo", hex: "#b3262b" },
    ],
  },
  {
    slug: "platillo",
    name: "Platillo Tipificado",
    category: "platillo",
    price: 25000,
    description: "Un infaltable para tu mesa: pequeño, versátil y con toda la identidad de la marca. Para anillos, aceitunas o la cucharita.",
    image_url: "/productos/platillo.webp",
    bg: "#a8cde0",
    table_color: "#ece4d4",
    word: "PLATILLO",
    colors: [
      { name: "Celeste", hex: "#4fa3c4" },
      { name: "Rojo", hex: "#b3262b" },
      { name: "Bordó", hex: "#6e1f24" },
    ],
  },
  {
    slug: "portamacetas-rayado",
    name: "Portamacetas rayado",
    category: "medio tubo · hielera / maceta",
    price: 45000,
    description: "Portamacetas con rayas verticales pintadas a mano. También sirve como maceta para plantas acuáticas.",
    image_url: "/productos/portamacetas-rayado.webp",
    bg: "#8c9aae",
    table_color: "#ddd5c8",
    word: "RAYADO",
    colors: [
      { name: "Gris azulado", hex: "#6b7c93" },
      { name: "Celeste", hex: "#4fa3c4" },
      { name: "Verde", hex: "#3f6b4a" },
    ],
  },
  {
    slug: "budinera",
    name: "Budinera de cerámica",
    category: "budinera",
    price: 32000, // a confirmar (no está en la lista)
    description: "Budinera rectangular con trazos pintados a mano. Va al horno y después a la mesa, sin pasar por la fuente.",
    image_url: "/productos/budinera.webp",
    bg: "#b4a3c8",
    table_color: "#e6ded2",
    word: "BUDINERA",
    colors: [
      { name: "Celeste", hex: "#4fa3c4" },
      { name: "Gris azulado", hex: "#6b7c93" },
      { name: "Verde", hex: "#3f6b4a" },
    ],
  },
  {
    slug: "taza-clasica",
    name: "Taza clásica",
    category: "taza clásica",
    price: 15500, // a confirmar (no está en la lista)
    description: "La de todos los días. Recta, cómoda y con el logo estampado a mano.",
    image_url: "/productos/taza-clasica.webp",
    bg: "#8fa595",
    table_color: "#dcd4c4",
    word: "CLÁSICA",
    colors: [
      { name: "Petróleo", hex: "#1f6a73" },
      { name: "Rojo", hex: "#b3262b" },
      { name: "Negro", hex: "#2a2623" },
    ],
  },
  {
    slug: "pochoclera",
    name: "Pochoclera",
    category: "tu nueva pochoclera",
    price: 22000, // a confirmar (no está en la lista)
    description: "Bowl alto a rayas para la noche de peli. Entra un paquete entero de pochoclos (y un poco más).",
    image_url: "/productos/pochoclera.webp",
    bg: "#b5261d",
    table_color: "#ddbba8",
    word: "POCHOCLERA",
    colors: [
      { name: "Rayas gris", hex: "#5d6470" },
      { name: "Rayas rojas", hex: "#b3262b" },
      { name: "Rayas verdes", hex: "#3f6b4a" },
    ],
  },
  {
    slug: "portamacetas-moteado",
    name: "Portamacetas moteado",
    category: "medio tubo · hielera / maceta",
    price: 45000,
    description: "Portamacetas con salpicado de esmalte, cada uno distinto al otro. También sirve como maceta para plantas acuáticas.",
    image_url: "/productos/portamacetas-moteado.webp",
    bg: "#a8907e",
    table_color: "#ddd5c8",
    word: "MOTEADO",
    colors: [
      { name: "Moteado verde", hex: "#2f5b45" },
      { name: "Moteado negro", hex: "#2a2623" },
      { name: "Moteado azul", hex: "#3d5f9a" },
    ],
  },
  {
    slug: "plato-hondo",
    name: "Plato hondo / cazuela",
    category: "plato hondo / cazuela",
    price: 50000,
    description: "Plato hondo de borde recto, para guiso, fideos o ensalada. Aguanta microondas y lavavajillas.",
    image_url: "/productos/plato-hondo.webp",
    bg: "#9e4b3e",
    table_color: "#e3cfc0",
    word: "CAZUELA",
    colors: [
      { name: "Rojo", hex: "#b3262b" },
      { name: "Celeste", hex: "#4fa3c4" },
      { name: "Verde", hex: "#3f6b4a" },
    ],
  },
  {
    slug: "tazon",
    name: "Tazón",
    category: "tazón",
    price: 40000,
    description: "Tazón bajo y ancho, para el desayuno con cereales o el café con leche bien cargado.",
    image_url: "/productos/tazon.webp",
    bg: "#9db0a0",
    table_color: "#dcd4c4",
    word: "TAZÓN",
    colors: [
      { name: "Negro", hex: "#2a2623" },
      { name: "Celeste", hex: "#4fa3c4" },
      { name: "Rojo", hex: "#b3262b" },
    ],
  },
].map((p, i) => ({ id: p.slug, active: true, sort: i, glow: false, ...p }));

// Peso (g, ya embalada) y caja (cm). ESTIMADOS: el dueño los revisa desde el panel → Piezas.
const caja = (weight_g, height_cm, width_cm, length_cm) => ({ weight_g, height_cm, width_cm, length_cm, ship_estimado: true });
const CAJAS = {
  "palta": caja(700, 6, 24, 32),
  "pino-navidad": caja(1000, 28, 18, 18),
  "taza-panzona": caja(800, 15, 15, 15),
  "platillo": caja(400, 8, 15, 15),
  "portamacetas-rayado": caja(1200, 20, 20, 20),
  "budinera": caja(1500, 12, 18, 32),
  "taza-clasica": caja(800, 15, 15, 15),
  "pochoclera": caja(1300, 20, 22, 22),
  "portamacetas-moteado": caja(1200, 20, 20, 20),
  "plato-hondo": caja(900, 12, 22, 22),
  "tazon": caja(900, 12, 22, 22),
};
export const seedProducts = productosBase.map((p) => ({ ...p, ...CAJAS[p.slug] }));
