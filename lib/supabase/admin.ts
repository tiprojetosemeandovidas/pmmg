import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
  url: z.string().url(),
  serviceRoleKey: z.string().min(20),
});

export function createAdminClient() {
  const parsed = schema.safeParse({
    url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) return null;
  return createClient(parsed.data.url, parsed.data.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
