import assert from "node:assert/strict";
import test from "node:test";
import { isCloudAccessAllowed } from "../src/cloudStorage.js";

const developmentUrl = "https://suqaaebnhcakpuctjmeq.supabase.co";
const productionUrl = "https://srdooyseixgxljsdmecc.supabase.co";

test("allows only the Dev DB from local and development previews", () => {
  assert.equal(isCloudAccessAllowed({ isDev: true, hostname: "localhost", supabaseUrl: developmentUrl }), true);
  assert.equal(isCloudAccessAllowed({ isDev: false, hostname: "127.0.0.1", supabaseUrl: developmentUrl }), true);
  assert.equal(isCloudAccessAllowed({ isDev: true, hostname: "localhost", supabaseUrl: productionUrl }), false);
  assert.equal(isCloudAccessAllowed({ isDev: false, hostname: "terminal.local", supabaseUrl: productionUrl }), false);
});

test("allows only the production DB from the published site", () => {
  assert.equal(isCloudAccessAllowed({ isDev: false, hostname: "loa-raid-board.derod82.chatgpt.site", supabaseUrl: productionUrl }), true);
  assert.equal(isCloudAccessAllowed({ isDev: false, hostname: "loa-raid-board.derod82.chatgpt.site", supabaseUrl: developmentUrl }), false);
});
