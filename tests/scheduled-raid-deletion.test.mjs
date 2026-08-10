import assert from "node:assert/strict";
import test from "node:test";
import { canDeleteScheduledRaid, removeScheduledRaid } from "../src/scheduledRaidDeletion.js";

const now = new Date("2026-08-12T11:00:00.000Z");

test("allows deletion before a scheduled raid begins", () => {
  assert.equal(canDeleteScheduledRaid({ startsAt: "2026-08-12T12:30:00.000Z" }, now), true);
  assert.equal(canDeleteScheduledRaid({ startsAt: null }, now), true);
});

test("blocks deletion after a scheduled raid begins", () => {
  assert.equal(canDeleteScheduledRaid({ startsAt: "2026-08-12T10:59:00.000Z" }, now), false);
});

test("removes only an unstarted scheduled raid", () => {
  const raids = [
    { id: 1, startsAt: "2026-08-12T12:30:00.000Z" },
    { id: 2, startsAt: "2026-08-12T10:59:00.000Z" },
  ];

  assert.deepEqual(removeScheduledRaid(raids, 1, now), [raids[1]]);
  assert.throws(() => removeScheduledRaid(raids, 2, now), /already started/);
});
