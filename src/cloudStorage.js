import { createClient } from "@supabase/supabase-js";

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "terminal.local"]);

export function isCloudAccessAllowed({ isDev, hostname } = {}) {
  return !isDev && !localHosts.has(String(hostname ?? "").toLowerCase());
}

const environment = import.meta.env ?? {};
const cloudAccessAllowed = isCloudAccessAllowed({
  isDev: environment.DEV,
  hostname: globalThis.location?.hostname,
});
const supabaseUrl = environment.VITE_SUPABASE_URL;
const supabasePublishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = cloudAccessAllowed && supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;

