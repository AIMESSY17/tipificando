# tipificado…| — tienda de cerámica

Tienda online para **@tipificado_** en formato "Reels de estudio": cada pieza tiene su "estación" en un taller 3D continuo y se pasa deslizando de costado: la cámara hace un travelling por el pasillo siguiendo al dedo 1:1. Cada estación tiene su propio set de fotos:
- pared y mesa con colores intensos (oklch/P3) y sombras del mismo tono;
- luz de ventana y sombra de planta;
- un **pedestal 3D real** (travertino o cabezal de torno de alfarero) con sombras de verdad;
- una palabra gigante en Instrument Serif detrás;
- volumen 2.5D con brillo de esmalte.

También tiene carrito, cupones, opciones de envío, pago con Mercado Pago, pedido por DM y un panel de admin estilo iPhone (instalable como app) con pedidos, clientes, cupones y estadísticas.

**Tipografías:** Instrument Serif (títulos y palabra gigante), Geist (textos), Geist Mono (precios y etiquetas). Fraunces queda solo para el logo.

**Fotos HD:** las 10 piezas se agrandaron x4 con Real-ESRGAN (gratis, corrido localmente), se recortaron con la máscara del modelo grande, se limpiaron los bordes y se igualó el tono del crudo del esmalte en todas.

**Probar pedestales:** abrí `/?pedestal=torno` o `/?pedestal=travertino` para comparar. En el admin se elige el general (Ajustes) y, si querés, uno distinto para cada pieza.

---

# Puesta en marcha (producción)

La tienda está pensada para cobrar de verdad. Si falta alguna variable obligatoria, **no se rompe**: se compra con «Copiar pedido» / «DM de Instagram» y el panel muestra qué falta en **Ajustes → Estado de la tienda**.

## 1. En tu compu

```bash
npm install
npm run dev
```

Copiá `.env.example` como `.env.local` y completalo (las mismas variables que en Vercel). Sin variables, la tienda muestra el catálogo de `src/data/seed.js` y el panel explica cómo conectar Supabase.

## 2. GitHub y Vercel

1. `git init && git add . && git commit -m "tipificado v1"`, creá el repo en GitHub y hacé `git push`.
2. Vercel: Add New → Project → elegí el repo → Deploy.
3. Cada vez que cambies una variable en Vercel → **Redeploy** (las `NEXT_PUBLIC_*` se fijan al compilar).

## 3. Supabase (base de datos, panel y fotos)

1. Proyecto nuevo en supabase.com (región São Paulo).
2. **SQL Editor** → pegá todo **`supabase/schema.sql`** → Run. Crea tablas, seguridad (RLS), funciones de pedidos/pagos/cupones, el registro de avisos de Mercado Pago, el límite anti-abuso, el depósito de fotos y Realtime en `orders`.
   - Se puede correr de cero **o encima de una versión anterior**: no borra datos, solo agrega lo que falta. Correlo de nuevo cada vez que actualices el código.
3. **SQL Editor** → **`supabase/seed.sql`** → Run (catálogo inicial, ajustes y opciones de entrega; no duplica).
4. Cargá el mail del dueño (después se suman más desde Ajustes → Administradores):
   ```sql
   insert into admins (email) values ('mail-del-cliente@gmail.com');
   ```
5. **Authentication → URL Configuration:** Site URL = la URL final; en Redirect URLs agregá `https://TU-URL/admin` (y `http://localhost:3000/admin` para trabajar en tu compu).
6. **Authentication → SMTP Settings → Enable Custom SMTP** (importante): el mail de Supabase por defecto tiene un límite de pocos mails por hora y suele caer en spam. Con SMTP propio los links de acceso al panel llegan siempre.
   - La forma más simple es **Resend** (el mismo que se usa para el aviso al dueño): verificá tu dominio en resend.com → Domains, y en Supabase poné Host `smtp.resend.com`, Port `465`, Username `resend`, Password = una API key de Resend, Sender email `acceso@tu-dominio` y Sender name `tipificado`.
   - Sirve cualquier otro SMTP (Brevo, Gmail con contraseña de aplicación, el del hosting del dominio).
   - Después, en **Authentication → Rate Limits**, podés subir el límite de mails por hora.
   - Opcional: en **Authentication → Email Templates** traducí el asunto y el texto del «Magic Link».
