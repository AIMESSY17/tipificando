# tipificado…| — tienda de cerámica

Tienda online para **@tipificado_** en formato "Reels de estudio": la pieza activa está adelante y al centro, **sobre su pedestal** (travertino o cabezal de torno), grande, nítida y con un foco cálido; las demás forman un **anillo grande alrededor** (en el celu se sale de la pantalla por los costados; en la compu ocupa ~80% del ancho), con su color real y bien separadas, como un telón que gira. Se pasa de pieza deslizando de costado: el anillo gira 1:1 con el dedo y la pieza que llega sale del anillo y avanza en arco hasta el pedestal mientras la anterior vuelve a su lugar (todo ligado al ángulo; al soltar, inercia y resorte a la pieza más cercana, y un flick gira varias). Cada pieza trae su propio set:
- pared y piso con colores intensos (oklch/P3) y sombras del mismo tono; al girar, un **esmalte líquido** con el color de la pieza que llega se derrama por la pared desde atrás de ella;
- luz de ventana y sombra de planta;
- el pedestal **3D real** con sombras de verdad;
- una palabra gigante en máquina de escribir (Courier Prime bold) pintada en la pared, que se desliza y se funde con el giro;
- volumen 2.5D con brillo de esmalte.

**Catálogo completo (la hoja):** abajo asoma el borde de una hoja de papel saliendo del rodillo de una máquina de escribir: «CATÁLOGO COMPLETO ↑» tipeado grande en Courier Prime bold (tinta irregular, con el cursor; se tipea una sola vez por visita) y, debajo, todas las piezas recortadas apoyadas sobre un renglón, del mismo alto y con sombrita de contacto (si no entran, la fila se desliza de costado con inercia). Margen rojo y perforación del papel; la hoja respira. Tocar una pieza de la fila gira la mesa hasta ella; tocar el título o arrastrar hacia arriba sube la hoja, que cubre la pantalla con la grilla (filtros y tarjetas). Se baja con el gesto, ✕ o Escape. En la compu es una hoja centrada de 520 px. Pie a máquina: «@tipificado_» a la izquierda y «Botón de arrepentimiento» a la derecha (cerrada y abierta); abierta, además, los links a las hojas formales.

**Carrito-taza:** el carrito es una taza de café. Al agregar, una miniatura de la pieza vuela en arco hasta la taza y cae adentro; el café sube un escalón por pieza (llena con 5 o más) con una ondita, y baja al vaciar. Con «reducir movimiento» no hay vuelo: solo cambia el nivel.

**Link propio de cada pieza:** `/pieza/<slug>` (por ejemplo `/pieza/palta`) abre la tienda con la mesa ya en esa pieza, sin giro. Al girar la mesa la URL y el título de la pestaña acompañan (sin llenar el historial). Cada pieza tiene título «Nombre — tipificado…|», descripción e imagen para compartir generada al vuelo (`src/app/pieza/[slug]/opengraph-image.jsx`: la pieza recortada sobre el color de su pared y su mesa, el nombre en Courier Prime, el precio y el logo). En la ficha, «Compartir» usa el menú de compartir del celu o, si no hay, copia el link («link copiado…|»). Un slug que no existe vuelve a la home; los links viejos `/?pieza=<slug>` redirigen al nuevo.

**Hojas formales (BORRADOR):** `/preguntas`, `/cambios`, `/envios` y `/terminos` usan la misma hoja de papel, ya abierta, con el título tipeado. Son **textos base para Argentina a revisar con el cliente**: Ley 24.240 (arrepentimiento de 10 días con link al botón, garantía), envíos por correo con seguimiento y plazos estimados, pago con Mercado Pago, datos personales (Ley 25.326). Se editan en `src/data/textos.js` (plazos y contacto arriba de todo); mientras `BORRADOR = true` las hojas muestran el sello «borrador · texto a revisar».

**Ruedita, trackpad y teclado:** un paso cada 350 ms como mucho (lo que llega en el medio se descarta) y siempre frena en una pieza exacta; un flick con el dedo gira hasta 3.

