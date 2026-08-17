import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("does not keep a runtime seed schedule that can overwrite the cloud board", () => {
  assert.doesNotMatch(app, /const initialSchedule/);
  assert.doesNotMatch(app, /const initialMembers/);
  assert.doesNotMatch(app, /const initialCatalog/);
  assert.doesNotMatch(app, /id: 101, catalogId:/);
  assert.doesNotMatch(app, /\?\? initialGuildMembers/);
  assert.doesNotMatch(app, /\.upsert\(\{ id: "guild-main"/);
});

test("saves only explicitly edited state through the normalized repository", () => {
  assert.match(app, /markDirty\("members"\)/);
  assert.match(app, /markDirty\("catalog"\)/);
  assert.match(app, /markDirty\("schedule"\)/);
  assert.match(app, /dirtyBaseRef\.current\[field\] = savedStateRef\.current\[field\]/);
  assert.match(app, /buildBoardChanges\(changeBase, state, dirtyFieldsRef\.current\)/);
  assert.match(app, /saveCloudBoardChanges\(supabase, changes\)/);
  assert.match(app, /earliestWeekStart: earliestVisibleWeekStart/);
  assert.match(app, /latestWeekStart: latestVisibleWeekStart/);
  assert.doesNotMatch(app, /from\("raid_board_state"\)/);
});

test("does not expose the empty fallback board before cloud data is loaded", () => {
  assert.match(app, /const \[cloudLoaded, setCloudLoaded\] = useState\(!supabase\)/);
  assert.match(app, /!cloudLoaded \? <section className="info-banner">/);
  assert.match(app, /setCloudLoaded\(true\)/);
});

test("keeps unsaved fields when another browser publishes an update", () => {
  assert.match(app, /supabase\.channel\(`normalized-raid-board-\$\{crypto\.randomUUID\(\)\}`\)/);
  assert.match(app, /reloadCloudState\(true\)/);
  assert.match(app, /!preserveDirtyFields \|\| !dirtyFieldsRef\.current\.has\("members"\)/);
  assert.match(app, /!preserveDirtyFields \|\| !dirtyFieldsRef\.current\.has\("catalog"\)/);
  assert.match(app, /!preserveDirtyFields \|\| !dirtyFieldsRef\.current\.has\("schedule"\)/);
});
