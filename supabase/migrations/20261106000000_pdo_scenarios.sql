begin;

create table if not exists public.pdo_scenarios (
    slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    title text not null check (btrim(title) <> ''),
    premise text not null check (btrim(premise) <> ''),
    image_paths jsonb not null,
    sort_order integer not null default 0,
    published boolean not null default false,
    constraint pdo_scene_images_check check (
        jsonb_typeof(image_paths) = 'object'
        and image_paths ?& array['act_1', 'act_2_a', 'act_2_b', 'act_3']
        and image_paths - array['act_1', 'act_2_a', 'act_2_b', 'act_3'] = '{}'::jsonb
        and coalesce(image_paths ->> 'act_1', '') ~ '^images/[a-zA-Z0-9_/-]+\.(jpg|jpeg|png|webp)$'
        and coalesce(image_paths ->> 'act_2_a', '') ~ '^images/[a-zA-Z0-9_/-]+\.(jpg|jpeg|png|webp)$'
        and coalesce(image_paths ->> 'act_2_b', '') ~ '^images/[a-zA-Z0-9_/-]+\.(jpg|jpeg|png|webp)$'
        and coalesce(image_paths ->> 'act_3', '') ~ '^images/[a-zA-Z0-9_/-]+\.(jpg|jpeg|png|webp)$'
    )
);

alter table public.pdo_scenarios enable row level security;
revoke all on table public.pdo_scenarios from public, anon, authenticated;
grant select on table public.pdo_scenarios to anon, authenticated, service_role;
drop policy if exists pdo_read_published on public.pdo_scenarios;
create policy pdo_read_published on public.pdo_scenarios
    for select to anon, authenticated using (published);

-- This catalog contains public-facing material. Keep scripts and solutions server-side.
insert into public.pdo_scenarios (slug, title, premise, image_paths, sort_order, published)
values
    ('manuscrito', 'El manuscrito desaparecido',
     'Falta el manuscrito de la función y el público está a punto de entrar. En el archivo queda un registro incompleto y alguien en el patio vio pasar a una persona con prisa.',
     '{"act_1":"images/tavern-scenes/castle-archive.jpg","act_2_a":"images/tavern-scenes/castle-archive.jpg","act_2_b":"images/tavern-scenes/overgrown-courtyard.jpg","act_3":"images/tavern-scenes/ruined-great-hall.jpg"}',
     10, true),
    ('campana', 'La campana que sonó dos veces',
     'La campana del paso se adelanta y un carro cruza el puente antes de la inspección. Quien vigilaba el puente dice que oyó la señal desde el camino, pero en el puesto de guardia aseguran que nadie tiró de la cuerda.',
     '{"act_1":"images/tavern-scenes/moonlit-bridge.jpg","act_2_a":"images/tavern-scenes/roadside-shrine.jpg","act_2_b":"images/tavern-scenes/forest-crossroads.jpg","act_3":"images/tavern-scenes/river-ferry.jpg"}',
     20, false),
    ('brindis', 'El brindis de la tregua',
     'La botella que ambas familias sellaron para celebrar la tregua aparece abierta en la cocina. Alguien cambió la lista de entregas y dos testigos afirman haber visto la botella en lugares distintos a la misma hora.',
     '{"act_1":"images/tavern-scenes/ruined-great-hall.jpg","act_2_a":"images/tavern-scenes/castle-kitchen.jpg","act_2_b":"images/tavern-scenes/market-stalls.jpg","act_3":"images/tavern-scenes/overgrown-courtyard.jpg"}',
     30, false)
on conflict (slug) do nothing;

commit;
