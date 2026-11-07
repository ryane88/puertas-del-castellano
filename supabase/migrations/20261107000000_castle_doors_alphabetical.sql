do $migration$
declare
    moves constant jsonb := '[
        {"old_position":1,"new_position":2,"badge":"PDB","destination_passage":"SoloCastleRoom"},
        {"old_position":2,"new_position":3,"badge":"PDC","destination_passage":"SalaPoemas"},
        {"old_position":3,"new_position":4,"badge":"PDD","destination_passage":"CastleEntrance"},
        {"old_position":7,"new_position":8,"badge":"PDH","destination_passage":"PasadizoHipervinculos"},
        {"old_position":17,"new_position":18,"badge":"PDQ","destination_passage":"PruebasDonQuijote"},
        {"old_position":27,"new_position":21,"badge":"PDT","destination_passage":"TavernRoom"}
    ]';
    snapshot jsonb;
begin
    lock table public.castle_doors in share row exclusive mode;

    -- Permit a rerun after the move. Preserve any later catalog edits.
    if not exists (
        select 1
        from jsonb_to_recordset(moves) as m(new_position integer, badge text, destination_passage text)
        left join public.castle_doors as d on d.position = m.new_position
        where d.badge is distinct from m.badge
           or d.destination_passage is distinct from m.destination_passage
    ) and exists (
        select 1 from public.castle_doors
        where position = 16 and badge = 'PDO' and destination_passage = 'PalacioDeObras'
    ) then
        return;
    end if;

    if exists (
        select 1
        from jsonb_to_recordset(moves) as m(old_position integer, badge text, destination_passage text)
        left join public.castle_doors as d on d.position = m.old_position
        where d.badge is distinct from m.badge
           or d.destination_passage is distinct from m.destination_passage
    ) then
        raise exception 'Castle doors changed since this migration was prepared. Review the source positions.';
    end if;

    if exists (
        select 1
        from (values (4), (8), (15), (16), (18), (21)) as slots(position)
        left join public.castle_doors as d using (position)
        where d.name is distinct from 'Puerta ' || lpad(slots.position::text, 2, '0')
           or d.badge is distinct from lpad(slots.position::text, 2, '0')
           or d.destination_passage is not null
           or d.initial_door is distinct from false
    ) or exists (
        select 1 from public.castle_doors
        where badge = 'PDO' or destination_passage = 'PalacioDeObras'
    ) then
        raise exception 'A target slot is no longer empty, or PDO already exists. Review the catalog before moving doors.';
    end if;

    select jsonb_agg(to_jsonb(source)) into snapshot
    from (
        select m.new_position, d.name, d.badge, d.destination_passage, d.initial_door
        from jsonb_to_recordset(moves) as m(old_position integer, new_position integer)
        join public.castle_doors as d on d.position = m.old_position
    ) as source;

    -- Vacate the old badges before filling the new slots, including the overlapping B/C/D move.
    update public.castle_doors as d
    set name = 'Puerta ' || lpad(d.position::text, 2, '0'),
        badge = lpad(d.position::text, 2, '0'), destination_passage = null, initial_door = false
    from jsonb_to_recordset(moves) as m(old_position integer)
    where d.position = m.old_position;

    update public.castle_doors as d
    set name = s.name, badge = s.badge, destination_passage = s.destination_passage,
        initial_door = s.initial_door
    from jsonb_to_recordset(snapshot) as s(
        new_position integer, name text, badge text, destination_passage text, initial_door boolean
    )
    where d.position = s.new_position;

    update public.castle_doors
    set name = 'Palacio de Obras', badge = 'PDO', destination_passage = 'PalacioDeObras'
    where position = 16;
end;
$migration$;
