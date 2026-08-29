"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function createClient() {
  const config = getSupabaseConfig();
  return config
    ? createBrowserClient(config.url, config.publishableKey)
    : null;
}
