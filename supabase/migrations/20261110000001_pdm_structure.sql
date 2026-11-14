begin;

create table public.pdm_words (
    id uuid primary key default gen_random_uuid(),
    word text not null unique check (btrim(word) <> ''),
    short_definition text not null check (btrim(short_definition) <> ''),
    published boolean not null default false
);

create table public.pdm_progress (
    user_id uuid not null references auth.users(id) on delete cascade,
    word_id uuid not null references public.pdm_words(id),
    last_reviewed_at timestamptz,
    next_review_at timestamptz,
    primary key (user_id, word_id)
);

create table public.pdm_chapters (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    chapter_number integer not null check (chapter_number > 0),
    title text not null check (btrim(title) <> ''),
    body text not null check (btrim(body) <> ''),
    created_at timestamptz not null default now(),
    unique (user_id, chapter_number)
);

create table public.pdm_reviews (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    word_id uuid not null references public.pdm_words(id),
    recalled boolean not null,
    reviewed_at timestamptz not null default now()
);

create index pdm_reviews_user_date_idx on public.pdm_reviews (user_id, reviewed_at desc);

alter table public.pdm_words enable row level security;
alter table public.pdm_progress enable row level security;
alter table public.pdm_chapters enable row level security;
alter table public.pdm_reviews enable row level security;

revoke all on table public.pdm_words, public.pdm_progress, public.pdm_chapters, public.pdm_reviews
    from public, anon, authenticated;
grant select on table public.pdm_words, public.pdm_progress, public.pdm_chapters, public.pdm_reviews
    to authenticated;

-- Player writes will go through trusted server code once the Phase 2 rules are defined.
grant select, insert, update, delete
    on table public.pdm_words, public.pdm_progress, public.pdm_chapters, public.pdm_reviews
    to service_role;

create policy pdm_read_published_words on public.pdm_words
    for select to authenticated using (published);
create policy pdm_read_own_progress on public.pdm_progress
    for select to authenticated using ((select auth.uid()) = user_id);
create policy pdm_read_own_chapters on public.pdm_chapters
    for select to authenticated using ((select auth.uid()) = user_id);
create policy pdm_read_own_reviews on public.pdm_reviews
    for select to authenticated using ((select auth.uid()) = user_id);

-- M is slot 13. Connect the standard placeholder, or a reserved PDM door without a destination.
lock table public.castle_doors in share row exclusive mode;

update public.castle_doors as door
set name = 'Palabras de Maestría', badge = 'PDM', destination_passage = 'PDMRoom'
where door.position = 13 and door.initial_door is false and door.destination_passage is null
    and ((door.badge = '13' and door.name = 'Puerta 13')
         or (door.badge = 'PDM' and door.name = 'Palabras de Maestría'))
    and not exists (
        select 1 from public.castle_doors as other
        where other.position <> door.position
            and (other.badge = 'PDM' or other.destination_passage = 'PDMRoom')
    );

commit;
