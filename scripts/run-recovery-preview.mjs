import fs from "node:fs";
import { recoverLegacySchedule } from "./recover-legacy-schedule.mjs";

const [backupPath, previewPath] = process.argv.slice(2);
if (!backupPath || !previewPath) {
  throw new Error("Usage: node scripts/run-recovery-preview.mjs <backup.json> <preview.json>");
}

const row = JSON.parse(fs.readFileSync(backupPath, "utf8").replace(/^\uFEFF/, ""));
const prefixToMemberName = {
  s: "스카치",
  j: "자쿠",
  a: "아쀼님",
  k: "김밥",
  m: "모카",
  h: "헤헤",
  n: "범이",
  b: "반야",
};
const result = recoverLegacySchedule({
  schedule: row.schedule,
  members: row.members,
  prefixToMemberName,
});
const characterIds = new Set(
  row.members.flatMap((member) => member.characters.map((character) => character.id)),
);
const scheduled = Object.values(result.schedule.weeks ?? {})
  .flatMap((week) => Object.values(week.raids ?? {}))
  .flatMap((raids) => raids)
  .flatMap((raid) => raid.characterIds ?? [])
  .filter(Boolean);
const stillMissing = [...new Set(scheduled.filter((id) => !characterIds.has(id)))].sort();
const preview = {
  ...row,
  schedule: result.schedule,
  recovery: { mappings: result.mappings, unresolved: result.unresolved, stillMissing },
};

fs.writeFileSync(previewPath, JSON.stringify(preview, null, 2));
console.log(JSON.stringify({
  previewPath,
  mappingCount: result.mappings.length,
  unresolved: result.unresolved,
  stillMissing,
  scheduledSlotCount: scheduled.length,
  mappings: result.mappings,
}, null, 2));
