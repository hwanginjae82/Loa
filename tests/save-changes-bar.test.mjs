import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines a reusable save and cancel bar for unsaved edits", async () => {
  const component = await readFile(new URL("../src/SaveChangesBar.jsx", import.meta.url), "utf8");

  assert.match(component, /if \(!isDirty\) return null/);
  assert.match(component, /onClick=\{onCancel\}/);
  assert.match(component, /onClick=\{onSave\}/);
  assert.match(component, /공용 일정에 저장/);
});
