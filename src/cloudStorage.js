import { createClient } from "@supabase/supabase-js";

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "terminal.local"]);
const developmentProjectRef = "suqaaebnhcakpuctjmeq";
const productionProjectRef = "srdooyseixgxljsdmecc";

const projectRefFromUrl = (url) => String(url ?? "").match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)?.[1] ?? "";

export function isCloudAccessAllowed({ isDev, hostname, supabaseUrl } = {}) {
  const isLocal = localHosts.has(String(hostname ?? "").toLowerCase());
  const projectRef = projectRefFromUrl(supabaseUrl);
  return isDev || isLocal ? projectRef === developmentProjectRef : projectRef === productionProjectRef;
}

const environment = import.meta.env ?? {};
const supabaseUrl = environment.VITE_SUPABASE_URL;
const supabasePublishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY;
const cloudAccessAllowed = isCloudAccessAllowed({
  isDev: environment.DEV,
  hostname: globalThis.location?.hostname,
  supabaseUrl,
});

export const supabase = cloudAccessAllowed && supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;