7. **Project Settings → API:** copiá a Vercel → Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (**secreta, solo en Vercel**)
   - `NEXT_PUBLIC_SITE_URL` (la URL final, con `https://` y sin barra al final)
8. Redeploy. Entrá a `/admin`, poné el mail y llega el link.

## 4. Mercado Pago (cobrando de verdad)

1. Con la cuenta **del cliente**: mercadopago.com.ar/developers → Tus integraciones → Crear aplicación (Checkout Pro).
2. **Credenciales de producción** → copiá el Access Token (empieza con `APP_USR-`) en Vercel como `MP_ACCESS_TOKEN`.
3. **Webhooks → Configurar notificaciones** (modo productivo):
   - URL: `https://TU-URL/api/mp-webhook`
   - Evento: **Pagos**
   - Guardá y copiá la **clave secreta** en Vercel como `MP_WEBHOOK_SECRET`. Es **obligatoria**: sin ella se rechaza todo aviso y los pedidos no pasan solos a «Pagado».
   - Con «Simular notificación» podés probar que llega: en el panel aparece como «Último aviso de Mercado Pago» (un pago simulado no existe, así que figura como «ignorado»; lo importante es que la firma sea válida).
4. Redeploy y entrá a **Ajustes → Estado de la tienda**: tienen que estar todos los tildes en verde y el nombre de la cuenta de Mercado Pago tiene que ser **la del cliente**.
5. Hacé una compra real chica (y devolvela desde Mercado Pago si querés).

**Cómo funciona el cobro:**
- El servidor arma el total con los precios de la base, la oferta, el cupón y el envío. Nunca usa lo que manda el navegador.
- Si hay cupón, el descuento se reparte entre las piezas de forma proporcional (redondeado a pesos), así el cliente ve en Mercado Pago el detalle de lo que compró. El envío va como costo de envío de Mercado Pago.
- **Cupones:** el uso se cuenta recién cuando el pago se aprueba. Mientras tanto, los pedidos pendientes dentro del tiempo de reserva (MINUTOS_RESERVA en src/lib/precios.js, hoy 30 minutos) con ese cupón cuentan como «reservados» para respetar el límite. Si un pago se rechaza o se devuelve, el uso se libera.
- **Webhook:** valida la firma, consulta el pago a Mercado Pago y lo aplica al pedido de forma idempotente (si el mismo aviso llega dos veces, no duplica nada). Cada aviso queda en la tabla `mp_webhooks` (Supabase → Table Editor) para revisar problemas.
- **Anti-abuso:** máximo 10 intentos de pago por IP cada 10 minutos (tabla `checkout_intentos`).
- **Al volver de Mercado Pago**, `/gracias` muestra el número de pedido y el estado real de la base (si el aviso todavía no llegó, consulta el pago a Mercado Pago en el momento).

**Para probar con credenciales de prueba** (opcional): usá el token de prueba y agregá `MP_MODO=prueba`. La tienda muestra la franja «Modo prueba» y el webhook acepta avisos aunque no haya clave. En producción, **sacá `MP_MODO`**.

## Aviso por mail al dueño (opcional)

Cada vez que un pedido pasa a «Pagado» llega un mail con el detalle.
1. Creá una cuenta en resend.com, verificá el dominio (Domains) y creá una API key.
2. En Vercel: `RESEND_API_KEY`, `MAIL_DUENO` (uno o varios mails separados por coma) y `MAIL_DESDE` (por ejemplo `tipificado <avisos@tu-dominio>`). Sin `MAIL_DESDE` sale de `onboarding@resend.dev`, que solo puede mandar al mail de la cuenta de Resend.
3. Redeploy → Ajustes → «Mandar un mail de prueba».

Si no está configurado, no pasa nada: el panel igual muestra el aviso en tiempo real («💳 Pago confirmado»).

## Links para Instagram