También tiene carrito, cupones, opciones de envío, pago con Mercado Pago, pedido por DM y un panel de admin estilo iPhone (instalable como app) con pedidos, clientes, cupones y estadísticas.

**Logo:** vectorizado del logo oficial (`public/marca/`): `logo-texto.svg` (la palabra, se pinta con el color del texto en la tienda, el telón y el panel, con el cursor «|» titilando aparte), `logo-claro.svg` / `logo-oscuro.svg` y sus PNG en alta (2400 px, fondo transparente) para usar en otros lados. Los mails usan `logo-oscuro.png` (necesita `NEXT_PUBLIC_SITE_URL`).

**Tipografías (máquina de escribir, autoalojadas con fontsource):** se compararon Courier Prime, Cutive, Cutive Mono, IBM Plex Mono y Special Elite contra el logo.
- **Courier Prime bold**: palabra gigante, nombres de las piezas (con el cursor «|») y títulos. Es la más cercana al peso y las terminaciones redondeadas del logo.
- **IBM Plex Mono**: precios, categorías, botones y textos (la más legible en pantalla chica; textos de lectura ≥ 15 px en el celu).
- **Caveat**: un único acento manuscrito (como el «Palta» del flyer), solo en la categoría de la ficha.
- El panel usa la sans del sistema en los formularios; el logo y los títulos van con la marca.

**Fotos en la escena:** 1600 px para la protagonista y las dos vecinas de cada lado, 800 px para las lejanas (en el celu la del frente entra primero en 800 y se cambia sola a 1600). Alfa premultiplicado, mipmaps y anisotropía máxima: sin halos oscuros en el recorte. Cada pieza proyecta la sombra de su silueta. Tone mapping neutro: cada pieza se ve del color de su foto.

**Bordes de las fotos:** cada foto tiene un margen transparente (4% a los costados y arriba, 1,2% abajo). Sin margen, el parallax de la escena estira el píxel del borde y la pieza se ve mochada. `python scripts/bordes.py` revisa todas; `python scripts/bordes.py --arreglar` recorta al contorno, deja el margen y rellena los huecos semitransparentes que deja el recorte en las rayas (no en las piezas con asa); después `npm run tamanos`. El panel y `scripts/recortar.py` ya dejan el margen en las fotos nuevas. La budinera venía cortada por el borde de la foto original: el extremo izquierdo se reconstruyó espejando el derecho.

**Fotos HD:** las 10 piezas originales se agrandaron x4 con Real-ESRGAN (gratis, corrido localmente), se recortaron con la máscara del modelo grande, se limpiaron los bordes y se igualó el tono del crudo del esmalte en todas.

**Probar pedestales:** abrí `/?pedestal=torno` o `/?pedestal=travertino` para comparar. La tienda usa el pedestal general (Ajustes); el de cada pieza se ve en la vista previa del admin.

**Probar con muchas piezas:** `/?demo=30` repite el catálogo hasta 30 piezas (solo con `npm run dev`, o en producción con la variable `DEMO_PIEZAS=1`; las copias no se pueden comprar).

## Productos y precios

El catálogo **vive en Supabase** y lo carga el cliente desde el panel: el código no pisa nada de la base. `src/data/seed.js` y `supabase/seed.sql` son solo el respaldo / catálogo inicial, ya con los precios de la lista oficial:

| Pieza (slug) | Precio |
|---|---|
| Palta (`palta`) · **nueva** | $ 45.000 |
| Portamacetas rayado y moteado (`portamacetas-rayado`, `portamacetas-moteado`) · categoría «medio tubo · hielera / maceta» | $ 45.000 |
| Taza panzona (`taza-panzona`) | $ 35.000 |
| Tazón (`tazon`) | $ 40.000 |
| Plato hondo / cazuela (`plato-hondo`) | $ 50.000 |
| Platillo (`platillo`) | $ 25.000 |

**Precio a confirmar** (no están en la lista; quedan con el precio que tenían): Pino de navidad ($ 28.000), Budinera ($ 32.000), Pochoclera ($ 22.000), Taza clásica ($ 15.500).

