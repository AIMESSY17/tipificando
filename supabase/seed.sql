-- Catálogo inicial: las 11 piezas + ajustes por defecto (pegar en SQL Editor después de schema.sql).
-- Se puede correr más de una vez: no duplica nada ni pisa lo que ya cargaste (on conflict do nothing).
-- Precios de la lista oficial; los que no están en la lista quedan "a confirmar" (ver README).
-- Las imágenes iniciales viven en /public/productos del sitio.

insert into products (slug, name, category, price, description, image_url, bg, table_color, word, pedestal, colors, glow, active, sort) values
('pino-navidad', 'Pino de navidad', 'deco / navidad', 28000, 'Pino de cerámica calado con luz adentro. Cuando lo prendés, los agujeritos tiran puntos de luz por toda la mesa.', '/productos/pino-navidad.webp', '#6e1a22', '#c9a48a', 'PINO', '', '[{"name":"Rojo moteado","hex":"#b3262b"},{"name":"Crudo","hex":"#efe4cc"},{"name":"Verde","hex":"#3f6b4a"}]'::jsonb, true, true, 0),
('taza-panzona', 'Taza panzona', 'taza panzona', 35000, 'La taza redondita, de las que se agarran con las dos manos. Para el mate cocido de la tarde o el café largo.', '/productos/taza-panzona.webp', '#c46a4c', '#e9d2bf', 'PANZONA', '', '[{"name":"Marrón","hex":"#5b2a1f"},{"name":"Verde","hex":"#3f6b4a"},{"name":"Rojo","hex":"#b3262b"}]'::jsonb, false, true, 1),
('platillo', 'Platillo Tipificado', 'platillo', 25000, 'Un infaltable para tu mesa: pequeño, versátil y con toda la identidad de la marca. Para anillos, aceitunas o la cucharita.', '/productos/platillo.webp', '#a8cde0', '#ece4d4', 'PLATILLO', '', '[{"name":"Celeste","hex":"#4fa3c4"},{"name":"Rojo","hex":"#b3262b"},{"name":"Bordó","hex":"#6e1f24"}]'::jsonb, false, true, 2),
('portamacetas-rayado', 'Portamacetas rayado', 'medio tubo · hielera / maceta', 45000, 'Portamacetas con rayas verticales pintadas a mano. También sirve como maceta para plantas acuáticas.', '/productos/portamacetas-rayado.webp', '#8c9aae', '#ddd5c8', 'RAYADO', '', '[{"name":"Gris azulado","hex":"#6b7c93"},{"name":"Celeste","hex":"#4fa3c4"},{"name":"Verde","hex":"#3f6b4a"}]'::jsonb, false, true, 3),
('budinera', 'Budinera de cerámica', 'budinera', 32000, 'Budinera rectangular con trazos pintados a mano. Va al horno y después a la mesa, sin pasar por la fuente.', '/productos/budinera.webp', '#b4a3c8', '#e6ded2', 'BUDINERA', '', '[{"name":"Celeste","hex":"#4fa3c4"},{"name":"Gris azulado","hex":"#6b7c93"},{"name":"Verde","hex":"#3f6b4a"}]'::jsonb, false, true, 4),
('taza-clasica', 'Taza clásica', 'taza clásica', 15500, 'La de todos los días. Recta, cómoda y con el logo estampado a mano.', '/productos/taza-clasica.webp', '#8fa595', '#dcd4c4', 'CLÁSICA', '', '[{"name":"Petróleo","hex":"#1f6a73"},{"name":"Rojo","hex":"#b3262b"},{"name":"Negro","hex":"#2a2623"}]'::jsonb, false, true, 5),
('pochoclera', 'Pochoclera', 'tu nueva pochoclera', 22000, 'Bowl alto a rayas para la noche de peli. Entra un paquete entero de pochoclos (y un poco más).', '/productos/pochoclera.webp', '#b5261d', '#ddbba8', 'POCHOCLERA', '', '[{"name":"Rayas gris","hex":"#5d6470"},{"name":"Rayas rojas","hex":"#b3262b"},{"name":"Rayas verdes","hex":"#3f6b4a"}]'::jsonb, false, true, 6),
('portamacetas-moteado', 'Portamacetas moteado', 'medio tubo · hielera / maceta', 45000, 'Portamacetas con salpicado de esmalte, cada uno distinto al otro. También sirve como maceta para plantas acuáticas.', '/productos/portamacetas-moteado.webp', '#a8907e', '#ddd5c8', 'MOTEADO', '', '[{"name":"Moteado verde","hex":"#2f5b45"},{"name":"Moteado negro","hex":"#2a2623"},{"name":"Moteado azul","hex":"#3d5f9a"}]'::jsonb, false, true, 7),
('plato-hondo', 'Plato hondo / cazuela', 'plato hondo / cazuela', 50000, 'Plato hondo de borde recto, para guiso, fideos o ensalada. Aguanta microondas y lavavajillas.', '/productos/plato-hondo.webp', '#9e4b3e', '#e3cfc0', 'CAZUELA', '', '[{"name":"Rojo","hex":"#b3262b"},{"name":"Celeste","hex":"#4fa3c4"},{"name":"Verde","hex":"#3f6b4a"}]'::jsonb, false, true, 8),
('tazon', 'Tazón', 'tazón', 40000, 'Tazón bajo y ancho, para el desayuno con cereales o el café con leche bien cargado.', '/productos/tazon.webp', '#9db0a0', '#dcd4c4', 'TAZÓN', '', '[{"name":"Negro","hex":"#2a2623"},{"name":"Celeste","hex":"#4fa3c4"},{"name":"Rojo","hex":"#b3262b"}]'::jsonb, false, true, 9)
on conflict (slug) do nothing;

