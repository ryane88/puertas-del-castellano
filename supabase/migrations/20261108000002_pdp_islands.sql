begin;

create table if not exists public.pdp_islands (
    slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    level smallint not null check (level between 1 and 3),
    label text not null check (label = btrim(label) and length(label) between 1 and 120),
    published boolean not null default false,
    unique (slug, level),
    check ((slug = 'yo' and label = 'Yo' and level = 1) or (slug <> 'yo' and level in (2, 3)))
);

create table if not exists public.pdp_bridges (
    from_slug text not null,
    to_slug text not null,
    from_level smallint not null check (from_level in (1, 2)),
    to_level smallint generated always as (from_level + 1) stored,
    sort_order smallint not null check (sort_order between 1 and case from_level when 1 then 20 else 10 end),
    published boolean not null default false,
    primary key (from_slug, to_slug),
    -- Editors can defer this constraint to swap two ranks in one transaction.
    constraint pdp_bridges_source_rank_key unique (from_slug, sort_order) deferrable initially immediate,
    foreign key (from_slug, from_level) references public.pdp_islands (slug, level),
    foreign key (to_slug, to_level) references public.pdp_islands (slug, level)
);

create index if not exists pdp_bridges_destination_idx on public.pdp_bridges (to_slug, to_level);

alter table public.pdp_islands enable row level security;
alter table public.pdp_bridges enable row level security;

revoke all on public.pdp_islands, public.pdp_bridges from public, anon, authenticated;
grant select on public.pdp_islands, public.pdp_bridges to anon, authenticated;

drop policy if exists pdp_published_islands on public.pdp_islands;
create policy pdp_published_islands on public.pdp_islands
    for select to anon, authenticated using (published);

drop policy if exists pdp_published_bridges on public.pdp_bridges;
create policy pdp_published_bridges on public.pdp_bridges
    for select to anon, authenticated using (
        published
        and exists (select 1 from public.pdp_islands where slug = from_slug and published)
        and exists (select 1 from public.pdp_islands where slug = to_slug and published)
    );

commit;