**Compotera ($ 25.000):** está en la lista pero todavía no hay una pieza ni foto que le corresponda. Cargala desde el panel → Piezas → + Nueva, con su foto.

**Palta:** plato con forma de palta (foto recortada del flyer: `public/productos/palta.webp` y su versión de 800). Categoría «plato palta», palabra gigante «PALTA», etiqueta «Nuevo». **Revisar los colores:** por ahora tiene solo «Crema» (el de la foto).

**Si la Palta no aparece en la tienda real:** corré `supabase/ronda-precios-palta.sql` (ver abajo): la crea si falta (primera en la tienda, $ 45.000) y si ya existe solo le pone el precio. La foto no hay que subirla: está en el repo y la sirve el sitio en `/productos/palta.webp`. Si querés otra foto, cambiala desde el panel (Piezas → Palta → Subir foto).

### Actualizar los precios en la base y agregar la Palta

`supabase/ronda-precios-palta.sql` (una sola transacción, se puede correr más de una vez) crea la Palta si falta y cambia **solo el precio** de las piezas de la lista (y la categoría de los dos medio tubo), buscándolas por slug (tazas panzonas y tazones también por categoría, para agarrar variantes). No toca nombres, fotos, colores, descripciones, ofertas ni las piezas sin precio en la lista (pino, budinera, pochoclera, taza clásica). Al final muestra nombre, slug y precio de todo.

1. Supabase → **SQL Editor** → New query.
2. Pegá todo el contenido de `supabase/ronda-precios-palta.sql` → **Run**.
3. Revisá la tabla que devuelve y, si querés que la tienda se actualice al instante, guardá cualquier pieza desde el panel (si no, se renueva sola en ~60 s).

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
   - Después, **`supabase/stock.sql`** → Run (control de stock; ver «Control de stock: poner en marcha» más abajo). Las dos se pueden volver a correr cuando quieras.
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

### Stock (cuántas piezas hay)
El stock es **opcional y por pieza**: mientras no lo prendas, la pieza se vende sin límite, como siempre.
1. **Piezas →** entrá a la pieza → sección **Stock** → prendé **«Controlar stock»**.
2. En **«Unidades disponibles»** escribí cuántas tenés (en el celu se abre el teclado de números) o usá **− / +**. Tocá **Guardar**.
3. Listo: **se descuenta solo con cada venta**. No tenés que hacer nada más.

**Qué ve el comprador** (nunca el número):
- 10 o más (o sin control): nada.
- Menos de 10: la etiqueta **«últimas unidades…|»** en la ficha y en el catálogo.
- 0: **«sin stock…|»**, el botón dice «Sin stock» y no se puede comprar. La pieza sigue en la mesa.
- El «10» se cambia en **Más → Ajustes → Stock** («Mostrar "últimas unidades" cuando queden menos de»).

**Cómo se mueve solo:**
- Cuando alguien va a pagar, sus piezas quedan **reservadas** (se descuentan) mientras tiene el link de Mercado Pago (30 minutos). Así dos personas no pueden comprar la última a la vez.
- Si paga → queda como **venta**. Si el pago se rechaza, lo cancela o no paga a tiempo → **vuelve solo al stock**.
- Si cancelás desde el panel un pedido **ya pagado**, te pregunta **«¿Devolver al stock?»** (por si la pieza ya salió o se rompió, podés decir que no). También está el botón «Devolver las piezas al stock» en el pedido.
- Si alguien pagó tarde (después de que venció su reserva) y mientras tanto otro se llevó la última, el pedido igual queda pagado (la plata entró) con la alerta **«revisar stock»** para que decidas.

