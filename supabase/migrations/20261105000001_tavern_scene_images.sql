begin;

create table if not exists public.tavern_scene_images (
    id text primary key,
    image_path text,
    scene_description text not null,
    alt_text text,
    active boolean not null default false,
    constraint tavern_scene_images_id_check check (id ~ '^[a-z0-9-]{1,80}$'),
    constraint tavern_scene_images_active_content_check check (
        not active or (
            image_path is not null and image_path ~ '[^[:space:]]'
            and alt_text is not null and alt_text ~ '[^[:space:]]'
        )
    )
);

alter table public.tavern_scene_images enable row level security;

revoke all on table public.tavern_scene_images from public, anon, authenticated, service_role;
grant select on table public.tavern_scene_images to service_role;

-- Preserve any paths, descriptions, alt text, or activation set after seeding.
insert into public.tavern_scene_images (id, scene_description)
values
    ('moonlit-bridge', 'El jugador llega de noche a un puente de piedra sobre un río.'),
    ('castle-kitchen', 'El jugador entra en la antigua cocina de un castillo, con un hogar, ollas de cobre y una larga mesa de trabajo.'),
    ('forest-crossroads', 'El jugador llega a una bifurcación en un sendero del bosque.')
on conflict (id) do nothing;

commit;
