begin;

create table public.pdx_assets (
    slug text primary key,
    kind text not null check (kind in ('scene', 'object')),
    label text not null,
    image_url text check (image_url ~* '^https://[^[:space:]]+$')
);

create table public.pdx_mazes (
    slug text primary key,
    floor_count smallint not null check (floor_count = 2),
    start_cell integer not null,
    start_facing smallint not null check (start_facing between 0 and 3),
    goal_cell integer not null check (goal_cell <> start_cell),
    goal_facing smallint not null check (goal_facing between 0 and 3),
    published boolean not null default false
);

create table public.pdx_cells (
    maze_slug text not null references public.pdx_mazes (slug),
    id integer not null,
    floor smallint not null check (floor between 1 and 2),
    x smallint not null,
    y smallint not null,
    scene_asset text not null references public.pdx_assets (slug),
    -- An object is visible when facing its world heading (0=N, 1=E, 2=S, 3=O).
    objects jsonb not null default '[]' check (jsonb_typeof(objects) = 'array'),
    primary key (maze_slug, id),
    unique (maze_slug, floor, x, y)
);

alter table public.pdx_mazes
    add foreign key (slug, start_cell) references public.pdx_cells (maze_slug, id)
        deferrable initially deferred,
    add foreign key (slug, goal_cell) references public.pdx_cells (maze_slug, id)
        deferrable initially deferred;

-- Each link is bidirectional. Its direction is derived from the two coordinates.
create table public.pdx_connections (
    maze_slug text not null,
    cell_a integer not null,
    cell_b integer not null check (cell_b > cell_a),
    kind text not null check (kind in ('door', 'stairs')),
    asset text not null references public.pdx_assets (slug),
    primary key (maze_slug, cell_a, cell_b),
    foreign key (maze_slug, cell_a) references public.pdx_cells (maze_slug, id),
    foreign key (maze_slug, cell_b) references public.pdx_cells (maze_slug, id)
);

create table public.pdx_clues (
    maze_slug text not null,
    sequence smallint not null check (sequence between 1 and 3),
    cell_id integer not null,
    facing smallint not null check (facing between 0 and 3),
    verses text[] not null check (
        cardinality(verses) = 4 and array_position(verses, null) is null
        and btrim(verses[1]) <> '' and btrim(verses[2]) <> ''
        and btrim(verses[3]) <> '' and btrim(verses[4]) <> ''
    ),
    primary key (maze_slug, sequence),
    unique (maze_slug, cell_id),
    foreign key (maze_slug, cell_id) references public.pdx_cells (maze_slug, id)
);

alter table public.pdx_assets enable row level security;
alter table public.pdx_mazes enable row level security;
alter table public.pdx_cells enable row level security;
alter table public.pdx_connections enable row level security;
alter table public.pdx_clues enable row level security;

revoke all on public.pdx_assets, public.pdx_mazes, public.pdx_cells,
    public.pdx_connections, public.pdx_clues from public, anon, authenticated;
grant select on public.pdx_assets, public.pdx_mazes, public.pdx_cells,
    public.pdx_connections, public.pdx_clues to anon, authenticated;

create policy pdx_public_assets on public.pdx_assets for select to anon, authenticated using (true);
create policy pdx_published_mazes on public.pdx_mazes for select to anon, authenticated using (published);
create policy pdx_published_cells on public.pdx_cells for select to anon, authenticated
    using (exists (select 1 from public.pdx_mazes where slug = maze_slug and published));
create policy pdx_published_connections on public.pdx_connections for select to anon, authenticated
    using (exists (select 1 from public.pdx_mazes where slug = maze_slug and published));
create policy pdx_published_clues on public.pdx_clues for select to anon, authenticated
    using (exists (select 1 from public.pdx_mazes where slug = maze_slug and published));

-- NULL selects the CSS placeholder. Future scene art should be a wall texture
-- without openings or props, since the renderer draws those from the map.
insert into public.pdx_assets (slug, kind, label) values
    ('silleria', 'scene', 'Sillería'),
    ('pizarra', 'scene', 'Pizarra'),
    ('sol', 'object', 'Sol'),
    ('torre', 'object', 'Torre'),
    ('puerta', 'object', 'Puerta'),
    ('escalones', 'object', 'Escalones'),
    ('piedra', 'object', 'Piedra suelta');

