import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("keeps tab views mounted while switching between them", () => {
  assert.match(app, /className="tab-panel" hidden=\{activeTab !== "schedule"\}/);
  assert.match(app, /className="tab-panel" hidden=\{activeTab !== "personal"\}/);
  assert.match(app, /className="tab-panel" hidden=\{activeTab !== "members"\}/);
  assert.match(app, /className="tab-panel" hidden=\{activeTab !== "raids"\}/);
  assert.doesNotMatch(app, /activeTab === "schedule" && <ScheduleView/);
});

test("shows extra participation characters below the weekly raid schedule", () => {
  const scheduleIndex = app.indexOf('<div className="content-grid">');
  const extraParticipantsIndex = app.indexOf('<section className="weekly-extra-participants">');

  assert.ok(scheduleIndex >= 0);
  assert.ok(extraParticipantsIndex > scheduleIndex);
});
