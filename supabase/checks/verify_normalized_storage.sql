-- Read-only verification to run immediately after 202608140001_normalize_board_storage.sql.
select
  week_start,
  (select count(*) from jsonb_object_keys(raids)) as day_buckets,
  updated_at
from public.raid_board_weeks
order by week_start desc;

with legacy as (
  select members, catalog, schedule
  from public.raid_board_state
  where id = 'guild-main'
), legacy_counts as (
  select
    jsonb_array_length(members) as members,
    coalesce((select sum(jsonb_array_length(member -> 'characters')) from jsonb_array_elements(members) as member), 0) as characters,
    jsonb_array_length(catalog) as catalog,
    (select count(*) from jsonb_object_keys(coalesce(schedule -> 'weeks', '{}'::jsonb))) as weeks
  from legacy
), normalized_counts as (
  select
    (select count(*) from public.raid_members) as members,
    (select count(*) from public.raid_characters) as characters,
    (select count(*) from public.raid_catalog) as catalog,
    (select count(*) from public.raid_board_weeks) as weeks
)
select
  legacy_counts.members as legacy_members,
  normalized_counts.members as normalized_members,
  legacy_counts.characters as legacy_characters,
  normalized_counts.characters as normalized_characters,
  legacy_counts.catalog as legacy_catalog,
  normalized_counts.catalog as normalized_catalog,
  legacy_counts.weeks as legacy_weeks,
  normalized_counts.weeks as normalized_weeks,
  legacy_counts.members = normalized_counts.members
    and legacy_counts.characters = normalized_counts.characters
    and legacy_counts.catalog = normalized_counts.catalog
    and legacy_counts.weeks = normalized_counts.weeks as all_counts_match
from legacy_counts, normalized_counts;
