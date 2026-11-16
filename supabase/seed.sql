-- Catálogo inicial: las 10 piezas + ajustes por defecto (pegar en SQL Editor después de schema.sql).
-- Se puede correr más de una vez: no duplica nada.
-- Las imágenes iniciales viven en /public/productos del sitio.

insert into products (slug, name, category, price, description, image_url, bg, table_color, word, pedestal, colors, glow, active, sort) values
('pino-navidad', 'Pino de navidad', 'deco / navidad', 28000, 'Pino de cerámica calado con luz adentro. Cuando lo prendés, los agujeritos tiran puntos de luz por toda la mesa.', '/productos/pino-navidad.webp', '#6e1a22', '#c9a48a', 'PINO', '', '[{"name":"Rojo moteado","hex":"#b3262b"},{"name":"Crudo","hex":"#efe4cc"},{"name":"Verde","hex":"#3f6b4a"}]'::jsonb, true, true, 0),
('taza-panzona', 'Taza panzona', 'taza panzona', 15500, 'La taza redondita, de las que se agarran con las dos manos. Para el mate cocido de la tarde o el café largo.', '/productos/taza-panzona.webp', '#c46a4c', '#e9d2bf', 'PANZONA', '', '[{"name":"Marrón","hex":"#5b2a1f"},{"name":"Verde","hex":"#3f6b4a"},{"name":"Rojo","hex":"#b3262b"}]'::jsonb, false, true, 1),
('platillo', 'Platillo Tipificado', 'platillo', 9500, 'Un infaltable para tu mesa: pequeño, versátil y con toda la identidad de la marca. Para anillos, aceitunas o la cucharita.', '/productos/platillo.webp', '#a8cde0', '#ece4d4', 'PLATILLO', '', '[{"name":"Celeste","hex":"#4fa3c4"},{"name":"Rojo","hex":"#b3262b"},{"name":"Bordó","hex":"#6e1f24"}]'::jsonb, false, true, 2),
('portamacetas-rayado', 'Portamacetas rayado', 'portamacetas / maceta para plantas acuáticas', 18000, 'Portamacetas con rayas verticales pintadas a mano. También sirve como maceta para plantas acuáticas.', '/productos/portamacetas-rayado.webp', '#8c9aae', '#ddd5c8', 'RAYADO', '', '[{"name":"Gris azulado","hex":"#6b7c93"},{"name":"Celeste","hex":"#4fa3c4"},{"name":"Verde","hex":"#3f6b4a"}]'::jsonb, false, true, 3),
('budinera', 'Budinera de cerámica', 'budinera', 32000, 'Budinera rectangular con trazos pintados a mano. Va al horno y después a la mesa, sin pasar por la fuente.', '/productos/budinera.webp', '#b4a3c8', '#e6ded2', 'BUDINERA', '', '[{"name":"Celeste","hex":"#4fa3c4"},{"name":"Gris azulado","hex":"#6b7c93"},{"name":"Verde","hex":"#3f6b4a"}]'::jsonb, false, true, 4),
('taza-clasica', 'Taza clásica', 'taza clásica', 15500, 'La de todos los días. Recta, cómoda y con el logo estampado a mano.', '/productos/taza-clasica.webp', '#8fa595', '#dcd4c4', 'CLÁSICA', '', '[{"name":"Petróleo","hex":"#1f6a73"},{"name":"Rojo","hex":"#b3262b"},{"name":"Negro","hex":"#2a2623"}]'::jsonb, false, true, 5),
('pochoclera', 'Pochoclera', 'tu nueva pochoclera', 22000, 'Bowl alto a rayas para la noche de peli. Entra un paquete entero de pochoclos (y un poco más).', '/productos/pochoclera.webp', '#b5261d', '#ddbba8', 'POCHOCLERA', '', '[{"name":"Rayas gris","hex":"#5d6470"},{"name":"Rayas rojas","hex":"#b3262b"},{"name":"Rayas verdes","hex":"#3f6b4a"}]'::jsonb, false, true, 6),
('portamacetas-moteado', 'Portamacetas moteado', 'portamacetas / maceta para plantas acuáticas', 18000, 'Portamacetas con salpicado de esmalte, cada uno distinto al otro. También sirve como maceta para plantas acuáticas.', '/productos/portamacetas-moteado.webp', '#a8907e', '#ddd5c8', 'MOTEADO', '', '[{"name":"Moteado verde","hex":"#2f5b45"},{"name":"Moteado negro","hex":"#2a2623"},{"name":"Moteado azul","hex":"#3d5f9a"}]'::jsonb, false, true, 7),
('plato-hondo', 'Plato hondo / cazuela', 'plato hondo / cazuela', 16000, 'Plato hondo de borde recto, para guiso, fideos o ensalada. Aguanta microondas y lavavajillas.', '/productos/plato-hondo.webp', '#9e4b3e', '#e3cfc0', 'CAZUELA', '', '[{"name":"Rojo","hex":"#b3262b"},{"name":"Celeste","hex":"#4fa3c4"},{"name":"Verde","hex":"#3f6b4a"}]'::jsonb, false, true, 8),
('tazon', 'Tazón', 'tazón', 17000, 'Tazón bajo y ancho, para el desayuno con cereales o el café con leche bien cargado.', '/productos/tazon.webp', '#9db0a0', '#dcd4c4', 'TAZÓN', '', '[{"name":"Negro","hex":"#2a2623"},{"name":"Celeste","hex":"#4fa3c4"},{"name":"Rojo","hex":"#b3262b"}]'::jsonb, false, true, 9)
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
('vacaciones', '{"activo": false, "vuelta": "", "mensaje": ""}'::jsonb)
on conflict (key) do nothing;

-- Opciones de entrega por defecto (solo si todavía no hay ninguna)
insert into shipping_options (kind, name, address, hours, price, sort)
select * from (values
  ('retiro', 'Retiro en el taller', '', 'Lunes a viernes de 10 a 18 h', 0, 0),
  ('coordinar', 'Envío a coordinar', '', '', 0, 1)
) as v(kind, name, address, hours, price, sort)
where not exists (select 1 from shipping_options);
