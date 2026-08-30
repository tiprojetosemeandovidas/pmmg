import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Revisões indisponíveis." }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Entre para ver suas revisões." }, { status: 401 });
  const { data, error } = await supabase
    .from("review_queue")
    .select("id,question_id,interval_step,due_at,status,questions(statement,subject,topic,options)")
    .eq("user_id", auth.user.id)
    .eq("status", "scheduled")
    .order("due_at", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ error: "Não foi possível carregar as revisões." }, { status: 500 });
  return NextResponse.json({ data: (data ?? []).map((item) => {
    const question = Array.isArray(item.questions) ? item.questions[0] : item.questions;
    return { id: item.id, questionId: item.question_id, intervalStep: item.interval_step, dueAt: item.due_at,
      statement: question?.statement ?? "Questão indisponível", subject: question?.subject ?? "", topic: question?.topic ?? "",
      options: Array.isArray(question?.options) ? question.options : [],
      due: new Date(item.due_at) <= new Date() };
  }) });
}
