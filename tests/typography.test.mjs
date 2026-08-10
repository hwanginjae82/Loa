import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

test("keeps the raid schedule readable at desktop and mobile sizes", () => {
  assert.match(styles, /:root\s*\{[^}]*font-size:\s*16px/);
  assert.match(styles, /\.slot\s*\{[^}]*font-size:\s*14px/);
  assert.match(styles, /\.role-labels span\s*\{[^}]*font-size:\s*12px/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*?\.slot\s*\{[^}]*font-size:\s*12px/);
  assert.match(styles, /\.member-profile span\s*\{[^}]*font-size:\s*12px/);
  assert.match(styles, /\.character-grid strong\s*\{[^}]*font-size:\s*13px/);
  assert.match(styles, /\.personal-week section strong\s*\{[^}]*font-size:\s*12px/);
  assert.match(styles, /\.personal-week section span\s*\{[^}]*font-size:\s*12px/);
});
