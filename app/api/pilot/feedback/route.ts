import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ stage: z.enum(["onboarding", "week_one", "final"]), easeScore: z.number().int().min(1).max(5), valueScore: z.number().int().min(1).max(5), recommendationScore: z.number().int().min(0).max(10), comment: z.string().trim().max(2000).default("") });

export async function POST(request: Request) {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Feedback indisponível." }, { status: 503 });
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Entre para enviar o feedback." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Preencha as três notas do feedback." }, { status: 422 });
  const { data: participant } = await admin.from("pilot_participants").select("cohort_id").eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
  if (!participant) return NextResponse.json({ error: "Participação ativa não encontrada." }, { status: 403 });
  const { error } = await admin.from("pilot_feedback").upsert({ cohort_id: participant.cohort_id, user_id: auth.user.id, stage: parsed.data.stage, ease_score: parsed.data.easeScore, value_score: parsed.data.valueScore, recommendation_score: parsed.data.recommendationScore, comment: parsed.data.comment || null }, { onConflict: "cohort_id,user_id,stage" });
  if (error) return NextResponse.json({ error: "Não foi possível salvar o feedback." }, { status: 500 });
  await admin.from("pilot_events").upsert({ user_id: auth.user.id, event_type: "feedback_submitted", event_key: `feedback:${participant.cohort_id}:${parsed.data.stage}`, metadata: { stage: parsed.data.stage } }, { onConflict: "user_id,event_key", ignoreDuplicates: true });
  return NextResponse.json({ ok: true }, { status: 201 });
}
