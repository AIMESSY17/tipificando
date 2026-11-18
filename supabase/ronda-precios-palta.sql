-- =====================================================================
--  Precios de la lista oficial + la Palta, en un solo paso.
--  Supabase → SQL Editor → New query → pegá todo → Run.
--
--  - Idempotente: se puede correr las veces que quieras, siempre deja lo mismo.
--  - Todo en una transacción: si algo falla, no cambia nada.
--  - Solo cambia el PRECIO de las piezas de la lista (y la categoría de los dos medio tubo).
--    No toca nombres, fotos, colores, descripciones ni ofertas.
--  - NO toca pino, budinera, pochoclera ni taza clásica (no están en la lista).
--  - Compotera ($ 25.000): no hay pieza ni foto todavía; se carga desde el panel (ver README).
--  - Tazas panzonas y tazones: también agarra variantes cargadas desde el panel con la misma
--    categoría (p. ej. otra «taza panzona» con slug distinto).
--  - Al final muestra nombre, slug y precio de todas las piezas para revisar.
-- =====================================================================

begin;

-- Paltas: $45.000. Si no existe, la crea (primera en la tienda, etiqueta «Nuevo»).
-- La foto está en el repo y la sirve el sitio en /productos/palta.webp.
insert into products (slug, name, category, price, description, image_url, bg, table_color, word, pedestal, colors, glow, active, sort, badge)
select
  'palta',
  'Palta',
  'plato palta',
  45000,
  'Plato con forma de palta y el logo estampado a mano. Para la picada, las tostadas del desayuno o el centro de la mesa.',
  '/productos/palta.webp',
  '#6f7a3f',   -- pared (verde palta)
  '#d7b48c',   -- mesa
  'PALTA',     -- palabra gigante
  '',          -- pedestal: el general
  '[{"name":"Crema","hex":"#ecd59c"}]'::jsonb,  -- REVISAR colores con el cliente
  false,
  true,
  coalesce((select min(sort) - 1 from products), 0),
  'nuevo'
on conflict (slug) do nothing;

update products set price = 45000 where slug = 'palta';

-- Envío de la Palta (estimado: pesala embalada y corregilo en el panel). Solo si está vacío.
update products
set weight_g = 700, height_cm = 6, width_cm = 24, length_cm = 32, ship_estimado = true
where slug = 'palta' and weight_g is null;

-- Medio tubo (hielera / maceta): $45.000 → los dos portamacetas, con la categoría de la lista
update products set price = 45000, category = 'medio tubo · hielera / maceta'
where slug in ('portamacetas-rayado', 'portamacetas-moteado');

-- Tazas panzonas: $35.000 (y sus variantes)
update products set price = 35000
where slug = 'taza-panzona' or slug like 'taza-panzona-%' or lower(category) = 'taza panzona';

-- Tazones: $40.000 (y sus variantes)
update products set price = 40000
where slug = 'tazon' or slug like 'tazon-%' or lower(category) in ('tazón', 'tazon');

-- Cazuela (plato hondo / cazuela): $50.000
update products set price = 50000 where slug = 'plato-hondo';

-- Platillo (celeste): $25.000
update products set price = 25000 where slug = 'platillo';

commit;

-- Para revisar cómo quedó (la tienda se renueva sola en ~60 s; al instante: guardá cualquier pieza desde el panel)
select name as nombre, slug, price as precio from products order by sort;
