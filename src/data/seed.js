// Catálogo inicial armado a partir de las fotos del cliente.
// Los precios marcados "provisorio" no los pasó todavía: se corrigen desde /admin.
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
};

// Opciones de entrega por defecto
export const seedEnvios = [
  { id: "retiro", kind: "retiro", name: "Retiro en el taller", address: "", hours: "Lunes a viernes de 10 a 18 h", price: 0, active: true, sort: 0 },
  { id: "coordinar", kind: "coordinar", name: "Envío a coordinar", address: "", hours: "", price: 0, active: true, sort: 1 },
];

export const seedProducts = [
  {
    slug: "pino-navidad",
    name: "Pino de navidad",
    category: "deco / navidad",
    price: 28000, // provisorio
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
    price: 15500,
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
    price: 9500,
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
    category: "portamacetas / maceta para plantas acuáticas",
    price: 18000,
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
    price: 32000,
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
    price: 15500, // provisorio
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
    price: 22000, // provisorio
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
    category: "portamacetas / maceta para plantas acuáticas",
    price: 18000,
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
    price: 16000, // provisorio
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
    price: 17000, // provisorio
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
