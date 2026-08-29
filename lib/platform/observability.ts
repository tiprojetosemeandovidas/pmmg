import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function requestId(request?: Request) {
  const incoming = request?.headers.get("x-request-id")?.trim();
  return incoming && /^[a-zA-Z0-9._-]{8,80}$/.test(incoming) ? incoming : randomUUID();
}

export async function recordOperationalEvent(admin: SupabaseClient | null, event: {
  requestId: string;
  route: string;
  eventType: string;
  statusCode: number;
  durationMs: number;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!admin) return;
  await admin.from("operational_events").insert({
    request_id: event.requestId,
    route: event.route,
    event_type: event.eventType,
    status_code: event.statusCode,
    duration_ms: event.durationMs,
    actor_user_id: event.userId ?? null,
    metadata: event.metadata ?? {},
  }).then(() => undefined);
}
