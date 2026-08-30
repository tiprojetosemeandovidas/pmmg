import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ questionCount: z.number().int().min(5).max(100).default(10), examId: z.string().uuid().nullable().default(null) });

export async function POST(request: Request) {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Diagnóstico indisponível." }, { status: 503 });
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Entre para iniciar o diagnóstico." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Configuração de diagnóstico inválida." }, { status: 422 });
  const { data: current } = await admin.from("diagnostic_sessions").select("id,status,question_count,answered_count,started_at").eq("user_id", auth.user.id).eq("status", "in_progress").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (current) return NextResponse.json({ data: current });
  const { data, error } = await admin.from("diagnostic_sessions").insert({ user_id: auth.user.id, exam_id: parsed.data.examId, question_count: parsed.data.questionCount }).select("id,status,question_count,answered_count,started_at").single();
  if (error || !data) return NextResponse.json({ error: "Não foi possível iniciar o diagnóstico." }, { status: 500 });
  await admin.from("pilot_events").upsert({ user_id: auth.user.id, event_type: "diagnostic_started", event_key: `diagnostic:${data.id}`, metadata: { target: data.question_count } }, { onConflict: "user_id,event_key", ignoreDuplicates: true });
  return NextResponse.json({ data }, { status: 201 });
}
