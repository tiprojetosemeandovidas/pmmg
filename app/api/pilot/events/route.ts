import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const eventSchema = z.object({
  eventType: z.enum(["onboarding_completed", "diagnostic_started", "diagnostic_completed", "question_answered", "task_completed", "weekly_checkin_completed", "review_completed", "notification_opened", "pilot_joined", "feedback_submitted"]),
  eventKey: z.string().min(8).max(160),
  metadata: z.record(z.string(), z.union([z.string().max(120), z.number(), z.boolean(), z.null()])).default({}),
  occurredAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Telemetria indisponível." }, { status: 503 });
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sessão necessária." }, { status: 401 });
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Evento inválido." }, { status: 422 });
  const { error } = await admin.from("pilot_events").upsert({
    user_id: auth.user.id,
    event_type: parsed.data.eventType,
    event_key: parsed.data.eventKey,
    metadata: parsed.data.metadata,
    client_occurred_at: parsed.data.occurredAt ?? new Date().toISOString(),
  }, { onConflict: "user_id,event_key", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