- `https://TU-URL/?pieza=taza-panzona` abre la tienda directo en esa pieza, con su título, descripción y foto cuando se comparte.
- En el panel, **Piezas** → el botón 🔗 de cada pieza (o «Copiar link para historias» dentro de la pieza) copia el link.
- `sitemap.xml` y `robots.txt` se generan solos; el panel `/admin` no se indexa.

## 5. La app del panel en el celular

Desde el celular, abrí `https://TU-URL/admin`:
- **iPhone (Safari):** botón compartir → «Agregar a pantalla de inicio».
- **Android (Chrome):** menú ⋮ → «Instalar app» o «Agregar a pantalla de inicio».

Queda como una app con el nombre **tipificado admin**.

---

# Guía para el dueño

El panel se usa desde el celular, como cualquier app. Abajo tenés las pestañas: **Inicio, Piezas, Pedidos, Clientes y Más** (cupones, envíos y ajustes).

### Cómo cargar una pieza
1. **Piezas → + Nueva.**
2. **Subir foto de la pieza:** sirve cualquier foto, aunque tenga fondo. El fondo se quita solo y el panel elige el color de la pared y de la mesa. Arriba ves cómo va a quedar en la tienda.
   - Para que salga perfecta: la pieza entera, con buena luz, sobre un fondo liso y sin textos encima.
   - ¿No te gustan los colores? Tocá «Probar otra combinación» o elegilos a mano más abajo.
3. Completá **nombre, categoría y precio**. Si está en oferta, poné el **precio de oferta**: en la tienda se ve el precio viejo tachado.
4. **Etiqueta** (opcional): «Nuevo» o «Últimas».
5. **Colores:** agregá cada color que hacés. El primero es el de la foto.
   - Si un color se terminó, apagá «Hay»: en la tienda se ve tachado y no se puede elegir.
   - **+ Foto** (opcional): una foto de la pieza en ese color. Cuando el cliente elige ese color en la ficha, ve esa foto.
6. **Tiempo de producción** (opcional): si esta pieza tarda distinto al resto.
7. **Guardar.** La tienda se actualiza al instante.

Otras cosas que podés hacer:
- **Esconder una pieza** sin borrarla: el interruptor verde de la lista.
- **Cambiar el orden** de la tienda: mantené apretado **≡** y arrastrá.
- **Duplicar una pieza**, para cargar una parecida más rápido: entrá a la pieza → «Duplicar pieza». La copia queda oculta hasta que la actives.

