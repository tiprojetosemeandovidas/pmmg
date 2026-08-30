import { NextResponse } from "next/server";
import type { RotaState } from "@/lib/domain/rota";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return NextResponse.json({ error: "Alertas indisponíveis." }, { status: 503 });
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return NextResponse.json({ data: [] });
  const now = new Date().toISOString();
  const [{ count: dueReviews }, { data: snapshot }, { data: track }] = await Promise.all([
    admin.from("review_queue").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id).eq("status", "scheduled").lte("due_at", now),
    admin.from("candidate_states").select("state").eq("user_id", auth.user.id).maybeSingle(),
    admin.from("career_tracks").select("exam_date,secondary_exam_date").eq("code", "enem-2026").maybeSingle(),
  ]);
  const state = snapshot?.state as RotaState | undefined;
  const alerts: Array<{ id: string; level: "info" | "attention"; title: string; message: string; href: string }> = [];
  if (dueReviews) alerts.push({ id: "reviews-due", level: "attention", title: `${dueReviews} revisão${dueReviews > 1 ? "ões" : ""} disponível${dueReviews > 1 ? "is" : ""}`, message: "Reforce agora os conteúdos que você errou.", href: "/app/revisoes" });
  if (state?.profile.onboardingCompleted && state.diagnostic.active) alerts.push({ id: "diagnostic-open", level: "attention", title: "Diagnóstico em andamento", message: `Faltam ${Math.max(0, state.diagnostic.target - state.diagnostic.answered)} questões para calibrar sua rota.`, href: "/app/questoes" });
  const planned = state?.plan.filter((task) => task.status === "planned" && task.scheduledFor <= now.slice(0, 10)).length ?? 0;
  if (planned) alerts.push({ id: "tasks-due", level: "info", title: `${planned} atividade${planned > 1 ? "s" : ""} no plano`, message: "Mantenha a consistência da semana.", href: "/app/plano" });
  if (track?.exam_date) {
    const days = Math.ceil((new Date(`${track.exam_date}T12:00:00-03:00`).getTime() - Date.now()) / 86_400_000);
    if (days >= 0) alerts.push({ id: "exam-countdown", level: "info", title: `ENEM em ${days} dias`, message: track.secondary_exam_date ? `Primeiro dia ${new Intl.DateTimeFormat("pt-BR").format(new Date(`${track.exam_date}T12:00:00-03:00`))}; segundo dia ${new Intl.DateTimeFormat("pt-BR").format(new Date(`${track.secondary_exam_date}T12:00:00-03:00`))}.` : "Confira seu plano até a prova.", href: "/app/plano" });
  }
  return NextResponse.json({ data: alerts });
}
