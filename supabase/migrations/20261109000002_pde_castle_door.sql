begin;

-- E is slot 05 in the 27-door wall. Preserve occupied slots and existing PDE assignments.
lock table public.castle_doors in share row exclusive mode;

update public.castle_doors
set name = 'Posibilidad de Escapar', badge = 'PDE', destination_passage = 'PDE'
where position = 5 and name = 'Puerta 05' and badge = '05'
    and destination_passage is null and initial_door is false
    and not exists (
        select 1 from public.castle_doors where badge = 'PDE' or destination_passage = 'PDE'
    );

commit;
