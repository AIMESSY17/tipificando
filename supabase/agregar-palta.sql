-- =====================================================================
--  Agrega la pieza «Palta» a la base (la tienda real lee el catálogo de Supabase).
--  Supabase → SQL Editor → New query → pegá todo → Run.
--
--  - Idempotente: si ya existe una pieza con slug 'palta' no hace nada (on conflict do nothing),
--    se puede correr las veces que quieras.
--  - No toca ninguna otra pieza.
--  - La foto NO va al bucket «productos»: está en el repo (public/productos/palta.webp y su
--    versión de 800 en public/productos/800/palta.webp) y la sirve el mismo sitio en
--    /productos/palta.webp. Si después querés cambiarla, subila desde el panel (Piezas → Palta →
--    Subir foto): ahí sí se guarda en Storage y se reemplaza sola esta ruta.
--  - Queda primera en la tienda (sort = el menor - 1) y con la etiqueta «Nuevo».
--  - Colores: por ahora solo «Crema» (el de la foto). REVISAR con el cliente.
-- =====================================================================

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
  '[{"name":"Crema","hex":"#ecd59c"}]'::jsonb,
  false,
  true,
  coalesce((select min(sort) - 1 from products), 0),
  'nuevo'
on conflict (slug) do nothing;

-- Envío (estimado, igual que el resto: pesala embalada y corregilo en el panel). Solo si está vacío.
update products
set weight_g = 700, height_cm = 6, width_cm = 24, length_cm = 32, ship_estimado = true
where slug = 'palta' and weight_g is null;

-- Revisar:
-- select slug, name, category, price, sort, badge, image_url from products order by sort;
--
-- La tienda se renueva sola en ~60 s; para verla al instante, guardá cualquier pieza desde el panel.
