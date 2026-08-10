import assert from "node:assert/strict";
import test from "node:test";
import { isCloudAccessAllowed } from "../src/cloudStorage.js";

test("blocks the shared database from local and development previews", () => {
  assert.equal(isCloudAccessAllowed({ isDev: true, hostname: "loa-raid-board.derod82.chatgpt.site" }), false);
  assert.equal(isCloudAccessAllowed({ isDev: false, hostname: "localhost" }), false);
  assert.equal(isCloudAccessAllowed({ isDev: false, hostname: "127.0.0.1" }), false);
  assert.equal(isCloudAccessAllowed({ isDev: false, hostname: "terminal.local" }), false);
});

test("allows the shared database only for the published site", () => {
  assert.equal(isCloudAccessAllowed({ isDev: false, hostname: "loa-raid-board.derod82.chatgpt.site" }), true);
});