### Cómo manejar un pedido
1. Cuando entra un pedido, aparece un cartelito 🛎️ y un numerito rojo en **Pedidos**. Los nuevos tienen un punto azul.
2. Tocá el pedido para ver todo: piezas, colores, total, cupón, envío, la nota del cliente y si Mercado Pago lo cobró.
3. A medida que avanzás, tocá **«Pasar a…»**: Pendiente → Pagado → En producción → Enviado → Entregado. Si se cae, «Cambiar a otro estado» → Cancelado. Abajo queda la historia, con fecha.
4. **Escribirle por WhatsApp** o **por Instagram:** el mensaje ya va armado según el estado (por ejemplo, «¡Hola Ana! Tu pedido #0012 ya está en producción…»). Con Instagram, el mensaje se copia y solo tenés que pegarlo.
5. **Notas internas:** lo que quieras recordar (el cliente no las ve). Se guardan solas.
6. **Comprobante:** arriba a la derecha. Abre una hoja con la marca para imprimir o guardar como PDF.
7. **Exportar a Excel:** en Pedidos, arriba. Baja los pedidos que estás viendo (con los filtros que tengas puestos).

### Cómo crear un cupón
1. **Más → Cupones → + Nuevo.**
2. Escribí el **código** (por ejemplo BIENVENIDA), elegí **porcentaje** o **monto fijo** y cuánto descuenta.
3. Opcional: **fecha de vencimiento** y **límite de usos** (por ejemplo, los primeros 50).
4. Guardar. El cliente lo escribe al pagar, en «¿Tenés un cupón?», y el descuento se calcula solo.
5. Para pausarlo, apagá el interruptor. Ahí también ves cuántas veces se usó.

### Envíos, vacaciones y ajustes
- **Más → Envíos:** retiro en el taller (con dirección y horario), envío a coordinar, un costo fijo por zona (por ejemplo, CABA $ 4.500) o **Envío por Andreani** (el costo se calcula solo con el código postal; ver más abajo). El cliente elige al pagar y el costo se suma solo.
- **Más → Ajustes → Modo vacaciones:** pausa las compras y muestra un cartel con la fecha de vuelta. La tienda se sigue viendo.
- **Más → Ajustes:** textos de la tienda, WhatsApp, tiempo de producción general, datos del negocio (van al pie y al comprobante), **Estado de la tienda** (tildes verdes/rojos: base de datos, Mercado Pago, webhook, URL y mails) y **administradores** (para invitar a alguien más al panel).

### Envío por Andreani (cálculo automático)
La tienda **cotiza** el envío con Zipnova según el código postal del cliente, pero **no despacha nada**: el envío real lo cargás vos a mano con tu cuenta de Andreani.

**Qué tenés que cargar una vez**
1. **Más → Piezas →** entrá a cada pieza → «Envío: peso y caja»: peso con la pieza ya embalada (gramos) y medidas de la caja (alto, ancho, largo en cm). Las 10 piezas vienen con valores **estimados** (se marcan «Envío estimado»): pesalas embaladas y corregilos. Si a una pieza le falta, el panel te avisa y esa pieza no se puede cotizar.
2. **Más → Envíos →** abajo, «Cotización automática»: transporte de referencia, factor, margen, redondeo y envío gratis (opcional). Ahí también está la **tabla de respaldo** (por provincia, a domicilio y a sucursal) que se usa **solo** si Zipnova no responde.

**Cuando entra un pedido con Andreani**
1. Abrí el pedido: en **«Para despachar con Andreani»** están nombre, mail, teléfono, dirección o sucursal, peso y medidas. Tocá **«Copiar datos para Andreani»** y pegalos en tu cuenta de Andreani.
2. Cuando Andreani te dé el **número de seguimiento**, pegalo en el pedido y tocá **«Guardar y avisar»**: el pedido pasa a «Enviado» y al comprador le llega un mail con el número y el link de seguimiento.
3. Más abajo ves **cuánto se le cobró de envío** al comprador, para compararlo con lo que te cobra Andreani.

**Si Zipnova falla o tarda más de 6 segundos:** se usa la tabla de respaldo; si esa provincia está vacía, el cliente ve «Envío a coordinar» y puede pagar igual (pagando solo las piezas).

### Cómo calibrar el factor de envío
El precio que ve el comprador es: **referencia de Zipnova × factor × (1 + margen %)**, redondeado. Como Zipnova todavía no cotiza con tu cuenta de Andreani, el factor sirve para que el precio quede parecido a lo que **realmente** te cobra Andreani.
1. Entrá a **Más → Envíos → Simulador**. Elegí una provincia, localidad y código postal (por ejemplo, Rosario 2000) y una pieza.
2. Tocá **Cotizar**. Vas a ver lo que devuelve Zipnova por transporte y el **precio de referencia**.
3. En otra pestaña, cotizá **el mismo paquete** (mismo peso, medidas y destino) en el cotizador de tu cuenta de Andreani. Anotá el precio, por ejemplo $ 11.000.
4. Calculá el factor: **precio de Andreani ÷ precio de referencia**. Ejemplo: Andreani $ 11.000 y referencia $ 13.300 → 11.000 ÷ 13.300 = **0,83**.
5. Cargá ese factor (con coma o punto), poné el **margen de seguridad en 0**, y tocá **Cotizar** otra vez: el «precio final al comprador» tiene que quedar casi igual al de Andreani. (El simulador usa lo que escribas aunque no hayas guardado.)
6. Repetí con 3 o 4 destinos distintos (cerca, lejos, una sucursal y un domicilio). Si el factor da muy distinto según el destino, quedate con el **más alto** para no perder plata.
7. Ahora sí poné el **margen de seguridad** (por ejemplo, 10 %) y tocá **«Guardar ajustes de envío»**.
8. Revisalo de vez en cuando: en cada pedido se ve **lo cobrado** al comprador. Si Andreani te cobra más seguido de lo que cobraste, subí el factor o el margen. Cuando Andreani esté habilitado en tu cuenta de Zipnova, la tienda lo toma sola como transporte de referencia y el factor debería quedar cerca de 1.

> El factor, el margen y la tabla de respaldo **no se ven en la tienda**: solo en el panel.

---

## Dónde está cada cosa

| Archivo | Qué hace |
|---|---|
| `src/components/Taller.jsx` | **El taller: un solo WebGL (three.js) para todo el escenario.** Cada pieza tiene su estación en un pasillo apenas curvo (pedestal travertino o torno, su tramo de pared con sus colores y su palabra pintada). Cambiar de pieza ES mover la cámara: travelling lateral con un giro sutil (~5° por estación, `DELTA`). Entre estaciones, la pared y la mesa se cubren de **esmalte líquido** que nace en la pieza siguiente: mancha de borde suave con chorreadas redondeadas, mezclada en OKLab, con dither (sin bandas); su radio sale directo de la posición de la cámara, así avanza 1:1 con el dedo y al soltar a mitad se retrae con el mismo resorte. **Push-in** al tocar la pieza: 450 ms ease-out (`ZOOM_MS`), encuadrada entera en la zona que deja libre la ficha (arriba en el celu, a la izquierda en la compu). Pieza 2.5D (parallax + brillo de esmalte), sombras reales, luz de ventana y planta, haces de luz y polvo, profundidad de campo barata (mipmaps). **Calidad adaptativa** en 5 escalones (`NIVELES`): si el gesto no llega a 60 fps baja primero los efectos (polvo, rayos, desenfoque), después la sombra y recién al final la resolución, que además se aplica cuando el dedo suelta; la respuesta al dedo no se toca nunca. 30 fps en reposo y 60 con gesto, pausa con la ficha/carrito abiertos o la pestaña oculta. Escribe `--apoyo`, `--horizonte` y la caja de la pieza (`--pz-*`) |
| `src/lib/recorrido.js` | La posición de la cámara en estaciones: arrastre 1:1, inercia + resorte al soltar, flechas/ruedita/botones con el mismo resorte, todo interrumpible. Sin bucle propio (lo avanza el cuadro de dibujo) |
| `src/lib/palabra.js` | Mide la palabra gigante con el mismo HTML/CSS de siempre y la pinta letra por letra en una textura para la pared |
| `src/lib/color.js` | OKLab/OKLCH en JS (los mismos `vivo()` y `color-mix` del CSS) para pasarle los colores ya calculados al shader |
| `src/components/Escena.jsx` | Elige el taller 3D o, si no hay WebGL, un respaldo DOM simple (pared, mesa, palabra, pedestal CSS y foto) que se maneja con el mismo recorrido |
| `src/components/Store.jsx` | Tienda: el gesto en vivo (dedo, mouse, ruedita y flechas con el mismo resorte; sin bloqueos, encadena), ficha, carrito, pagar, ver todo, pieza que vuela a la tacita |
| `src/components/Effects.jsx` | Loader («tipificado...» escribiéndose) |
| `src/lib/profundidad.js` + `profundidad.worker.js` | Decodifica cada foto y calcula su mapa de profundidad en un Web Worker (una vez por imagen) |
| `src/lib/fotos.js` | Fotos en dos tamaños: elige la de 800 en celular y la deriva de `image_url` |
| `src/lib/medir.js` | Tamaño y centrado por la base de cada pieza |
| `src/lib/inclinacion.js` | Inclinación por mouse o giroscopio |
| `scripts/tamanos.mjs` | `npm run tamanos`: genera `public/productos/800/` desde las fotos de 1600 (correrlo al agregar fotos al repo) |
| `src/app/globals.css` | Todo el diseño |
| `src/app/admin/Admin.jsx` | Panel: entrada con link al mail, pestañas, aviso en tiempo real de pedidos nuevos y pagos confirmados |
| `src/app/admin/Inicio.jsx` · `Piezas.jsx` · `Pedidos.jsx` · `Clientes.jsx` · `Cupones.jsx` · `Envios.jsx` · `Ajustes.jsx` | Una pestaña cada uno. `Piezas.jsx` tiene el editor (recorte, dirección de arte, vista previa 3D; al subir una foto guarda también la versión `-800`) |
| `src/app/admin/ui.jsx` | Piezas compartidas del panel: hojas, esqueletos de carga, vacíos, confirmaciones, errores en castellano |
| `src/app/admin/comprobante/` | Comprobante imprimible del pedido |
| `public/admin.webmanifest` · `admin-sw.js` · `admin-icon-*.png` | App instalable del panel («tipificado admin») |
| `src/lib/precios.js` | Precio de oferta, cupones, envíos y totales (el servidor cobra con esto) |
| `src/lib/server.js` | Catálogo (cacheado), cotización del carrito en el servidor, variables obligatorias, chequeo de admin |
| `src/lib/pagos.js` | Firma de los avisos de MP, procesamiento idempotente de pagos y mail al dueño |
| `src/app/api/cotizar` | Calcula el total en «Pagar» (cupón y envío) |
| `src/lib/envio.js` · `src/lib/zipnova.js` | Envío por Andreani: precio de referencia, factor y margen (`envio.js`, compartido) y cotización con Zipnova con cache de 30 min y tiempo máximo de 6 s (`zipnova.js`, solo servidor; las claves salen de `process.env`) |
| `src/app/admin/EnviosAuto.jsx` | Ajustes de la cotización, simulador y tabla de respaldo |
| `src/app/api/admin/seguimiento` · `envio-simulador` | Guarda el seguimiento de Andreani (y manda el mail al comprador) · simulador del panel |
| `src/app/api/admin/` | Invitar o quitar administradores, estado de la tienda y mail de prueba (solo admins) |
| `src/app/api/checkout` | Límite anti-abuso, pedido con reserva de cupón y link de Mercado Pago; todo calculado en el servidor |
| `src/app/api/mp-webhook` | Recibe los avisos de pago (firma obligatoria, idempotente, registro en `mp_webhooks`) |
| `src/app/gracias` | Vuelta de Mercado Pago: número de pedido y estado real |
| `src/app/sitemap.js` · `robots.js` | Sitemap con un link por pieza y robots.txt |
| `src/data/seed.js` | Catálogo, ajustes y envíos iniciales (se usan si no hay Supabase) |
| `supabase/schema.sql` · `seed.sql` | Base de datos (se puede correr sobre una existente) y datos iniciales |

## Pendientes (TODO)

- [ ] **Peso y medidas de las 10 piezas:** son estimados. Pesarlas embaladas y corregirlos en Piezas.
- [ ] **Calibrar el factor de envío** (ver «Cómo calibrar el factor de envío») y completar la tabla de respaldo por provincia.
- [ ] Para que el mail de seguimiento llegue a cualquier comprador, el remitente (`MAIL_DESDE`) tiene que usar un dominio verificado en Resend.
- [ ] **Precios provisorios:** pino, taza clásica, pochoclera, plato hondo y tazón. Corregirlos en el admin.
- [ ] Confirmar qué colores ofrece en cada pieza (los cargados son estimados a partir de las fotos).
- [ ] Revisar los textos de producción y envío con el cliente.
- [ ] Probar una compra real chica con Mercado Pago de producción (y devolverla para ver que el cupón se libera).
- [ ] Revisar la parte legal con alguien que sepa (botón de arrepentimiento, datos fiscales/QR de ARCA, términos y condiciones).
- [ ] Dominio propio (tipificado.com.ar en NIC.ar) → conectarlo en Vercel → actualizar `NEXT_PUBLIC_SITE_URL`, las URL de Supabase, el webhook de MP y el remitente de los mails.
- [ ] Probar en un celular promedio de verdad. Si igual va lento, la calidad baja sola; los escalones están al principio de `Taller.jsx` (`NIVELES`: resolución, sombra, efectos).
- [ ] En iPhone, el giroscopio pide permiso la primera vez que tocás la pantalla. Si no lo da, la pieza igual se mueve sola de un lado a otro.
