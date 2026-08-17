import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyScheduleData,
  normalizeMembers,
  normalizeScheduleData,
  sortRaidCatalog,
} from "../src/boardModel.js";

test("uses an empty board when the database has no schedule", () => {
  assert.deepEqual(normalizeScheduleData(null, []), emptyScheduleData());
});

test("normalizes schedule references to stable character names", () => {
  const members = [{
    id: "member-1",
    characters: [{ id: "카마인:캐릭터명", name: "캐릭터명" }],
  }];
  const schedule = {
    version: 2,
    weeks: {
      "2026-08-12": {
        raids: { wed: [{ id: 1, characterIds: ["카마인:캐릭터명"] }] },
        unavailableByMember: {},
      },
    },
  };

  const normalized = normalizeScheduleData(schedule, members);
  assert.equal(normalized.weeks["2026-08-12"].raids.wed[0].characterIds[0], "캐릭터명");
});

test("applies display defaults without replacing member data", () => {
  const members = normalizeMembers([{ id: "member-1", characters: [
    { id: "one", name: "첫째" },
    { id: "two", name: "둘째", earnsGold: false },
  ] }]);

  assert.equal(members[0].characters[0].earnsGold, true);
  assert.equal(members[0].characters[1].earnsGold, false);
  assert.ok(members[0].color);
});

test("sorts raid difficulties in normal, hard, nightmare order", () => {
  const sorted = sortRaidCatalog([
    { id: "nightmare", name: "세르카", difficulty: "나메" },
    { id: "normal", name: "세르카", difficulty: "노말" },
    { id: "hard", name: "세르카", difficulty: "하드" },
  ]);

  assert.deepEqual(sorted.map((raid) => raid.id), ["normal", "hard", "nightmare"]);
});

test("normalizes catalog references to stable text keys", () => {
  const members = [];
  const normalized = normalizeScheduleData({ version: 2, weeks: {
    "2026-08-12": { raids: { wed: [{ id: 1, catalogId: 42, characterIds: [] }] }, unavailableByMember: {} },
  } }, members);
  assert.equal(normalized.weeks["2026-08-12"].raids.wed[0].catalogId, "42");
});
