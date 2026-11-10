begin;

insert into public.pde_missions (slug, title, sort_order, published)
values ('escapar-el-establo', 'Escapar el establo', 20, true)
on conflict (slug) do nothing;

insert into public.pde_scenes (mission_slug, slug, title, description, image_path, sort_order, published)
values (
    'escapar-el-establo', 'el-establo', 'El establo',
    'Huele a heno. Un caballo mueve las patas al otro lado del muro. La puerta del establo está cerrada.',
    null, 10, true
)
on conflict (mission_slug, slug) do nothing;

insert into public.pde_objects
    (mission_slug, scene_slug, slug, name, description, hotspot_x, hotspot_y, sort_order, published)
values
    ('escapar-el-establo', 'el-establo', 'herradura', 'Herradura',
        'Una herradura de hierro cuelga de un clavo. Al darle la vuelta, ves tres rayas en el metal.',
        22, 63, 10, true),
    ('escapar-el-establo', 'el-establo', 'escudo', 'Escudo',
        'Sobre la pared hay un escudo de madera. Bajo el polvo se ve un caballo blanco.',
        52, 30, 20, true),
    ('escapar-el-establo', 'el-establo', 'arcon-de-la-armeria', 'Arcón alto de la armería',
        'Un arcón alto de roble está junto a la puerta. Tiene dos bandas de hierro y una cerradura pequeña.',
        81, 66, 30, true)
on conflict (mission_slug, scene_slug, slug) do nothing;

commit;