insert into public.pdx_mazes values ('pdx-v1', 2, 21, 0, 43, 2, true);

-- Cell IDs run west to east, north to south, in two 5 × 5 grids.
insert into public.pdx_cells (maze_slug, id, floor, x, y, scene_asset)
select 'pdx-v1', (floor - 1) * 25 + n + 1, floor, n % 5, n / 5,
    case floor when 1 then 'silleria' else 'pizarra' end
from generate_series(1, 2) as floors(floor)
cross join generate_series(0, 24) as grid(n);

update public.pdx_cells set objects = '[{"asset":"sol","facing":0,"position":"left"}]'
where maze_slug = 'pdx-v1' and id = 11;
update public.pdx_cells set objects = '[{"asset":"torre","facing":1,"position":"back"}]'
where maze_slug = 'pdx-v1' and id = 30;
update public.pdx_cells set objects = '[{"asset":"piedra","facing":2,"position":"right"}]'
where maze_slug = 'pdx-v1' and id = 43;

-- Each path uses local cell numbers on its own floor. Paths may meet or loop.
with paths(floor, cells) as (values
    (1, array[21,16,11,12,13,8,3,4,5]),
    (1, array[3,2,1,6,7,12]),
    (1, array[4,9,10,15,14,19,20,25,24,23,22,17,18,13]),
    (2, array[5,10,15,14,13,18]),
    (2, array[5,4,3,2,1,6,7,12,11,16,21,22,17,18]),
    (2, array[10,9,8,13]),
    (2, array[15,20,25,24,19,18]),
    (2, array[24,23])
)
insert into public.pdx_connections (maze_slug, cell_a, cell_b, kind, asset)
select 'pdx-v1',
    (floor - 1) * 25 + least(cells[i], cells[i + 1]),
    (floor - 1) * 25 + greatest(cells[i], cells[i + 1]),
    'door', 'puerta'
from paths cross join lateral generate_series(1, cardinality(cells) - 1) as steps(i);

insert into public.pdx_connections values ('pdx-v1', 5, 30, 'stairs', 'escalones');

-- Solution, preserving heading on the stairs:
-- 21 N -> 11 N -> 13 E; 13 E -> 3 N -> 5 E -> 30 E;
-- 30 E -> 40 S -> 38 O -> 43 S, then inspect the loose stone.
insert into public.pdx_clues values
    ('pdx-v1', 1, 21, 0, array[
        'Mira al norte en el umbral,',
        'da dos pasos hacia el sol.',
        'Gira a la derecha junto a su señal,',
        'dos pasos más y otro verso verás.'
    ]),
    ('pdx-v1', 2, 13, 1, array[
        'Mira al este donde lees mi cantar,',
        'gira a la izquierda y dos pasos has de dar.',
        'Gira a la derecha, avanza dos y sube la escalera,',
        'mira al este: junto a la torre otro poema te espera.'
    ]),
    ('pdx-v1', 3, 30, 1, array[
        'Mira al este, gira a la derecha y dos pasos da,',
        'gira a la derecha, avanza dos y un desvío habrá.',
        'Gira a la izquierda y avanza un paso con cuidado,',
        'examina la piedra suelta: algo duerme a su lado.'
    ]);

-- Only claim the vacant X slot. Leave the other 26 doors and initial door alone.
lock table public.castle_doors in share row exclusive mode;
do $door$
begin
    update public.castle_doors
    set name = '¿Puedes Descubrir la X?', badge = 'PDX', destination_passage = 'PDX'
    where position = 25 and name = 'Puerta 25' and badge = '25'
        and destination_passage is null and initial_door is false
        and not exists (
            select 1 from public.castle_doors where badge = 'PDX' or destination_passage = 'PDX'
        );

    if not found then
        raise exception 'The PDX door or slot 25 is already configured. Review castle_doors before applying.';
    end if;
end;
$door$;

commit;
