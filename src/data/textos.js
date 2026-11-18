// =====================================================================
//  Textos de las hojas formales (/preguntas, /cambios, /envios, /terminos).
//  BORRADOR: son textos base para Argentina. Revisalos con el cliente (y, si se puede, con un
//  abogado/contador) antes de darlos por finales. Cuando estén aprobados, poné BORRADOR = false
//  y desaparece el sello «borrador» de las hojas.
//
//  Cada hoja: { titulo, bajada, secciones: [{ t: "subtítulo", p: ["párrafo", …] }] }
//  En los párrafos se puede usar [texto](/ruta) para un link.
// =====================================================================

export const BORRADOR = true;

// Datos que se repiten (cambialos acá y se actualizan en todas las hojas)
const PLAZO_PRODUCCION = "entre 15 y 30 días hábiles";
const MAIL_CONTACTO = "por mensaje directo de Instagram (@tipificado_)";

export const HOJAS = {
  preguntas: {
    titulo: "Preguntas frecuentes",
    bajada: "Lo que más nos preguntan antes de comprar.",
    secciones: [
      {
        t: "¿Las piezas están hechas a mano?",
        p: ["Sí. Cada pieza se modela, se esmalta y se hornea a mano en nuestro taller. Por eso no hay dos iguales: pueden variar levemente el tono del esmalte, las medidas y las marcas del proceso. No son fallas, son parte de la pieza."],
      },
      {
        t: "¿Las tienen hechas o se hacen a pedido?",
        p: [`Se hacen a pedido, en el color que elijas. El tiempo de producción es ${PLAZO_PRODUCCION} desde que se acredita el pago (en la ficha de cada pieza figura su plazo). Si alguna tiene un plazo distinto, te lo avisamos antes.`],
      },
      {
        t: "¿Se pueden usar en el microondas y el lavavajillas?",
        p: ["Los esmaltes que usamos son aptos para uso alimentario. Recomendamos lavarlas a mano para que el esmalte dure más y evitar cambios bruscos de temperatura (por ejemplo, del freezer al horno). Las piezas con detalles metálicos no van al microondas."],
      },
      {
        t: "¿Cómo pago?",
        p: ["Con Mercado Pago: tarjeta de crédito o débito, dinero en cuenta y los demás medios que ofrezca Mercado Pago al momento de pagar. También podés mandarnos el pedido por mensaje directo y coordinamos."],
      },
      {
        t: "¿Hacen envíos a todo el país?",
        p: ["Sí, por correo con número de seguimiento. Mirá los plazos y costos en [Envíos](/envios)."],
      },
      {
        t: "¿Y si me arrepiento?",
        p: ["Tenés 10 días corridos desde que recibís la pieza para arrepentirte de la compra, sin dar explicaciones. Lo pedís desde el [Botón de arrepentimiento](/arrepentimiento). Más detalles en [Cambios y devoluciones](/cambios)."],
      },
      {
        t: "¿Hacen pedidos especiales o para empresas?",
        p: [`Sí, escribinos ${MAIL_CONTACTO} y lo charlamos.`],
      },
    ],
  },

  cambios: {
    titulo: "Cambios y devoluciones",
    bajada: "Tus derechos como consumidor (Ley 24.240 de Defensa del Consumidor).",
    secciones: [
      {
        t: "Derecho de arrepentimiento",
        p: [
          "Si compraste por internet, tenés 10 días corridos para arrepentirte de la compra, contados desde que recibiste la pieza (o desde la compra, lo que ocurra último). No necesitás dar ningún motivo y no tiene costo para vos (art. 34 de la Ley 24.240 y art. 1110 del Código Civil y Comercial).",
          "Lo pedís en un minuto desde el [Botón de arrepentimiento](/arrepentimiento): te damos un código de solicitud y te escribimos para coordinar la devolución. La pieza tiene que volver en el mismo estado en que la recibiste. Te devolvemos el total pagado, por el mismo medio de pago, apenas la recibimos.",
        ],
      },
      {
        t: "Si llega rota o con un defecto",
        p: [
          "Revisá el paquete al recibirlo. Si una pieza llega rota o con un defecto de fabricación, escribinos dentro de las 48 h con fotos del paquete y de la pieza. La reponemos sin costo o te devolvemos el dinero, como prefieras.",
          "Recordá que las piezas son artesanales: las pequeñas variaciones de color, medida o textura no se consideran defectos.",
        ],
      },
      {
        t: "Cambios",
        p: ["Como cada pieza se hace a pedido en el color que elegiste, los cambios de color o modelo (fuera del derecho de arrepentimiento) los vemos caso por caso. Escribinos y buscamos la mejor solución."],
      },
      {
        t: "Garantía",
        p: ["Las piezas tienen la garantía legal por defectos de fabricación que establece la Ley 24.240. No cubre roturas por golpes, caídas o uso indebido."],
      },
      {
        t: "¿Necesitás ayuda?",
        p: [`Escribinos ${MAIL_CONTACTO}. Si no quedás conforme, podés hacer un reclamo ante [Defensa del Consumidor](https://www.argentina.gob.ar/produccion/defensadelconsumidor).`],
      },
    ],
  },

  envios: {
    titulo: "Envíos",
    bajada: "Embalamos cada pieza para que llegue entera.",
    secciones: [
      {
        t: "¿Cómo se envía?",
        p: ["Por correo (Andreani u otro correo según el destino), a domicilio o a sucursal, con número de seguimiento. Cuando tu pedido sale, te mandamos el número por mail para que lo sigas."],
      },
      {
        t: "¿Cuánto tarda?",
        p: [
          `Primero se produce la pieza: ${PLAZO_PRODUCCION} desde que se acredita el pago. Después, el correo tarda aproximadamente:`,
          "· AMBA: 2 a 4 días hábiles.",
          "· Resto del país: 3 a 8 días hábiles.",
          "Son plazos estimados del correo y pueden variar en temporadas altas o por causas ajenas a nosotros.",
        ],
      },
      {
        t: "¿Cuánto cuesta?",
        p: ["El costo se calcula al pagar, según tu código postal, la modalidad (domicilio o sucursal) y el tamaño del paquete. Lo ves antes de confirmar la compra. Si no se puede calcular en el momento, pagás solo las piezas y el envío lo coordinamos por mensaje."],
      },
      {
        t: "Retiro",
        p: ["Si está disponible la opción de retiro, la vas a ver al pagar. Coordinamos el día y el horario por mensaje."],
      },
      {
        t: "¿Llegó rota?",
        p: ["Escribinos dentro de las 48 h de recibirla con fotos del paquete y de la pieza. Ver [Cambios y devoluciones](/cambios)."],
      },
    ],
  },

  terminos: {
    titulo: "Términos y privacidad",
    bajada: "Las reglas de la tienda y qué hacemos con tus datos.",
    secciones: [
      {
        t: "La tienda",
        p: ["Al comprar en este sitio aceptás estos términos. Los precios están en pesos argentinos e incluyen impuestos. Pueden cambiar sin aviso, pero se respeta siempre el precio que figuraba al momento de tu compra. Las fotos son ilustrativas: al ser piezas hechas a mano, puede haber pequeñas diferencias de color, medida y textura."],
      },
      {
        t: "Pagos",
        p: ["Los pagos se procesan con Mercado Pago. Nosotros no vemos ni guardamos los datos de tu tarjeta. La compra se confirma cuando Mercado Pago acredita el pago; ahí empezamos a producir tu pieza."],
      },
      {
        t: "Producción, envío y arrepentimiento",
        p: ["Los plazos de producción y envío están en [Envíos](/envios). Tus derechos de arrepentimiento, cambios y garantía, en [Cambios y devoluciones](/cambios) y en el [Botón de arrepentimiento](/arrepentimiento)."],
      },
      {
        t: "Tus datos personales",
        p: [
          "Para procesar tu pedido te pedimos nombre, WhatsApp o Instagram, mail y, si hay envío, la dirección. Los usamos solo para preparar, enviar y avisarte del estado de tu compra. No los vendemos ni los compartimos, salvo con el correo (para el envío) y con Mercado Pago (para el pago).",
          "Tenés derecho a pedir acceso, corrección o eliminación de tus datos en cualquier momento, escribiéndonos (Ley 25.326 de Protección de los Datos Personales). La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, atiende las denuncias y reclamos de quienes vean afectados sus derechos sobre sus datos personales.",
        ],
      },
      {
        t: "Cookies y almacenamiento",
        p: ["El sitio guarda tu carrito en tu navegador para que no lo pierdas. No usamos cookies de publicidad."],
      },
      {
        t: "Contacto",
        p: [`Escribinos ${MAIL_CONTACTO}. Defensa del Consumidor: [argentina.gob.ar/defensadelconsumidor](https://www.argentina.gob.ar/produccion/defensadelconsumidor).`],
      },
    ],
  },
};

// Los links del pie de la hoja (en este orden)
export const LINKS_FORMALES = [
  { href: "/preguntas", txt: "Preguntas frecuentes" },
  { href: "/cambios", txt: "Cambios y devoluciones" },
  { href: "/envios", txt: "Envíos" },
  { href: "/terminos", txt: "Términos y privacidad" },
];
