create table if not exists public.raid_board_state_history (
  history_id bigint generated always as identity primary key,
  state_id text not null,
  members jsonb not null,
  catalog jsonb not null,
  schedule jsonb not null,
  source_updated_at timestamptz not null,
  archived_at timestamptz not null default now()
);

create index if not exists raid_board_state_history_state_archived_idx
  on public.raid_board_state_history (state_id, archived_at desc);

alter table public.raid_board_state_history enable row level security;
revoke all on table public.raid_board_state_history from anon, authenticated;
revoke all on sequence public.raid_board_state_history_history_id_seq from anon, authenticated;

insert into public.raid_board_state_history (
  state_id,
  members,
  catalog,
  schedule,
  source_updated_at
)
select id, members, catalog, schedule, updated_at
from public.raid_board_state
where id = 'guild-main'
  and not exists (
    select 1
    from public.raid_board_state_history
    where state_id = 'guild-main'
  );

create or replace function public.archive_raid_board_state_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.raid_board_state_history (
    state_id,
    members,
    catalog,
    schedule,
    source_updated_at
  ) values (
    old.id,
    old.members,
    old.catalog,
    old.schedule,
    old.updated_at
  );
  return new;
end;
$$;

revoke all on function public.archive_raid_board_state_before_update() from public, anon, authenticated;

drop trigger if exists archive_raid_board_state_before_update
  on public.raid_board_state;

create trigger archive_raid_board_state_before_update
before update on public.raid_board_state
for each row
execute function public.archive_raid_board_state_before_update();
