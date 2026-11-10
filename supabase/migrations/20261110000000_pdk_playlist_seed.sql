begin;

-- Source: https://www.youtube.com/playlist?list=PLgMsyDgBLLbUYmLlvh64A4AoZ-XKjhivl
-- Match every field against the previous published seed before changing a row.
-- Keep drafts and edited rows. Retire old seed tracks by unpublishing them.
with previous_seed (
    id, title, artist, youtube_video_id, difficulty, tags, learning_notes, sort_order, published
) as (
    values
        ('vivir-mi-vida', 'Vivir Mi Vida', 'Marc Anthony', '2IcuwAeMdR4', 'A2',
         array['ir a + infinitivo', 'planes'], 'Di en voz alta tres cosas que vas a hacer este fin de semana.', 10, true),
        ('bailando', 'Bailando', 'Enrique Iglesias', 'mgPf4mYE-fw', 'B1',
         array['gerundio', 'baile'], 'Imagina que estás en una fiesta y cuenta qué están haciendo tres personas.', 30, true),
        ('la-camisa-negra', 'La Camisa Negra', 'Juanes', 'BimPHAx5-Vk', 'A2',
         array['ropa', 'concordancia'], 'Describe la ropa que llevas y fíjate en la concordancia de los colores.', 40, true),
        ('tacones-rojos', 'Tacones Rojos', 'Sebastián Yatra', 'MkplGauFLjM', 'B1',
         array['descripción', 'emociones'], 'Describe unos zapatos llamativos y cuenta qué emoción te evocan.', 60, true),
        ('si-antes-te-hubiera-conocido', 'Si Antes Te Hubiera Conocido', 'Karol G', 'RH4CGBD1Bec', 'B2',
         array['pluscuamperfecto de subjuntivo', 'hipótesis'], 'Imagina cómo habría cambiado tu día si hubieras tomado otra ruta.', 70, true),
        ('provenza', 'Provenza', 'Karol G', '753dfvomgf4', 'B2',
         array['registro informal', 'invitaciones'], 'Invita a un amigo a salir y luego reformula la invitación para alguien que acabas de conocer.', 80, true)
),
replacements (id, youtube_video_id, sort_order) as (
    values
        ('la-camisa-negra', 'KVLHUXyzobM', 40),
        ('vivir-mi-vida', 'UJxtuIz3W1g', 60)
)
update public.karaoke_songs as song
set youtube_video_id = coalesce(replacement.youtube_video_id, song.youtube_video_id),
    sort_order = coalesce(replacement.sort_order, song.sort_order),
    published = replacement.id is not null
from previous_seed as previous
left join replacements as replacement on replacement.id = previous.id
where song.id = previous.id
    and row(song.title, song.artist, song.youtube_video_id, song.difficulty,
            song.tags, song.learning_notes, song.sort_order, song.published)
        is not distinct from
        row(previous.title, previous.artist, previous.youtube_video_id, previous.difficulty,
            previous.tags, previous.learning_notes, previous.sort_order, previous.published);

-- Videos played in YouTube's privacy-enhanced embed preview.
-- Insert missing catalog entries and keep any existing rows at the same IDs.
insert into public.karaoke_songs
    (id, title, artist, youtube_video_id, difficulty, tags, learning_notes, sort_order, published)
values
    ('el-mariachi', 'El Mariachi', 'Antonio Banderas', 'yLiUf33H49k', 'B1',
     array['letra en pantalla', 'acordes de guitarra', 'descripciones'], null, 10, true),
    ('lamento-boliviano', 'Lamento Boliviano', 'Los Enanitos Verdes', 'yAHXabav1SQ', 'B1',
     array['letra en pantalla', 'acordes de guitarra', 'emociones'], null, 20, true),
    ('limon-y-sal', 'Limón y Sal', 'Julieta Venegas', '_gTsBdYntp4', 'A2',
     array['letra en pantalla', 'descripciones'], null, 30, true),
    ('la-camisa-negra', 'La Camisa Negra', 'Juanes', 'KVLHUXyzobM', 'A2',
     array['ropa', 'concordancia'], 'Describe la ropa que llevas y fíjate en la concordancia de los colores.', 40, true),
    ('noviembre-sin-ti', 'Noviembre Sin Ti', 'Reik', 'k0GY8ajf4P8', 'B1',
     array['letra en pantalla', 'acordes de guitarra', 'recuerdos'], null, 50, true),
    ('vivir-mi-vida', 'Vivir Mi Vida', 'Marc Anthony', 'UJxtuIz3W1g', 'A2',
     array['ir a + infinitivo', 'planes'], 'Di en voz alta tres cosas que vas a hacer este fin de semana.', 60, true),
    ('a-dios-le-pido', 'A Dios Le Pido', 'Juanes', '68scoh5qsRY', 'B2',
     array['letra en pantalla', 'acordes de guitarra', 'subjuntivo'], null, 70, true),
    ('resistire', 'Resistiré', 'Dúo Dinámico', '6rYx2vqE-kU', 'B1',
     array['letra en pantalla', 'acordes de guitarra', 'futuro'], null, 80, true)
on conflict (id) do nothing;

commit;
