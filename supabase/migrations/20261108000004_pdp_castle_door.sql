begin;

-- Claim only the vacant P slot. Keep an existing PDP assignment or any occupied slot.
lock table public.castle_doors in share row exclusive mode;

update public.castle_doors
set name = 'Puentes de Principiante', badge = 'PDP', destination_passage = 'PDP'
where position = 17 and name = 'Puerta 17' and badge = '17'
    and destination_passage is null and initial_door is false
    and not exists (
        select 1 from public.castle_doors where badge = 'PDP' or destination_passage = 'PDP'
    );

commit;
