-- Run after 202608100001 through 202608100003.
-- This migration copies the current guild-main JSON data without deleting or changing raid_board_state.

create table if not exists public.raid_members (
  id text primary key,
  name text not null,
  representative_name text,
  color text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.raid_characters (
  character_key text primary key,
  member_id text not null references public.raid_members(id) on update cascade on delete cascade,
  name text not null,
  server_name text,
  class_name text not null,
  role text not null check (role in ('딜러', '서폿')),
  item_level numeric not null default 0,
  combat_power numeric,
  earns_gold boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists raid_characters_member_sort_idx
  on public.raid_characters (member_id, sort_order);

create table if not exists public.raid_catalog (
  id text primary key,
  name text not null,
  difficulty text not null,
  party_size integer not null check (party_size in (4, 8)),
  min_level numeric not null,
  gold integer not null default 0,
  color text,
  hex_color text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.raid_board_weeks (
  week_start date primary key,
  raids jsonb not null default '{}'::jsonb,
  unavailable_by_member jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.raid_data_history (
  history_id bigint generated always as identity primary key,
  entity_type text not null,
  entity_key text not null,
  operation text not null,
  previous_data jsonb not null,
  archived_at timestamptz not null default now()
);

create index if not exists raid_data_history_entity_archived_idx
  on public.raid_data_history (entity_type, entity_key, archived_at desc);

-- Copy legacy data only when each destination table is still empty.
insert into public.raid_members (id, name, representative_name, color, active, sort_order)
select
  member.value ->> 'id',
  member.value ->> 'name',
  nullif(member.value ->> 'representativeName', ''),
  coalesce(member.value ->> 'color', '#d7d7d7'),
  coalesce((member.value ->> 'active')::boolean, true),
  (member.ordinality - 1)::integer
from public.raid_board_state as state
cross join lateral jsonb_array_elements(state.members) with ordinality as member(value, ordinality)
where state.id = 'guild-main'
  and not exists (select 1 from public.raid_members)
on conflict (id) do nothing;

insert into public.raid_characters (
  character_key, member_id, name, server_name, class_name, role,
  item_level, combat_power, earns_gold, sort_order
)
select
  coalesce(character.value ->> 'id', character.value ->> 'name'),
  member.value ->> 'id',
  character.value ->> 'name',
  nullif(character.value ->> 'serverName', ''),
  character.value ->> 'className',
  character.value ->> 'role',
  coalesce(nullif(character.value ->> 'itemLevel', '')::numeric, 0),
  nullif(character.value ->> 'combatPower', '')::numeric,
  coalesce((character.value ->> 'earnsGold')::boolean, true),
  (character.ordinality - 1)::integer
from public.raid_board_state as state
cross join lateral jsonb_array_elements(state.members) as member(value)
cross join lateral jsonb_array_elements(member.value -> 'characters') with ordinality as character(value, ordinality)
where state.id = 'guild-main'
  and not exists (select 1 from public.raid_characters)
on conflict (character_key) do nothing;

insert into public.raid_catalog (
  id, name, difficulty, party_size, min_level, gold, color, hex_color, sort_order
)
select
  raid.value ->> 'id',
  raid.value ->> 'name',
  raid.value ->> 'difficulty',
  (raid.value ->> 'size')::integer,
  (raid.value ->> 'minLevel')::numeric,
  coalesce((raid.value ->> 'gold')::integer, 0),
  nullif(raid.value ->> 'color', ''),
  nullif(raid.value ->> 'hexColor', ''),
  (raid.ordinality - 1)::integer
from public.raid_board_state as state
cross join lateral jsonb_array_elements(state.catalog) with ordinality as raid(value, ordinality)
where state.id = 'guild-main'
  and not exists (select 1 from public.raid_catalog)
on conflict (id) do nothing;

insert into public.raid_board_weeks (week_start, raids, unavailable_by_member)
select
  week.key::date,
  coalesce(week.value -> 'raids', '{}'::jsonb),
  coalesce(week.value -> 'unavailableByMember', '{}'::jsonb)
from public.raid_board_state as state
cross join lateral jsonb_each(coalesce(state.schedule -> 'weeks', '{}'::jsonb)) as week(key, value)
where state.id = 'guild-main'
  and not exists (select 1 from public.raid_board_weeks)
on conflict (week_start) do nothing;

create or replace function public.archive_normalized_raid_data()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity_key text;
begin
  entity_key := case tg_table_name
    when 'raid_members' then old.id
    when 'raid_characters' then old.character_key
    when 'raid_catalog' then old.id
    when 'raid_board_weeks' then old.week_start::text
  end;

  insert into public.raid_data_history (
    entity_type, entity_key, operation, previous_data
  ) values (
    tg_table_name, entity_key, tg_op, to_jsonb(old)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.archive_normalized_raid_data() from public, anon, authenticated;

drop trigger if exists archive_raid_members on public.raid_members;
create trigger archive_raid_members
before update or delete on public.raid_members
for each row execute function public.archive_normalized_raid_data();

drop trigger if exists archive_raid_characters on public.raid_characters;
create trigger archive_raid_characters
before update or delete on public.raid_characters
for each row execute function public.archive_normalized_raid_data();

drop trigger if exists archive_raid_catalog on public.raid_catalog;
create trigger archive_raid_catalog
before update or delete on public.raid_catalog
for each row execute function public.archive_normalized_raid_data();

drop trigger if exists archive_raid_board_weeks on public.raid_board_weeks;
create trigger archive_raid_board_weeks
before update or delete on public.raid_board_weeks
for each row execute function public.archive_normalized_raid_data();

create or replace function public.save_raid_board_changes(p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_changes ? 'catalog' and exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_changes #> '{catalog,delete}', '[]'::jsonb)) as deleted(id)
    cross join public.raid_board_weeks as week
    cross join lateral jsonb_each(week.raids) as day(key, raids)
    cross join lateral jsonb_array_elements(day.raids) as instance(value)
    where instance.value ->> 'catalogId' = deleted.id
  ) then
    raise exception 'scheduled raid catalog entries cannot be deleted'
      using errcode = '23503';
  end if;

  if p_changes ? 'members' then
    insert into public.raid_members (
      id, name, representative_name, color, active, sort_order, updated_at
    )
    select id, name, representative_name, color, active, sort_order, now()
    from jsonb_to_recordset(coalesce(p_changes #> '{members,upsert}', '[]'::jsonb)) as row(
      id text, name text, representative_name text, color text, active boolean, sort_order integer
    )
    on conflict (id) do update set
      name = excluded.name,
      representative_name = excluded.representative_name,
      color = excluded.color,
      active = excluded.active,
      sort_order = excluded.sort_order,
      updated_at = now();
  end if;

  if p_changes ? 'characters' then
    insert into public.raid_characters (
      character_key, member_id, name, server_name, class_name, role,
      item_level, combat_power, earns_gold, sort_order, updated_at
    )
    select character_key, member_id, name, server_name, class_name, role,
      item_level, combat_power, earns_gold, sort_order, now()
    from jsonb_to_recordset(coalesce(p_changes #> '{characters,upsert}', '[]'::jsonb)) as row(
      character_key text, member_id text, name text, server_name text,
      class_name text, role text, item_level numeric, combat_power numeric,
      earns_gold boolean, sort_order integer
    )
    on conflict (character_key) do update set
      member_id = excluded.member_id,
      name = excluded.name,
      server_name = excluded.server_name,
      class_name = excluded.class_name,
      role = excluded.role,
      item_level = excluded.item_level,
      combat_power = excluded.combat_power,
      earns_gold = excluded.earns_gold,
      sort_order = excluded.sort_order,
      updated_at = now();

    delete from public.raid_characters
    where character_key in (
      select jsonb_array_elements_text(coalesce(p_changes #> '{characters,delete}', '[]'::jsonb))
    );
  end if;

  if p_changes ? 'members' then
    delete from public.raid_members
    where id in (
      select jsonb_array_elements_text(coalesce(p_changes #> '{members,delete}', '[]'::jsonb))
    );
  end if;

  if p_changes ? 'catalog' then
    insert into public.raid_catalog (
      id, name, difficulty, party_size, min_level, gold,
      color, hex_color, sort_order, updated_at
    )
    select id, name, difficulty, party_size, min_level, gold,
      color, hex_color, sort_order, now()
    from jsonb_to_recordset(coalesce(p_changes #> '{catalog,upsert}', '[]'::jsonb)) as row(
      id text, name text, difficulty text, party_size integer,
      min_level numeric, gold integer, color text, hex_color text, sort_order integer
    )
    on conflict (id) do update set
      name = excluded.name,
      difficulty = excluded.difficulty,
      party_size = excluded.party_size,
      min_level = excluded.min_level,
      gold = excluded.gold,
      color = excluded.color,
      hex_color = excluded.hex_color,
      sort_order = excluded.sort_order,
      updated_at = now();

    delete from public.raid_catalog
    where id in (
      select jsonb_array_elements_text(coalesce(p_changes #> '{catalog,delete}', '[]'::jsonb))
    );
  end if;

  if p_changes ? 'weeks' then
    insert into public.raid_board_weeks (
      week_start, raids, unavailable_by_member, updated_at
    )
    select week_start, raids, unavailable_by_member, now()
    from jsonb_to_recordset(coalesce(p_changes #> '{weeks,upsert}', '[]'::jsonb)) as row(
      week_start date, raids jsonb, unavailable_by_member jsonb
    )
    on conflict (week_start) do update set
      raids = excluded.raids,
      unavailable_by_member = excluded.unavailable_by_member,
      updated_at = now();

    delete from public.raid_board_weeks
    where week_start in (
      select value::date
      from jsonb_array_elements_text(coalesce(p_changes #> '{weeks,delete}', '[]'::jsonb)) as deleted(value)
    );
  end if;
end;
$$;

revoke all on function public.save_raid_board_changes(jsonb) from public;
grant execute on function public.save_raid_board_changes(jsonb) to anon, authenticated;

alter table public.raid_members enable row level security;
alter table public.raid_characters enable row level security;
alter table public.raid_catalog enable row level security;
alter table public.raid_board_weeks enable row level security;
alter table public.raid_data_history enable row level security;

revoke all on table public.raid_members from anon, authenticated;
revoke all on table public.raid_characters from anon, authenticated;
revoke all on table public.raid_catalog from anon, authenticated;
revoke all on table public.raid_board_weeks from anon, authenticated;
revoke all on table public.raid_data_history from anon, authenticated;
revoke all on sequence public.raid_data_history_history_id_seq from anon, authenticated;

grant select on table public.raid_members to anon, authenticated;
grant select on table public.raid_characters to anon, authenticated;
grant select on table public.raid_catalog to anon, authenticated;
grant select on table public.raid_board_weeks to anon, authenticated;

drop policy if exists "raid members read" on public.raid_members;
create policy "raid members read" on public.raid_members
for select to anon, authenticated using (true);

drop policy if exists "raid characters read" on public.raid_characters;
create policy "raid characters read" on public.raid_characters
for select to anon, authenticated using (true);

drop policy if exists "raid catalog read" on public.raid_catalog;
create policy "raid catalog read" on public.raid_catalog
for select to anon, authenticated using (true);

drop policy if exists "raid weeks read" on public.raid_board_weeks;
create policy "raid weeks read" on public.raid_board_weeks
for select to anon, authenticated using (true);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['raid_members', 'raid_characters', 'raid_catalog', 'raid_board_weeks']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
