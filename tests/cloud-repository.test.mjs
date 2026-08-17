import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBoardChanges,
  catalogToRows,
  charactersToRows,
  membersToRows,
  rowsToCatalog,
  rowsToMembers,
  rowsToSchedule,
  loadCloudBoard,
  saveCloudBoardChanges,
  weeksToRows,
} from "../src/cloudRepository.js";

const members = [{
  id: "member-1",
  name: "김밥",
  color: "#ffeeaa",
  active: true,
  characters: [{ id: "루페온:김밥", name: "김밥", serverName: "루페온", className: "블레이드", role: "딜러", itemLevel: 1750, combatPower: 3700, earnsGold: true }],
}];
const catalog = [{ id: "raid-hard", name: "종막", difficulty: "하드", size: 8, minLevel: 1730, gold: 48000, hexColor: "#aaaaaa" }];
const schedule = { version: 2, weeks: { "2026-08-12": { raids: { wed: [{ id: 1, catalogId: "raid-hard", characterIds: ["김밥"] }] }, unavailableByMember: { "member-1": ["thu"] } } } };

test("round-trips normalized member and character rows", () => {
  assert.deepEqual(rowsToMembers(membersToRows(members), charactersToRows(members)), members);
});

test("round-trips catalog and weekly schedule rows", () => {
  assert.deepEqual(rowsToCatalog(catalogToRows(catalog)), catalog);
  assert.deepEqual(rowsToSchedule(weeksToRows(schedule)), schedule);
});

test("builds row-level changes only for edited entities", () => {
  const nextMembers = structuredClone(members);
  nextMembers[0].characters[0].itemLevel = 1760;
  const changes = buildBoardChanges(
    { members, catalog, schedule },
    { members: nextMembers, catalog, schedule },
    new Set(["members"]),
  );
  assert.deepEqual(Object.keys(changes), ["characters"]);
  assert.equal(changes.characters.upsert[0].item_level, 1760);
  assert.deepEqual(changes.characters.delete, []);
});

test("deletes only rows removed from the edited collection", () => {
  const changes = buildBoardChanges(
    { members, catalog, schedule },
    { members: [{ ...members[0], characters: [] }], catalog, schedule },
    new Set(["members"]),
  );
  assert.deepEqual(changes.characters.delete, ["루페온:김밥"]);
  assert.equal(changes.members, undefined);
});

test("does not include an untouched row changed by another browser", () => {
  const original = [...members, { id: "member-2", name: "초밥", color: "#aabbcc", active: true, characters: [] }];
  const local = structuredClone(original);
  local[0].name = "김밥 변경";
  const changes = buildBoardChanges(
    { members: original, catalog, schedule },
    { members: local, catalog, schedule },
    new Set(["members"]),
  );
  assert.deepEqual(changes.members.upsert.map((row) => row.id), ["member-1"]);
});

test("loads normalized tables and limits weekly rows to the visible range", async () => {
  const tables = [];
  const ranges = [];
  const resultByTable = {
    raid_members: { data: membersToRows(members), error: null },
    raid_characters: { data: charactersToRows(members), error: null },
    raid_catalog: { data: catalogToRows(catalog), error: null },
    raid_board_weeks: { data: weeksToRows(schedule), error: null },
  };
  const supabase = { from(table) {
    tables.push(table);
    const query = {
      select: () => query,
      order: () => Promise.resolve(resultByTable[table]),
      gte: (_column, value) => { ranges.push(["gte", value]); return query; },
      lte: (_column, value) => { ranges.push(["lte", value]); return query; },
    };
    return query;
  } };
  const loaded = await loadCloudBoard(supabase, { earliestWeekStart: "2026-07-15", latestWeekStart: "2026-08-19" });
  assert.deepEqual(tables, ["raid_members", "raid_characters", "raid_catalog", "raid_board_weeks"]);
  assert.deepEqual(ranges, [["gte", "2026-07-15"], ["lte", "2026-08-19"]]);
  assert.deepEqual(loaded.schedule, schedule);
});

test("saves all row changes through one RPC call", async () => {
  const calls = [];
  const supabase = { rpc: async (name, payload) => { calls.push([name, payload]); return { error: null }; } };
  const changes = { weeks: { upsert: weeksToRows(schedule), delete: [] } };
  await saveCloudBoardChanges(supabase, changes);
  assert.deepEqual(calls, [["save_raid_board_changes", { p_changes: changes }]]);
});