**En el panel:**
- **Piezas:** al lado de cada una, las unidades y una insignia: verde (hay), naranja «Últimas unidades», rojo «Sin stock», gris «Sin control». Filtros **Todas · Últimas unidades · Sin stock**.
- **Inicio:** tarjeta **Stock** con cuántas están en últimas unidades y sin stock; tocala y te lleva a la lista filtrada.
- **Historial** dentro de cada pieza: «Venta pedido #0123 −1», «Carga manual +50», «Reserva liberada pedido #0119 +1»…
- **Mail:** te llega uno cuando una pieza entra en «últimas unidades» y otro cuando se queda sin stock (uno por vez, no uno por venta). Usa los mismos mails que el aviso de pedidos (`RESEND_API_KEY` y `MAIL_DUENO`).

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
| `src/components/Taller.jsx` | **El taller: un solo WebGL (three.js) para todo el escenario.** La protagonista en un pedestal propio (travertino o torno, según el pedestal general) adelante y al centro, con foco cálido de caída suave (`SpotLight` + charco de luz en el piso), sombra marcada sobre el pedestal y luz de recorte; las demás en un anillo detrás, apoyadas en la mesa del set con su sombra de contacto, a ~40% del tamaño (`RATIO_ANILLO`), más oscuras, 40% desaturadas y desenfocadas. La cámara queda quieta, ~20° hacia abajo (`PITCH`). **Salida/entrada ligada al ángulo:** cada pieza tiene un `e` (0 en el anillo, 1 protagonista) que sale de su distancia al frente; va por el piso en arco abriéndose hacia su lado y sube al pedestal en el último tramo (`LAT`, `ARCO`), así a mitad de giro una está volviendo y la otra saliendo, sin flotar ni cruzarse. **Encuadre automático** (`medir`): en el celu la protagonista ocupa ~45-50% del alto útil entre el logo y los textos; en la compu los textos van a la izquierda y la protagonista tiene el centro; la palabra va arriba, entera (la protagonista la roza como mucho abajo) y el anillo no la tapa. Se probó un aro en el piso marcando el anillo (`ARO`): sin aro la protagonista destaca más. Con muchas piezas el radio crece hasta un tope (`RP_MAX`) y el anillo se **virtualiza**: hasta 11 piezas todas tienen su foto en la GPU; con más, solo ±5 alrededor del frente (`NVENT`, `VENT`) y el resto son siluetas tenues (miniatura de 96 px). **Fotos durante el giro:** la 800 de cada pieza queda siempre cargada de respaldo (si una pieza no tiene foto lista, su 800 se sube ya, aunque la mesa gire), la 1600 se cambia recién cuando está en la GPU y nada se libera mientras la mesa gira (al quedar quieta se sueltan las 1600 lejanas). **Sombras:** cada pieza proyecta la de una copia invisible de su silueta que mira al sol (la pieza visible mira a la cámara; de costado dejaba una lonja diagonal en el piso) y solo si está en pantalla. **Celu:** anillo más chico (`RP0_CELU`) y piezas del anillo 15% más grandes (`ESC_CELU`). **Palabra en la compu:** ~80% del ancho (tope 39% del alto), arriba, y puede quedar detrás de la protagonista. Esmalte (nace detrás de la pieza que llega), color del piso, palabra (la actual se va en el sentido del giro y la nueva entra del otro lado) y, al pasar la mitad, tintas y textos: todo sale del ángulo, nada se anima después de soltar. **Push-in** al tocar la protagonista: 450 ms ease-out (`ZOOM_MS`), encuadrada entera en la zona que deja libre la ficha. Tocar una pieza del anillo la trae al pedestal por el camino más corto (`recorrido.tocar`). Luz de ventana y planta, haces de luz y polvo, profundidad de campo barata (mipmaps). **Calidad adaptativa** en 5 escalones (`NIVELES`): si el giro no llega a 60 fps baja primero polvo, haces y desenfoque, después la sombra y recién al final la resolución, que se aplica cuando el dedo suelta; la respuesta al dedo no se toca nunca. 30 fps en reposo y 60 con gesto, pausa con la ficha/carrito abiertos o la pestaña oculta. Escribe `--apoyo`, `--horizonte` y la caja de la protagonista (`--pz-*`) |
| `src/lib/recorrido.js` | El ángulo del anillo (en piezas): arrastre 1:1, inercia + resorte al soltar (un flick gira hasta 3), `pasoLimitado` para ruedita/trackpad/teclado/flechas (uno cada 350 ms, nunca más de una pieza adelante; lo demás se descarta), tocar con el mismo resorte, todo interrumpible. Sin bucle propio (lo avanza el cuadro de dibujo) |
| `scripts/bordes.py` | Revisa y arregla los bordes de las fotos (margen transparente, huecos) |
| `supabase/ronda-precios-palta.sql` | Precios de la lista oficial + crea la Palta si falta (idempotente) |
| `src/components/Hoja.jsx` | La hoja de papel compartida: tipeo letra por letra, tinta irregular (`TipeoTinta`), el pie (`PieHoja`) y la hoja de texto de las páginas formales (`HojaTexto`) |
| `src/data/textos.js` | Textos de las hojas formales (borrador, editables) |
| `src/components/Tienda.jsx` | Carga de la tienda en el servidor, compartida por `/` y `/pieza/[slug]` |
| `src/app/pieza/[slug]/` | Link propio de cada pieza y su imagen para compartir |
| `src/lib/palabra.js` | Mide la palabra gigante con el mismo HTML/CSS de siempre y la pinta letra por letra en una textura para la pared |
| `src/lib/color.js` | OKLab/OKLCH en JS (los mismos `vivo()` y `color-mix` del CSS) para pasarle los colores ya calculados al shader |
| `src/components/Escena.jsx` | Elige el taller 3D o, si no hay WebGL, un respaldo DOM simple (pared, mesa, palabra, pedestal CSS y una pieza por vez) que se maneja con el mismo recorrido |
| `src/components/Store.jsx` | Tienda: el gesto en vivo (dedo 1:1 con inercia; ruedita, trackpad, teclado y flechas de a un paso cada 350 ms), ficha, carrito, pagar, la hoja de la máquina de escribir (catálogo completo, `HojaMaquina`), la miniatura que vuela en arco a la taza-carrito, URL por pieza y compartir |
| `src/components/Effects.jsx` | Loader («tipificado...» escribiéndose) |
| `src/lib/profundidad.js` + `profundidad.worker.js` | Decodifica cada foto y calcula su mapa de profundidad en un Web Worker (una vez por imagen) |
| `src/lib/fotos.js` | Fotos en dos tamaños: elige la de 800 en celular y la deriva de `image_url` |
| `src/lib/medir.js` | Tamaño y centrado por la base de cada pieza (respaldo sin WebGL) |
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
| `supabase/stock.sql` | Control de stock: columnas, historial (`stock_movimientos`), reserva al crear el pedido, venta/devolución por estado, liberación de vencidas, carga manual y avisos por mail (se puede correr más de una vez) |
| `src/lib/stock.js` | Niveles de stock (hay / últimas / sin) y textos; el comprador solo recibe `stock_estado`, nunca el número |
| `src/app/api/stock` · `api/cron/stock` | «¿Alcanza?» (sí/no) al sumar al carrito · cron diario de Vercel que libera reservas vencidas (respaldo) |

