begin;

-- Starter vocabulary for a mystery set in the castle archive.
insert into public.pdm_words (word, short_definition, published)
values
    ('a buen recaudo', 'En un lugar seguro, protegido de pérdidas o daños.', true),
    ('a tientas', 'Guiándose por el tacto cuando no se puede ver bien.', true),
    ('atisbar', 'Alcanzar a ver algo con dificultad o solo en parte.', true),
    ('de soslayo', 'De lado o de reojo.', true),
    ('dejar constancia', 'Registrar algo para que pueda comprobarse más adelante.', true),
    ('desentrañar', 'Descubrir el sentido o la causa de algo difícil de entender.', true),
    ('enmendar', 'Corregir un error o un defecto.', true),
    ('escudriñar', 'Examinar algo con mucha atención para descubrir lo que no se ve a primera vista.', true),
    ('menguar', 'Disminuir en tamaño, cantidad o intensidad.', true),
    ('recelar de', 'Desconfiar de alguien o sospechar de algo.', true),
    ('resquicio', 'Abertura estrecha por la que puede pasar algo, como un hilo de luz.', true),
    ('sopesar', 'Considerar con cuidado varias opciones antes de decidir.', true)
on conflict (word) do nothing;

commit;
