begin;

-- Upgrade the existing Mission 2 seed in place. Keep its IDs and publication flags.
update public.pde_missions
set title = 'El secreto de las caballerizas'
where slug = 'escapar-el-establo';

update public.pde_scenes
set title = 'Las caballerizas',
    description = 'Huele a heno y a cuero. La llave de la verja está guardada en el arcón de la armería. Busca las pistas entre los aperos.',
    image_path = 'images/pde/caballerizas.jpg'
where mission_slug = 'escapar-el-establo' and slug = 'el-establo';

update public.pde_objects as object
set name = clue.name,
    description = clue.description,
    hotspot_x = clue.x,
    hotspot_y = clue.y
from (values
    ('herradura', 'Herradura', 'Cuatro formas verbales y sus cifras están grabadas en el hierro.', 23, 52),
    ('escudo', 'Escudo heráldico', 'Cuatro figuras numeradas indican el orden de la combinación.', 53, 30),
    ('arcon-de-la-armeria', 'Inscripción y arcón de la armería', 'Una inscripción descansa sobre la tapa del arcón, junto a la cerradura de cuatro cifras.', 79, 58)
) as clue(slug, name, description, x, y)
where object.mission_slug = 'escapar-el-establo'
  and object.scene_slug = 'el-establo'
  and object.slug = clue.slug;

commit;