## Pendientes (TODO)

- [ ] **Peso y medidas de las 10 piezas:** son estimados. Pesarlas embaladas y corregirlos en Piezas.
- [ ] **Calibrar el factor de envío** (ver «Cómo calibrar el factor de envío») y completar la tabla de respaldo por provincia.
- [ ] Para que el mail de seguimiento llegue a cualquier comprador, el remitente (`MAIL_DESDE`) tiene que usar un dominio verificado en Resend.
- [ ] **Precios provisorios:** pino (hoy en $ 1 de prueba en la base), budinera, pochoclera y taza clásica no están en la lista. Corregirlos en el admin.
- [ ] Correr `supabase/ronda-precios-palta.sql` en Supabase.
- [ ] Correr `supabase/stock.sql` en Supabase y cargar el stock de las piezas que quieras controlar.
- [ ] Compotera ($ 25.000): cargarla desde el panel cuando haya pieza y foto.
- [ ] Confirmar qué colores ofrece en cada pieza (los cargados son estimados a partir de las fotos).
- [ ] Revisar los textos de producción y envío con el cliente.
- [ ] **Hojas formales (borrador):** revisar con el cliente `src/data/textos.js` (preguntas, cambios, envíos, términos y privacidad: plazos, correo, contacto) y, cuando estén aprobadas, poner `BORRADOR = false`.
- [ ] Probar una compra real chica con Mercado Pago de producción (y devolverla para ver que el cupón se libera).
- [ ] Revisar la parte legal con alguien que sepa (botón de arrepentimiento, datos fiscales/QR de ARCA, términos y condiciones).
- [ ] Dominio propio (tipificado.com.ar en NIC.ar) → conectarlo en Vercel → actualizar `NEXT_PUBLIC_SITE_URL`, las URL de Supabase, el webhook de MP y el remitente de los mails.
- [ ] Probar en un celular promedio de verdad. Si igual va lento, la calidad baja sola; los escalones están al principio de `Taller.jsx` (`NIVELES`: resolución, sombra, efectos).
- [ ] En iPhone, el giroscopio pide permiso la primera vez que tocás la pantalla. Si no lo da, la pieza igual se mueve sola de un lado a otro.

