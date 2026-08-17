create table if not exists public.raid_board_state (
  id text primary key,
  members jsonb not null default '[]'::jsonb,
  catalog jsonb not null default '[]'::jsonb,
  schedule jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.raid_board_state enable row level security;

grant select, insert, update on table public.raid_board_state to anon, authenticated;

drop policy if exists "raid board read" on public.raid_board_state;
create policy "raid board read"
on public.raid_board_state for select
to anon, authenticated
using (id = 'guild-main');

drop policy if exists "raid board create" on public.raid_board_state;
create policy "raid board create"
on public.raid_board_state for insert
to anon, authenticated
with check (id = 'guild-main');

drop policy if exists "raid board update" on public.raid_board_state;
create policy "raid board update"
on public.raid_board_state for update
to anon, authenticated
using (id = 'guild-main')
with check (id = 'guild-main');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'raid_board_state'
  ) then
    alter publication supabase_realtime add table public.raid_board_state;
  end if;
end $$;
