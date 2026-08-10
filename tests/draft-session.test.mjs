import assert from "node:assert/strict";
import test from "node:test";
import { beginDraft, cancelDraft, saveDraft, updateDraft } from "../src/draftSession.js";

test("keeps edits local until the user confirms save", () => {
  const saved = { members: ["A"], schedule: { wed: [] } };
  const session = updateDraft(beginDraft(saved), { members: ["A", "B"], schedule: { wed: [] } });

  assert.deepEqual(session.saved, saved);
  assert.deepEqual(session.draft.members, ["A", "B"]);
  assert.equal(session.isDirty, true);
});

test("cancelling restores the last confirmed state", () => {
  const saved = { members: ["A"], schedule: { wed: [] } };
  const changed = updateDraft(beginDraft(saved), { members: ["A", "B"], schedule: { wed: [] } });

  assert.deepEqual(cancelDraft(changed), { saved, draft: saved, isDirty: false });
});

test("saving makes the draft the next confirmed state", () => {
  const saved = { members: ["A"], schedule: { wed: [] } };
  const draft = { members: ["A", "B"], schedule: { wed: [1] } };

  assert.deepEqual(saveDraft(updateDraft(beginDraft(saved), draft)), { saved: draft, draft, isDirty: false });
});
