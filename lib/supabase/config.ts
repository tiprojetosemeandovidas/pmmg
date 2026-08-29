import { z } from "zod";

const supabaseConfigSchema = z.object({
  url: z.string().url(),
  publishableKey: z.string().min(10),
});

export type SupabaseConfig = z.infer<typeof supabaseConfigSchema>;

export function getSupabaseConfig(): SupabaseConfig | null {
  const parsed = supabaseConfigSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return parsed.success ? parsed.data : null;
}
