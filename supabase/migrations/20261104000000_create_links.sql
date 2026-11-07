begin;

create table if not exists public.links (
    id bigint generated always as identity primary key,
    title text not null,
    url text not null,
    description text,
    sort_order integer not null default 0,
    published boolean not null default false,
    created_at timestamptz not null default now(),
    constraint links_url_http_check
        check (url ~* '^https?://[^[:space:]]+$')
);

create index if not exists links_published_order_idx
    on public.links (sort_order, id)
    where published = true;

alter table public.links enable row level security;

-- Stop for review if a pre-existing table has other read policies that could
-- broaden public visibility. Never remove a policy owned by another feature.
do $$
begin
    if exists (
        select 1
        from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = 'links'
          and cmd in ('SELECT', 'ALL')
          and policyname <> 'Public can read published links'
    ) then
        raise exception 'Review the existing public.links read policies before applying this migration';
    end if;
end;
$$;

revoke all on table public.links from public, anon, authenticated;
grant select on table public.links to anon, authenticated;

drop policy if exists "Public can read published links" on public.links;
create policy "Public can read published links"
    on public.links for select to anon, authenticated
    using (published = true);

commit;