---

## Control de stock: poner en marcha

1. Supabase → **SQL Editor** → New query → pegá **todo** `supabase/stock.sql` → **Run**.
   - No borra nada: todas las piezas quedan **sin control** (como hasta ahora) hasta que cargues números desde el panel.
   - Se puede correr más de una vez, y también después de volver a correr `schema.sql` (no se pisan).
2. Panel → **Más → Ajustes → Estado de la tienda**: «Base de datos» tiene que decir **«con control de stock»**.
3. Cargá el stock en las piezas que quieras (Piezas → la pieza → Stock).
4. Opcional, en Vercel: `CRON_SECRET` (cualquier texto largo) para que solo el cron de Vercel pueda llamar a `/api/cron/stock`.

**Cómo está armado (para quien mantenga el código):**
- `products.stock` (`null` = sin control, nunca negativo). La clave pública (anon) no puede leer `stock` ni `stock_aviso`; la tienda arma `stock_estado` en el servidor (`Tienda.jsx`).
- **Reserva:** un trigger `BEFORE INSERT` en `orders` (lo dispara `crear_pedido`) bloquea las piezas con `FOR UPDATE` en orden fijo, verifica y descuenta; si no alcanza, el pedido no se crea (`sin_stock`, con `[{ id, name, agotada }]`). `crear_pedido` y `aplicar_pago` no se tocaron.
- **Venta / devolución:** un trigger `BEFORE UPDATE OF status`: a «pagado» (o más) la reserva pasa a venta; a «cancelado / rechazado / devuelto» con la reserva tomada, vuelve al stock. Si estaba liberada y después se aprueba el pago, se vuelve a descontar lo que haya (alerta «revisar stock» si no alcanzó).
- **Vencidas:** `liberar_reservas_vencidas()` (una a la vez, sin devolver dos veces; espera hasta 3 días si Mercado Pago dice que el pago está en proceso). Corre al crear pedidos, al leer el catálogo, con **pg_cron cada 5 min** (si el proyecto lo tiene) y con el **cron diario de Vercel** (`vercel.json`; en el plan gratis de Vercel el cron puede ser como mucho diario).
- **Mails:** `tomar_avisos_stock()` devuelve solo las piezas que cruzaron un nivel desde el último aviso; lo llaman el webhook de pagos y el panel al guardar.
- **Pruebas que se corrieron** (un Postgres real local, con schema.sql, seed.sql y stock.sql): venta que descuenta, reserva vencida que devuelve (y no devuelve dos veces), pago rechazado que devuelve, dos compras simultáneas de la última unidad (pasa una sola) y 20 compras a la vez sobre 3 unidades (pasan 3), «últimas unidades» con 9, «sin stock» con 0, carga manual que no pisa una venta en curso, devolución desde el panel, permisos (anon no ve el stock) y el mail (uno por cruce).
