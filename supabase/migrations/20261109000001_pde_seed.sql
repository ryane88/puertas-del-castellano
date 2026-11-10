begin;

insert into public.pde_missions (slug, title, sort_order, published)
values ('el-secreto-del-alquimista', 'El secreto del alquimista', 10, true)
on conflict (slug) do nothing;

insert into public.pde_scenes (mission_slug, slug, title, description, image_path, sort_order, published)
values (
    'el-secreto-del-alquimista', 'el-taller', 'El taller del alquimista',
    'La puerta se cierra a tu espalda. Huele a papel viejo y a cera. En el taller, una vela sigue encendida.',
    'images/tavern-scenes/castle-archive.jpg', 10, true
)
on conflict (mission_slug, slug) do nothing;

insert into public.pde_objects
    (mission_slug, scene_slug, slug, name, description, hotspot_x, hotspot_y, sort_order, published)
values
    ('el-secreto-del-alquimista', 'el-taller', 'manuscrito', 'Manuscrito',
        'El libro está cubierto de polvo. En la última página hay un dibujo de la luna y una frase: «Todo cambia de noche».',
        17, 74, 10, true),
    ('el-secreto-del-alquimista', 'el-taller', 'tubo-de-ensayo', 'Tubo de ensayo',
        'Hay cuatro frascos de vidrio. Cada uno tiene dos medidas: una «POR CADA AVENTURA» y otra «PARA EL HECHIZO».',
        43, 37, 20, true),
    ('el-secreto-del-alquimista', 'el-taller', 'cofre', 'Cofre',
        'Debajo de la mesa hay un cofre de madera. Tiene una cerradura de hierro. Algo suena dentro cuando lo mueves.',
        77, 90, 30, true)
on conflict (mission_slug, scene_slug, slug) do nothing;

commit;