-- Pieza nueva: Palta (plato con forma de palta). Va primera en la tienda. Si ya existe, no se toca.
-- REVISAR: colores a definir con el cliente (por ahora solo "Crema", el de la foto).
insert into products (slug, name, category, price, description, image_url, bg, table_color, word, pedestal, colors, glow, active, sort, badge)
select 'palta', 'Palta', 'plato palta', 45000, 'Plato con forma de palta y el logo estampado a mano. Para la picada, las tostadas del desayuno o el centro de la mesa.', '/productos/palta.webp', '#6f7a3f', '#d7b48c', 'PALTA', '', '[{"name":"Crema","hex":"#ecd59c"}]'::jsonb, false, true, coalesce((select min(sort) - 1 from products), 0), 'nuevo'
on conflict (slug) do nothing;

insert into settings (key, value) values
('tagline', '"cerámica para la mesa, el escritorio y la casa"'::jsonb),
('instagram', '"tipificado_"'::jsonb),
('whatsapp', '""'::jsonb),
('produccion', '"Cada pieza se hace a pedido, en el color que elijas. Demora aprox. 10 a 15 días."'::jsonb),
('envio', '"Envío a coordinar por DM una vez confirmado el pedido."'::jsonb),
('pedestal', '"travertino"'::jsonb),
('negocio_nombre', '""'::jsonb),
('negocio_cuit', '""'::jsonb),
('negocio_direccion', '""'::jsonb),
('vacaciones', '{"activo": false, "vuelta": "", "mensaje": ""}'::jsonb),
('envio_cfg', '{"referencia": "andreani", "factor": 1, "margen": 10, "redondeo": 100, "gratis_desde": 0}'::jsonb),
('envio_respaldo', '{}'::jsonb)
on conflict (key) do nothing;

-- Opciones de entrega por defecto (solo si todavía no hay ninguna)
insert into shipping_options (kind, name, address, hours, price, sort)
select * from (values
  ('retiro', 'Retiro en el taller', '', 'Lunes a viernes de 10 a 18 h', 0, 0),
  ('coordinar', 'Envío a coordinar', '', '', 0, 1)
) as v(kind, name, address, hours, price, sort)
where not exists (select 1 from shipping_options);

-- Opción «Envío por Andreani» (cotizada en vivo con Zipnova). Se agrega una sola vez.
insert into shipping_options (kind, name, address, hours, price, sort)
select 'andreani', 'Envío por Andreani', '', '', 0, coalesce((select max(sort) + 1 from shipping_options), 0)
where not exists (select 1 from shipping_options where kind = 'andreani');

-- Peso (g, ya embalada) y caja (cm) de las 10 piezas. ESTIMADOS: revisarlos en el panel → Piezas.
-- Solo completa las piezas que todavía no tienen peso cargado (no pisa lo que ya editaste).
update products p set weight_g = v.peso, height_cm = v.alto, width_cm = v.ancho, length_cm = v.largo, ship_estimado = true
from (values
  ('taza-panzona', 800, 15, 15, 15),
  ('taza-clasica', 800, 15, 15, 15),
  ('platillo', 400, 8, 15, 15),
  ('plato-hondo', 900, 12, 22, 22),
  ('tazon', 900, 12, 22, 22),
  ('portamacetas-rayado', 1200, 20, 20, 20),
  ('portamacetas-moteado', 1200, 20, 20, 20),
  ('budinera', 1500, 12, 18, 32),
  ('pochoclera', 1300, 20, 22, 22),
  ('pino-navidad', 1000, 28, 18, 18),
  ('palta', 700, 6, 24, 32)
) as v(slug, peso, alto, ancho, largo)
where p.slug = v.slug and p.weight_g is null;
