create or replace function public.reject_legacy_seed_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  incoming_ids bigint[];
begin
  if new.schedule is distinct from old.schedule then
    select array_agg((raid ->> 'id')::bigint order by (raid ->> 'id')::bigint)
    into incoming_ids
    from jsonb_each(coalesce(new.schedule -> 'weeks', '{}'::jsonb)) as week,
         jsonb_each(week.value -> 'raids') as day,
         jsonb_array_elements(day.value) as raid
    where (raid ->> 'id') ~ '^[0-9]+$';

    if incoming_ids = array[101,102,103,201,202,203,301,302,401,402,501,502,601,602,701,702]::bigint[] then
      raise exception 'legacy seeded schedule overwrite blocked'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.reject_legacy_seed_schedule() from public, anon, authenticated;

drop trigger if exists reject_legacy_seed_schedule on public.raid_board_state;

create trigger reject_legacy_seed_schedule
before update of schedule on public.raid_board_state
for each row
execute function public.reject_legacy_seed_schedule();
