-- Manual rollback. Export any PDP content to keep before running this file.
begin;

lock table public.castle_doors in share row exclusive mode;

-- Release the slot only if it still matches the entry created by the PDP migration.
update public.castle_doors
set name = 'Puerta 17', badge = '17', destination_passage = null
where position = 17 and name = 'Puentes de Principiante' and badge = 'PDP'
    and destination_passage = 'PDP' and initial_door is false;

drop table if exists public.pdp_bridges;
drop table if exists public.pdp_islands;

commit;
