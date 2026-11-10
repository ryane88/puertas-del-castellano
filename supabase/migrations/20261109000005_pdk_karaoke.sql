begin;

create table if not exists public.karaoke_songs (
    id text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
    title text not null check (btrim(title) <> ''),
    artist text not null check (btrim(artist) <> ''),
    youtube_video_id text check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
    difficulty text not null check (difficulty in ('A2', 'B1', 'B2')),
    tags text[] not null default '{}',
    learning_notes text,
    sort_order integer not null default 0,
    published boolean not null default false
);

create index if not exists karaoke_songs_published_order_idx
    on public.karaoke_songs (sort_order, id) where published;
alter table public.karaoke_songs enable row level security;

do $$
begin
    if exists (
        select 1 from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = 'karaoke_songs'
          and cmd in ('SELECT', 'ALL')
          and policyname <> 'Public can read published karaoke songs'
    ) then
        raise exception 'Review existing karaoke_songs read policies before applying this migration';
    end if;
end;
$$;

revoke all on table public.karaoke_songs from public, anon, authenticated;
grant select on table public.karaoke_songs to anon, authenticated;
grant select, insert, update, delete on table public.karaoke_songs to service_role;

drop policy if exists "Public can read published karaoke songs" on public.karaoke_songs;
create policy "Public can read published karaoke songs"
    on public.karaoke_songs for select to anon, authenticated using (published);

-- Published tracks passed playback in the YouTube privacy-enhanced iframe.
-- Keep draft rows until a suitable embeddable karaoke version is verified.
-- Stable IDs preserve any later catalog edits when this migration is rerun.
insert into public.karaoke_songs
    (id, title, artist, youtube_video_id, difficulty, tags, learning_notes, sort_order, published)
values
    ('vivir-mi-vida', 'Vivir Mi Vida', 'Marc Anthony', '2IcuwAeMdR4', 'A2',
     array['ir a + infinitivo', 'planes'], 'Di en voz alta tres cosas que vas a hacer este fin de semana.', 10, true),
    ('la-bicicleta', 'La Bicicleta', 'Carlos Vives & Shakira', null, 'B1',
     array['trayectos', 'lugares'], 'Describe tu ruta favorita en bici y dos sitios por los que pasas.', 20, false),
    ('bailando', 'Bailando', 'Enrique Iglesias', 'mgPf4mYE-fw', 'B1',
     array['gerundio', 'baile'], 'Imagina que estás en una fiesta y cuenta qué están haciendo tres personas.', 30, true),
    ('la-camisa-negra', 'La Camisa Negra', 'Juanes', 'BimPHAx5-Vk', 'A2',
     array['ropa', 'concordancia'], 'Describe la ropa que llevas y fíjate en la concordancia de los colores.', 40, true),
    ('despacito', 'Despacito', 'Luis Fonsi & Daddy Yankee', null, 'B2',
     array['diminutivos', 'ritmo'], 'Di un diminutivo que usarías con cariño y otro que indique un tamaño pequeño.', 50, false),
    ('tacones-rojos', 'Tacones Rojos', 'Sebastián Yatra', 'MkplGauFLjM', 'B1',
     array['descripción', 'emociones'], 'Describe unos zapatos llamativos y cuenta qué emoción te evocan.', 60, true),
    ('si-antes-te-hubiera-conocido', 'Si Antes Te Hubiera Conocido', 'Karol G', 'RH4CGBD1Bec', 'B2',
     array['pluscuamperfecto de subjuntivo', 'hipótesis'], 'Imagina cómo habría cambiado tu día si hubieras tomado otra ruta.', 70, true),
    ('provenza', 'Provenza', 'Karol G', '753dfvomgf4', 'B2',
     array['registro informal', 'invitaciones'], 'Invita a un amigo a salir y luego reformula la invitación para alguien que acabas de conocer.', 80, true)
on conflict (id) do nothing;

-- K is slot 11 of the existing wall. Only claim the original placeholder.
lock table public.castle_doors in share row exclusive mode;

update public.castle_doors
set name = 'Palacio del Karaoke', badge = 'PDK', destination_passage = 'PDK'
where position = 11 and name = 'Puerta 11' and badge = '11'
    and destination_passage is null and initial_door is false
    and not exists (
        select 1 from public.castle_doors where badge = 'PDK' or destination_passage = 'PDK'
    );

commit;
