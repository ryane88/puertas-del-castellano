begin;

-- Shared local castle backdrops. Preserve existing catalog entries.
insert into public.pdx_assets (slug, kind, label) values
    ('pasillo-pdd-00', 'scene', 'Pasillo de piedra'),
    ('pasillo-pdd-09', 'scene', 'Pasillo de la fortaleza')
on conflict (slug) do nothing;

do $$
begin
    if (select count(*) from public.pdx_assets
        where slug in ('pasillo-pdd-00', 'pasillo-pdd-09') and kind = 'scene') <> 2 then
        raise exception 'Un identificador de escenario PDX está ocupado por un objeto.';
    end if;
end;
$$;

insert into public.pdx_mazes (slug, floor_count, start_cell, start_facing, goal_cell, goal_facing, published)
values ('pdx-v2', 2, 20, 0, 4, 3, true);

-- Two 6 × 5 grids. IDs increase eastward, then southward.
insert into public.pdx_cells (maze_slug, id, floor, x, y, scene_asset)
select 'pdx-v2', (floor - 1) * 30 + n + 1, floor, n % 6, n / 6,
    case floor when 1 then 'pasillo-pdd-00' else 'pasillo-pdd-09' end
from generate_series(1, 2) as floors(floor)
cross join generate_series(0, 29) as grid(n);

update public.pdx_cells set objects = '[{"asset":"piedra","facing":3,"position":"right"}]'
where maze_slug = 'pdx-v2' and id = 4;

-- Only consecutive IDs within each path are linked.
with paths(cells) as (values
    (array[20,14,8,9,10,11,17,16,22,28]),
    (array[22,23,24,18]),
    (array[6,5,4]),
    (array[20,19,13,7,1,2,8]),
    (array[11,12,6]),
    (array[28,27,26,25,19]),
    (array[24,30,29,28]),
    (array[16,15,14]),
    (array[21,22]),
    (array[2,3,4]),
    (array[48,42,36]),
    (array[48,47,46,45,39,33,34,35,36]),
    (array[42,41,40,39,38,37,31,32,33]),
    (array[48,54,60,59,58,57,56,55,49,50,51,52,53,54]),
    (array[49,43,44,45])
)
insert into public.pdx_connections (maze_slug, cell_a, cell_b, kind, asset)
select 'pdx-v2', least(cells[i], cells[i + 1]), greatest(cells[i], cells[i + 1]), 'door', 'puerta'
from paths cross join lateral generate_series(1, cardinality(cells) - 1) as steps(i);

insert into public.pdx_connections (maze_slug, cell_a, cell_b, kind, asset) values
    ('pdx-v2', 18, 48, 'stairs', 'escalones'),
    ('pdx-v2', 6, 36, 'stairs', 'escalones');

insert into public.pdx_clues (maze_slug, sequence, cell_id, facing, verses) values
    ('pdx-v2', 1, 20, 0, array[
        'Dos pasos al norte para comenzar,',
        'tres hacia el este, sin dejar de contar.',
        'Un paso hacia el sur, con atención,',
        'y uno hacia el oeste, donde sigue la canción.'
    ]),
    ('pdx-v2', 2, 16, 3, array[
        'Gira a la izquierda y avanza dos, sin prisa,',
        'da media vuelta y avanza uno por el tramo recorrido.',
        'Gira a la derecha y avanza dos con una sonrisa,',
        'gira a la izquierda y avanza uno hacia el verso escondido.'
    ]),
    ('pdx-v2', 3, 18, 0, array[
        'Sube la escalera para empezar,',
        'al norte dos pasos tendrás que dar.',
        'Baja la escalera con cuidado,',
        'da dos pasos al oeste y examina la piedra suelta. ¡Has llegado!'
    ]);

commit;
