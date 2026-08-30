import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const answerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOption: z.number().int().min(0).max(25),
  idempotencyKey: z.string().uuid(),
  responseTimeMs: z.number().int().min(0).max(3_600_000).nullable().optional(),
  diagnosticSessionId: z.string().uuid().nullable().optional(),
  reviewId: z.string().uuid().nullable().optional(),
});

function clamp(value: number, maximum = 100) { return Math.max(0, Math.min(maximum, value)); }

async function refreshRecommendations(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string) {
  const { data: rows } = await admin.from("topic_mastery")
    .select("topic_id,mastery_score,confidence,questions_answered,correct_answers,wrong_answers,topics(stable_code,name,subjects(name))")
    .eq("user_id", userId).gt("questions_answered", 0);
  if (!rows?.length) return;
  const ranked = rows.map((row) => {
    const mastery = Number(row.mastery_score) || 0;
    const confidence = Number(row.confidence) || 0;
    const answered = Number(row.questions_answered) || 0;
    const wrong = Number(row.wrong_answers) || 0;
    const factors = {
      masteryGap: Math.round((100 - mastery) * 55) / 100,
      uncertainty: Math.round((1 - confidence) * 1500) / 100,
      errorPressure: Math.round((answered ? wrong / answered : 1) * 2000) / 100,
      examRelevance: 5,
    };
    const priorityScore = clamp(Object.values(factors).reduce((sum, value) => sum + value, 0));
    const action = answered < 3 || mastery < 50 ? "learn" : wrong >= Number(row.correct_answers) || mastery < 75 ? "practice" : "review";
    const topic = Array.isArray(row.topics) ? row.topics[0] : row.topics;
    return { topicId: row.topic_id, examId: null, action, priorityScore, masteryScore: mastery, confidence, questionsAnswered: answered, factors,
      reasonCode: `adaptive_v1.${action}`, reason: `Domínio de ${Math.round(mastery)}%, confiança de ${Math.round(confidence * 100)}% e ${answered} resposta${answered === 1 ? "" : "s"} registrada${answered === 1 ? "" : "s"}.`,
      topicCode: topic?.stable_code ?? "", topic: topic?.name ?? "Tópico" };
  }).sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 7).map((item, index) => ({ ...item, rank: index + 1,
    evidence: { masteryScore: item.masteryScore, confidence: item.confidence, questionsAnswered: item.questionsAnswered } }));
  await admin.rpc("replace_adaptive_recommendations", { p_user_id: userId, p_items: ranked });
}

export async function POST(request: Request) {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Serviço de respostas indisponível." }, { status: 503 });
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Entre para registrar sua resposta." }, { status: 401 });
  const parsed = answerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Resposta inválida." }, { status: 422 });
  if (parsed.data.reviewId) {
    const { data: review } = await admin.from("review_queue").select("id,question_id").eq("id", parsed.data.reviewId).eq("user_id", auth.user.id).eq("status", "scheduled").maybeSingle();
    if (!review || review.question_id !== parsed.data.questionId) return NextResponse.json({ error: "Revisão indisponível." }, { status: 404 });
  }

  const { data, error } = await admin.rpc("record_question_answer", {
    p_user_id: auth.user.id,
    p_question_id: parsed.data.questionId,
    p_selected_option: parsed.data.selectedOption,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_response_time_ms: parsed.data.responseTimeMs ?? null,
    p_diagnostic_session_id: parsed.data.diagnosticSessionId ?? null,
  });
  if (error) {
    const known = error.message.includes("question_not_available") ? 404
      : error.message.includes("invalid_selected_option") ? 422
        : error.message.includes("idempotency_conflict") ? 409 : 500;
    return NextResponse.json({ error: known === 500 ? "Não foi possível registrar a resposta." : error.message }, { status: known });
  }
  const result = data?.[0];
  if (!result) return NextResponse.json({ error: "Resposta não confirmada." }, { status: 500 });
  if (parsed.data.reviewId && !result.correct) await admin.from("review_queue").delete().eq("user_id", auth.user.id).eq("source_answer_id", result.answer_id);
  await refreshRecommendations(admin, auth.user.id);
  await admin.from("pilot_events").upsert({
    user_id: auth.user.id,
    event_type: "question_answered",
    event_key: `answer:${result.answer_id}`,
    metadata: { correct: Boolean(result.correct), diagnostic: Boolean(parsed.data.diagnosticSessionId), review: Boolean(parsed.data.reviewId) },
  }, { onConflict: "user_id,event_key", ignoreDuplicates: true });
  return NextResponse.json({
    data: {
      answerId: result.answer_id,
      correct: result.correct,
      correctOption: result.correct_option,
      explanation: result.explanation,
      alreadyRecorded: result.already_recorded,
    },
  }, { status: result.already_recorded ? 200 : 201 });
}
