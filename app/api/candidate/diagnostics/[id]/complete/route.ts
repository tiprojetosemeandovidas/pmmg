import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Diagnóstico inválido." }, { status: 422 });
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Diagnóstico indisponível." }, { status: 503 });
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Entre para concluir o diagnóstico." }, { status: 401 });
  const { data: diagnostic } = await admin.from("diagnostic_sessions").select("id,question_count,answered_count,correct_count,status").eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (!diagnostic) return NextResponse.json({ error: "Diagnóstico não encontrado." }, { status: 404 });
  if (diagnostic.status === "completed") return NextResponse.json({ data: diagnostic });
  if (diagnostic.answered_count < diagnostic.question_count) return NextResponse.json({ error: `Ainda faltam ${diagnostic.question_count - diagnostic.answered_count} respostas.` }, { status: 409 });
  const result = { score: Math.round(diagnostic.correct_count * 10_000 / diagnostic.answered_count) / 100, answeredCount: diagnostic.answered_count, correctCount: diagnostic.correct_count, modelVersion: "candidate-v1" };
  const completedAt = new Date().toISOString();
  const { data, error } = await admin.from("diagnostic_sessions").update({ status: "completed", result, completed_at: completedAt, updated_at: completedAt }).eq("id", id).eq("user_id", auth.user.id).select("id,status,result,completed_at").single();
  if (error || !data) return NextResponse.json({ error: "Não foi possível concluir o diagnóstico." }, { status: 500 });
  await admin.from("pilot_events").upsert({ user_id: auth.user.id, event_type: "diagnostic_completed", event_key: `diagnostic-completed:${id}`, metadata: { answered: diagnostic.answered_count, score: result.score } }, { onConflict: "user_id,event_key", ignoreDuplicates: true });
  return NextResponse.json({ data });
}
