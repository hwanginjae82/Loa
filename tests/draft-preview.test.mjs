import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("offers save and cancel controls without connecting to Supabase", async () => {
  const preview = await readFile(new URL("../public/draft-preview.html", import.meta.url), "utf8");

  assert.match(preview, /id="save"/);
  assert.match(preview, /id="cancel"/);
  assert.match(preview, /id="edit"/);
  assert.doesNotMatch(preview, /supabase/i);
});
