begin;

create table if not exists public.grammar_adventures (
    slug text primary key,
    title text not null,
    grammar_focus text not null,
    premise text not null,
    outline text not null,
    active boolean not null default false,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    constraint grammar_adventures_slug_check check (slug ~ '^[a-z0-9-]{1,80}$')
);

create index if not exists grammar_adventures_active_order_idx
    on public.grammar_adventures (sort_order, slug) where active = true;
alter table public.grammar_adventures enable row level security;

do $$
begin
    if exists (
        select 1 from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = 'grammar_adventures'
          and cmd in ('SELECT', 'ALL')
          and policyname <> 'Public can read active grammar adventures'
    ) then
        raise exception 'Review existing grammar_adventures read policies before applying this migration';
    end if;
end;
$$;

revoke all on table public.grammar_adventures from public, anon, authenticated;
grant select on table public.grammar_adventures to anon, authenticated, service_role;

drop policy if exists "Public can read active grammar adventures" on public.grammar_adventures;
create policy "Public can read active grammar adventures"
    on public.grammar_adventures for select to anon, authenticated using (active = true);

-- Stable identifiers make reruns safe. Preserve any later dashboard edits.
insert into public.grammar_adventures
    (slug, title, grammar_focus, premise, outline, active, sort_order)
values
    ('dragon-subjuntivo', 'El Dragón del Subjuntivo',
     'El subjuntivo en deseos, dudas, emociones y posibilidades inciertas.',
     'La presencia de un dragón inquieta a una región.',
     'El viajero investiga relatos contradictorios y busca una solución mediante esperanzas, temores, peticiones e incertidumbre. Improvisa las escenas y la resolución según sus decisiones.',
     true, 10),
    ('castillo-imperfecto', 'El Castillo Imperfecto',
     'El imperfecto para hábitos, descripciones y situaciones en curso en el pasado.',
     'Los recuerdos y las rutinas revelan la historia olvidada de un castillo.',
     'El viajero reconstruye cómo era la vida cotidiana del castillo y descubre el misterio de su decadencia. Las memorias emergen a través de encuentros y decisiones libres.',
     true, 20),
    ('caminos-destino', 'Los Caminos del Destino',
     'Por y para: propósito, destino, causa, duración e intercambio.',
     'Un viaje reúne caminos, encargos y obligaciones que compiten entre sí.',
     'El viajero decide qué caminos recorrer y a quién ayudar, explorando propósitos, destinos, causas, duración e intercambios. Las consecuencias siguen sus decisiones sin una ruta prefijada.',
     true, 30)
on conflict (slug) do nothing;

commit;
