import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("connects the save bar to editable board state", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

  assert.match(app, /import \{ SaveChangesBar \} from "\.\/SaveChangesBar\.jsx"/);
  assert.match(app, /const \[isDirty, setIsDirty\] = useState\(false\)/);
  assert.match(app, /<SaveChangesBar isDirty=\{isDirty\}/);
  assert.match(app, /onCancel=\{cancelChanges\}/);
  assert.match(app, /onSave=\{saveChanges\}/);
});
