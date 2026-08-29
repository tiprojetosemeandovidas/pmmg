import type { RotaState } from "@/lib/domain/rota";
import type { Achievement, GamificationSnapshot, Mission } from "@/lib/progress/types";

const DAY = 86_400_000;

export function calculateGamification(state: RotaState, physicalResultCount = 0, now = new Date()): GamificationSnapshot {
  const weekStart = new Date(now.getTime() - 6 * DAY);
  const recentAnswers = state.answers.filter((answer) => new Date(answer.answeredAt) >= weekStart).length;
  const recentActivity = (state.activityLog ?? []).filter((event) => new Date(event.occurredAt) >= weekStart);
  const completedPlan = recentActivity.length
    ? recentActivity.filter((event) => event.type === "study_session").length
    : state.plan.filter((task) => task.status === "completed").length;
  const weeklyClosed = recentActivity.some((event) => event.type === "weekly_checkin");
  const sessionTarget = Math.max(1, Math.min(3, state.plan.length));
  const missions: Mission[] = [
    { code: "steady_sessions", title: "Constância antes de intensidade", description: `Conclua ${sessionTarget} sessões planejadas, sem aumentar sua carga.`, progress: Math.min(completedPlan, sessionTarget), target: sessionTarget, completed: completedPlan >= sessionTarget, xp: 30 },
    { code: "evidence_week", title: "Aprender com evidências", description: "Responda 10 questões ao longo da semana.", progress: Math.min(recentAnswers, 10), target: 10, completed: recentAnswers >= 10, xp: 25 },
    { code: "weekly_close", title: "Fechar para recalibrar", description: "Faça um fechamento semanal da sua rota.", progress: weeklyClosed ? 1 : 0, target: 1, completed: weeklyClosed, xp: 35 },
  ];
  const definitions: Array<Omit<Achievement, "earned"> & { earned: boolean }> = [
    { code: "route_created", title: "Rota criada", description: "Concluiu o onboarding adaptativo.", icon: "◇", earned: state.profile.onboardingCompleted },
    { code: "first_session", title: "Primeiro passo", description: "Concluiu a primeira sessão planejada.", icon: "✓", earned: state.stats.completedSessions >= 1 },
    { code: "diagnostic_complete", title: "Ponto de partida", description: "Concluiu o diagnóstico inicial.", icon: "◎", earned: Boolean(state.diagnostic.completedAt) },
    { code: "streak_3", title: "Ritmo sustentável", description: "Estudou em três dias consecutivos.", icon: "↗", earned: state.stats.streak >= 3 },
    { code: "weekly_review", title: "Ciclo fechado", description: "Concluiu o primeiro fechamento semanal.", icon: "↻", earned: state.stats.weeklyCheckins >= 1 },
    { code: "study_300", title: "Base construída", description: "Acumulou 300 minutos de sessões concluídas.", icon: "▤", earned: state.stats.completedMinutes >= 300 },
    { code: "taf_started", title: "Preparação integral", description: "Registrou a primeira medição física.", icon: "⚑", earned: physicalResultCount >= 1 },
  ];
  return { missions, achievements: definitions, completedMissions: missions.filter((mission) => mission.completed).length };
}
