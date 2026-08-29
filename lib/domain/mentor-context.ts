import { getViewModel } from "@/lib/domain/adaptive-engine";
import type { RotaState } from "@/lib/domain/rota";
import type { MentorAnswer, MentorSource } from "@/lib/mentor/types";

type ValidatedNotice = { original_filename: string; structured_data: Record<string, unknown> };
type PhysicalContext = { goals: unknown[]; results: unknown[] };
type ApprovedQuestion = { id: string; subject: string; topic: string | null; statement: string; explanation: string | null; source_type: string; question_source_links?: unknown[] };

export function buildMentorSources(state: RotaState, notices: ValidatedNotice[], physical?: PhysicalContext, questions: ApprovedQuestion[] = []): MentorSource[] {
  const view = getViewModel(state);
  const planned = state.plan.filter((task) => task.status === "planned").slice(0, 6);
  const pendingReviews = state.reviewQueue.filter((item) => item.status === "pending").slice(0, 8);
  const sources: MentorSource[] = [
    {
      id: "plan-current",
      label: "Plano adaptativo atual",
      type: "plan",
      content: JSON.stringify({ mode: state.profile.mode, weeklyHours: state.profile.weeklyHours, nextAction: view.nextAction, tasks: planned }),
    },
    {
      id: "performance-current",
      label: "Desempenho e prioridades",
      type: "performance",
      content: JSON.stringify({ rotaScore: view.rotaScore, accuracy: view.accuracy, totalAnswers: view.totalAnswers, priorities: view.priorities.slice(0, 5), stats: state.stats }),
    },
    {
      id: "review-current",
      label: "Fila de revisão",
      type: "review",
      content: JSON.stringify({ pendingCount: state.reviewQueue.filter((item) => item.status === "pending").length, items: pendingReviews }),
    },
  ];
  notices.slice(0, 3).forEach((notice, index) => sources.push({
    id: `notice-${index + 1}`,
    label: `Edital validado: ${notice.original_filename.slice(0, 100)}`,
    type: "notice",
    content: JSON.stringify(notice.structured_data).slice(0, 12_000),
  }));
  if (physical && (physical.goals.length || physical.results.length)) sources.push({
    id: "physical-current",
    label: "Preparação física registrada",
    type: "physical",
    content: JSON.stringify({ goals: physical.goals.slice(0, 8), recentResults: physical.results.slice(0, 12) }).slice(0, 8_000),
  });
  const relevantSubjects = new Set(view.priorities.map((item) => item.subject));
  const relevantQuestions = questions.filter((item) => relevantSubjects.has(item.subject)).slice(0, 10);
  if (relevantQuestions.length) sources.push({
    id: "question-bank-current",
    label: "Banco de questões validado",
    type: "question_bank",
    content: JSON.stringify(relevantQuestions).slice(0, 16_000),
  });
  return sources;
}

export function deterministicMentorAnswer(state: RotaState, question: string): MentorAnswer {
  const view = getViewModel(state);
  const pending = state.reviewQueue.filter((item) => item.status === "pending").length;
  const asksAboutReview = /revis|erro|errei/i.test(question);
  return {
    answer: asksAboutReview && pending
      ? `Você tem ${pending} revisão(ões) pendente(s). Comece pela mais antiga e depois retome ${view.nextAction.subject}: ${view.nextAction.topic}.`
      : `Sua próxima ação recomendada é ${view.nextAction.subject}: ${view.nextAction.topic}, por ${view.nextAction.minutes} minutos. Ela está no topo porque combina prioridade ${view.nextAction.priority}/100 com as evidências atuais da sua rota.`,
    actions: [{ title: asksAboutReview ? "Abrir revisões" : "Abrir meu plano", reason: "Executar a próxima ação já priorizada pelo motor adaptativo.", path: asksAboutReview ? "/app/revisoes" : "/app/plano" }],
    citations: [{ sourceId: asksAboutReview ? "review-current" : "plan-current", claim: "Recomendação calculada a partir do estado atual do candidato." }],
    confidence: state.answers.length >= 10 ? "high" : state.answers.length >= 3 ? "medium" : "low",
    caveats: state.answers.length < 10 ? ["Ainda há pouca evidência; conclua o diagnóstico para melhorar a personalização."] : [],
  };
}
