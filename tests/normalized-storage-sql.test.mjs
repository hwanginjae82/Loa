import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const sql = fs.readFileSync(new URL("../supabase/migrations/202608140001_normalize_board_storage.sql", import.meta.url), "utf8");

test("creates separate member, character, catalog, and weekly tables", () => {
  for (const table of ["raid_members", "raid_characters", "raid_catalog", "raid_board_weeks"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.match(sql, /week_start date primary key/);
});

test("keeps the legacy board intact while copying its data", () => {
  assert.match(sql, /from public\.raid_board_state as state/);
  assert.doesNotMatch(sql, /drop table[^;]*raid_board_state/i);
  assert.doesNotMatch(sql, /delete from public\.raid_board_state/i);
});

test("uses one transactional RPC and row history triggers", () => {
  assert.match(sql, /function public\.save_raid_board_changes\(p_changes jsonb\)/);
  assert.match(sql, /function public\.archive_normalized_raid_data\(\)/);
  assert.match(sql, /return new;/);
  assert.match(sql, /revoke all on table public\.raid_members from anon, authenticated/);
});
