import assert from "node:assert/strict";
import test from "node:test";
import { migrateRosterSchedule } from "../src/rosterRefreshMigration.js";

test("stores the stable character name when roster IDs change", () => {
  const result = migrateRosterSchedule({
    previousCharacters: [{ id: "old-a", name: "지존캐릭" }],
    refreshedCharacters: [{ id: "new-a", name: "지존캐릭" }],
    schedule: { wed: [{ id: 1, characterIds: ["old-a", null] }] },
  });

  assert.deepEqual(result.missingAssignedNames, []);
  assert.deepEqual(result.schedule.wed[0].characterIds, ["지존캐릭", null]);
});

test("keeps a schedule that already stores character names", () => {
  const result = migrateRosterSchedule({
    previousCharacters: [{ id: "old-a", name: "지존홀리" }],
    refreshedCharacters: [{ id: "new-a", name: "지존홀리" }],
    schedule: { wed: [{ id: 1, characterIds: ["지존홀리", null] }] },
  });

  assert.deepEqual(result.missingAssignedNames, []);
  assert.deepEqual(result.schedule.wed[0].characterIds, ["지존홀리", null]);
});

test("stops the refresh if a scheduled character was not selected", () => {
  const schedule = { wed: [{ id: 1, characterIds: ["old-a"] }] };
  const result = migrateRosterSchedule({
    previousCharacters: [{ id: "old-a", name: "지존캐릭" }],
    refreshedCharacters: [{ id: "new-b", name: "다른캐릭" }],
    schedule,
  });

  assert.deepEqual(result.missingAssignedNames, ["지존캐릭"]);
  assert.equal(result.schedule, schedule);
});
