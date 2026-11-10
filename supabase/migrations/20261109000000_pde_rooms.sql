begin;

create table if not exists public.pde_missions (
    slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    title text not null check (length(btrim(title)) between 1 and 120),
    sort_order integer not null default 0 check (sort_order >= 0),
    published boolean not null default false
);

create table if not exists public.pde_scenes (
    mission_slug text not null references public.pde_missions (slug),
    slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    title text not null check (length(btrim(title)) between 1 and 120),
    description text not null check (length(btrim(description)) between 1 and 600),
    image_path text,
    sort_order integer not null default 0 check (sort_order >= 0),
    published boolean not null default false,
    primary key (mission_slug, slug)
);

create table if not exists public.pde_objects (
    mission_slug text not null,
    scene_slug text not null,
    slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name text not null check (length(btrim(name)) between 1 and 80),
    description text not null check (length(btrim(description)) between 1 and 600),
    hotspot_x numeric(5,2) not null check (hotspot_x between 0 and 100),
    hotspot_y numeric(5,2) not null check (hotspot_y between 0 and 100),
    sort_order integer not null default 0 check (sort_order >= 0),
    published boolean not null default false,
    primary key (mission_slug, scene_slug, slug),
    foreign key (mission_slug, scene_slug) references public.pde_scenes (mission_slug, slug)
);

alter table public.pde_missions enable row level security;
alter table public.pde_scenes enable row level security;
alter table public.pde_objects enable row level security;

revoke all on public.pde_missions, public.pde_scenes, public.pde_objects from public, anon, authenticated;
grant select on public.pde_missions, public.pde_scenes, public.pde_objects to anon, authenticated;

drop policy if exists pde_published_missions on public.pde_missions;
create policy pde_published_missions on public.pde_missions
    for select to anon, authenticated using (published);

drop policy if exists pde_published_scenes on public.pde_scenes;
create policy pde_published_scenes on public.pde_scenes
    for select to anon, authenticated using (
        published and exists (
            select 1 from public.pde_missions as mission
            where mission.slug = pde_scenes.mission_slug and mission.published
        )
    );

drop policy if exists pde_published_objects on public.pde_objects;
create policy pde_published_objects on public.pde_objects
    for select to anon, authenticated using (
        published and exists (
            select 1 from public.pde_scenes as scene
            where scene.mission_slug = pde_objects.mission_slug
                and scene.slug = pde_objects.scene_slug and scene.published
        )
    );

commit;
