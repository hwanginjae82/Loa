import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("shows deletion only for raids that have not started", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

  assert.match(app, /import \{ canDeleteScheduledRaid, removeScheduledRaid \} from "\.\/scheduledRaidDeletion\.js"/);
  assert.match(app, /const deleteRaid = \(raidId\) =>/);
  assert.match(app, /canDelete=\{canDeleteScheduledRaid\(instance\)\}/);
  assert.match(app, /onDelete=\{\(\) => deleteRaid\(instance\.id\)\}/);
});
