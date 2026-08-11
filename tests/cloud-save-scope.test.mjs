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

test("saves only explicitly edited state fields in one database update", () => {
  assert.match(app, /dirtyFieldsRef\.current\.add\("members"\)/);
  assert.match(app, /dirtyFieldsRef\.current\.add\("catalog"\)/);
  assert.match(app, /dirtyFieldsRef\.current\.add\("schedule"\)/);
  assert.match(app, /const changedFields = \[\.\.\.dirtyFieldsRef\.current\]/);
  assert.match(app, /\.update\(\{ \.\.\.changedState, updated_at:/);
  assert.doesNotMatch(app, /Promise\.all\(changedFields\.map/);
});

test("does not expose the empty fallback board before cloud data is loaded", () => {
  assert.match(app, /const \[cloudLoaded, setCloudLoaded\] = useState\(!supabase\)/);
  assert.match(app, /!cloudLoaded \? <section className="info-banner">/);
  assert.match(app, /setCloudLoaded\(true\)/);
});
