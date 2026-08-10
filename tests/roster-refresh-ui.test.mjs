import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("does not save a refreshed roster until every assigned character is selected", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

  assert.match(app, /import \{ migrateRosterSchedule \} from "\.\/rosterRefreshMigration\.js"/);
  assert.match(app, /missingAssignedNames/);
  assert.match(app, /setMessage\(`일정에 사용 중인 \$\{missing\.join\(", "\)\} 캐릭터도 선택해주세요\.`\)/);
  assert.match(app, /setSchedule\(migration\.schedule\)/);
});
