begin;

create schema pdm_private;
revoke all on schema pdm_private from public, anon, authenticated;

create table pdm_private.chapter_quota (
    singleton boolean primary key default true check (singleton),
    minute_until timestamptz not null default '-infinity',
    minute_count integer not null default 0,
    day_until timestamptz not null default '-infinity',
    day_count integer not null default 0
);

insert into pdm_private.chapter_quota default values;

create function public.reserve_pdm_chapter_request()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    quota pdm_private.chapter_quota%rowtype;
    checked_at timestamptz;
begin
    -- Serialize reservations across Edge Function instances.
    select * into strict quota
    from pdm_private.chapter_quota
    where singleton
    for update;

    checked_at := pg_catalog.clock_timestamp();

    if (quota.minute_until > checked_at and quota.minute_count >= 4)
        or (quota.day_until > checked_at and quota.day_count >= 60) then
        return false;
    end if;

    update pdm_private.chapter_quota
    set minute_count = case when minute_until <= checked_at then 1 else minute_count + 1 end,
        minute_until = case when minute_until <= checked_at then checked_at + interval '1 minute' else minute_until end,
        day_count = case when day_until <= checked_at then 1 else day_count + 1 end,
        day_until = case when day_until <= checked_at then checked_at + interval '24 hours' else day_until end
    where singleton;

    return true;
end;
$$;

revoke all on function public.reserve_pdm_chapter_request() from public, anon, authenticated;
grant execute on function public.reserve_pdm_chapter_request() to service_role;

commit;
