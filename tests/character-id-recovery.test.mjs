import test from "node:test";
import assert from "node:assert/strict";

import { recoverLegacySchedule } from "../scripts/recover-legacy-schedule.mjs";

const members = [
  {
    id: "guild-5",
    name: "스카치",
    characters: [
      { id: "카마인:첫째", name: "첫째" },
      { id: "카마인:둘째", name: "둘째" },
    ],
  },
];

const schedule = {
  version: 2,
  weeks: {
    "2026-08-12": {
      raids: {
        wed: [
          {
            id: 101,
            catalogId: "jongmak-hard",
            startTime: "20:30",
            characterIds: ["s2", null],
          },
        ],
      },
      unavailableByMember: {},
    },
  },
};

test("예전 ID를 같은 멤버의 현재 캐릭터 순번으로 복구한다", () => {
  const result = recoverLegacySchedule({
    schedule,
    members,
    prefixToMemberName: { s: "스카치" },
  });

  assert.deepEqual(result.unresolved, []);
  assert.deepEqual(result.mappings, [{ oldId: "s2", newId: "카마인:둘째" }]);
  assert.deepEqual(
    result.schedule.weeks["2026-08-12"].raids.wed[0].characterIds,
    ["카마인:둘째", null],
  );
  assert.equal(result.schedule.weeks["2026-08-12"].raids.wed[0].startTime, "20:30");
  assert.deepEqual(schedule.weeks["2026-08-12"].raids.wed[0].characterIds, ["s2", null]);
});

test("알 수 없는 접두사와 없는 순번을 미해결로 보고한다", () => {
  const result = recoverLegacySchedule({
    schedule: {
      version: 2,
      weeks: {
        "2026-08-12": {
          raids: { wed: [{ id: 1, characterIds: ["x1", "s9"] }] },
        },
      },
    },
    members,
    prefixToMemberName: { s: "스카치" },
  });

  assert.deepEqual(result.unresolved, ["s9", "x1"]);
});
