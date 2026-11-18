-- =====================================================================
--  Actualizar precios con la lista oficial (opcional)
--  Supabase → SQL Editor → pegá todo → Run.
--
--  Solo cambia el PRECIO de las piezas que figuran en la lista (y la categoría de los dos
--  "medio tubo"). No toca nombres, fotos, colores, descripciones, ofertas ni nada más.
--  Busca cada pieza por su slug: si cambiaste un slug o borraste una pieza, esa línea no hace nada.
--  Se puede correr más de una vez.
--
--  Si ya cargaste los precios a mano desde el panel, NO hace falta correrlo.
-- =====================================================================

begin;

-- Medio tubo (hielera / maceta): $45.000 → los dos portamacetas, con la categoría nueva
update products set price = 45000, category = 'medio tubo · hielera / maceta'
where slug in ('portamacetas-rayado', 'portamacetas-moteado');

-- Tazas panzonas: $35.000
update products set price = 35000 where slug = 'taza-panzona';

-- Tazones: $40.000
update products set price = 40000 where slug = 'tazon';

-- Cazuela (plato hondo / cazuela): $50.000
update products set price = 50000 where slug = 'plato-hondo';

-- Platillo (celeste): $25.000
update products set price = 25000 where slug = 'platillo';

-- Paltas: $45.000 (solo si la pieza "palta" ya existe; para crearla, ver README → Palta)
update products set price = 45000 where slug = 'palta';

commit;

-- Para revisar cómo quedó:
-- select slug, name, category, price from products order by sort;
