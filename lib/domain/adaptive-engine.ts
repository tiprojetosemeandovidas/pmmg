import type {
  ActivityEvent,
  JourneyMode,
  OnboardingInput,
  Priority,
  QuestionEvidence,
  RotaState,
  RotaViewModel,
  StudyTask,
  StudyTaskType,
  TopicDefinition,
  TopicMastery,
} from "@/lib/domain/rota";
import { CAREER_TRACKS } from "@/lib/opportunities/catalog";

const DAY = 86_400_000;

export const TOPICS: TopicDefinition[] = [
  { id: "LING.INTERPRETACAO", subject: "Linguagens", topic: "Interpretação textual", weight: 0.76, icon: "Aa" },
  { id: "RLM.PROPOSICOES", subject: "Raciocínio Lógico", topic: "Proposições", weight: 0.88, icon: "∑" },
  { id: "CONST.DIREITOS_FUNDAMENTAIS", subject: "Direito", topic: "Direitos fundamentais", weight: 1, icon: "⚖" },
  { id: "LEG.ETICA_DISCIPLINA", subject: "Legislação Policial", topic: "Ética e disciplina", weight: 0.82, icon: "◇" },
  { id: "GERAL.CIDADANIA", subject: "Conhecimentos Gerais", topic: "Cidadania e atualidades", weight: 0.64, icon: "◎" },
  { id: "RED.COMPETENCIAS", subject: "Redação", topic: "Texto dissertativo-argumentativo", weight: 1, icon: "✎" },
  { id: "MAT.PROBLEMAS", subject: "Matemática", topic: "Resolução de problemas", weight: 1, icon: "∑" },
  { id: "HUM.HISTORIA", subject: "Ciências Humanas", topic: "História e processos sociais", weight: 0.86, icon: "⌛" },
  { id: "HUM.GEOGRAFIA", subject: "Ciências Humanas", topic: "Geografia e espaço brasileiro", weight: 0.86, icon: "◉" },
  { id: "HUM.FILOSOFIA_SOCIOLOGIA", subject: "Ciências Humanas", topic: "Filosofia e sociologia", weight: 0.72, icon: "◇" },
  { id: "NAT.BIOLOGIA", subject: "Ciências da Natureza", topic: "Biologia", weight: 0.86, icon: "♧" },
  { id: "NAT.FISICA", subject: "Ciências da Natureza", topic: "Física", weight: 0.86, icon: "↯" },
  { id: "NAT.QUIMICA", subject: "Ciências da Natureza", topic: "Química", weight: 0.86, icon: "⚗" },
];

export function topicsForCareer(career: string) {
  const fallbackCareer = career === "undecided" ? "administrative" : career;
  const weights = CAREER_TRACKS.find((track) => track.code === fallbackCareer)?.topicWeights;
  const scoped = weights
    ? TOPICS.filter((topic) => (weights[topic.id] ?? 0) > 0).map((topic) => ({ ...topic, weight: weights[topic.id] }))
    : TOPICS.slice(0, 5);
  return scoped.length ? scoped : TOPICS.slice(0, 5);
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

function createMastery(topicId: string): TopicMastery {
  return {
    topicId,
    alpha: 2,
    beta: 2,
    score: 0.5,
    confidence: 0,
    evidenceCount: 0,
    correct: 0,
    wrong: 0,
    lastAnsweredAt: null,
    lastReviewedAt: null,
  };
}

export function createInitialState(now = new Date()): RotaState {
  return {
    version: 3,
    profile: {
      name: "Candidato",
      career: "pmmg-cfsd",
      careerLabel: "PMMG — Soldado",
      notice: "pre_notice",
      noticeFile: null,
      examDate: null,
      education: "",
      stage: "starting",
      weeklyHours: 7,
      availableDays: [1, 2, 3, 5, 6],
      preferredPeriod: "morning",
      interests: [],
      enemFocusArea: null,
      targetCourse: null,
      targetInstitution: null,
      preferredFormats: ["questions"],
      selfReportedStrengths: [],
      onboardingCompleted: false,
      mode: "pre_notice",
    },
    mastery: Object.fromEntries(TOPICS.map((topic) => [topic.id, createMastery(topic.id)])),
    answers: [],
    activityLog: [],
    reviewQueue: [],
    plan: [],
    recommendations: [],
    diagnostic: { active: false, answered: 0, target: 10, completedAt: null },
    stats: {
      xp: 0,
      level: 1,
      streak: 0,
      lastStudyDate: null,
      plannedSessions: 0,
      completedSessions: 0,
      completedMinutes: 0,
      weeklyCheckins: 0,
    },
    updatedAt: now.toISOString(),
  };
}

function daysUntil(date: string | null, now: Date) {
  if (!date) return null;
  return Math.ceil((new Date(`${date}T12:00:00`).getTime() - now.getTime()) / DAY);
}

export function determineMode(state: RotaState, now = new Date()): JourneyMode {
  if (state.profile.career === "undecided") return "exploration";
  const remaining = daysUntil(state.profile.examDate, now);
  if (remaining === null || remaining > 365 || state.profile.notice === "pre_notice") return "pre_notice";
  if (remaining < 0) return "post_exam";
  if (remaining <= 30) return "final_sprint";
  return "published_notice";
}

function forgettingRisk(item: TopicMastery, now: Date) {
  if (!item.lastAnsweredAt) return 1;
  return clamp((now.getTime() - new Date(item.lastAnsweredAt).getTime()) / DAY / 30);
}

function urgency(state: RotaState, now: Date) {
  const remaining = daysUntil(state.profile.examDate, now);
  if (remaining === null) return 0.35;
  if (remaining <= 0) return 0.1;
  return clamp(1 - remaining / 240, 0.2, 1);
}

export function calculatePriorities(state: RotaState, now = new Date()): Priority[] {
  const currentUrgency = urgency(state, now);
  return topicsForCareer(state.profile.career).map((topic) => {
    const mastery = state.mastery[topic.id] ?? createMastery(topic.id);
    const gap = 1 - mastery.score;
    const uncertainty = 1 - mastery.confidence;
    const raw =
      topic.weight * 0.35 +
      gap * 0.35 +
      forgettingRisk(mastery, now) * 0.15 +
      currentUrgency * 0.1 +
      uncertainty * 0.05;
    const priority = Math.round(clamp(raw) * 100);
    return {
      ...topic,
      mastery: mastery.score,
      confidence: mastery.confidence,
      priority,
      reason: `${topic.subject} tem prioridade ${priority}/100 porque o peso relativo é ${Math.round(topic.weight * 100)}%, seu domínio estimado é ${Math.round(mastery.score * 100)}% e a confiança dessa estimativa é ${Math.round(mastery.confidence * 100)}%.`,
    };
  }).sort((a, b) => b.priority - a.priority);
}

function dateForWeekday(weekday: number, now: Date) {
  const date = new Date(now);
  const delta = (weekday - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + delta);
  date.setHours(9, 0, 0, 0);
  return date;
}

export function recalculatePlan(
  input: RotaState,
  reason: string,
  now = new Date(),
): RotaState {
  const state = structuredClone(input);
  state.profile.mode = determineMode(state, now);
  const ranked = calculatePriorities(state, now);
  const days = state.profile.availableDays.length
    ? state.profile.availableDays
    : [1, 2, 3, 5, 6];
  const weeklyMinutes = Math.max(120, Math.round(state.profile.weeklyHours * 60));
  const sessionCount = Math.max(1, Math.min(days.length, 6));
  const sessionMinutes = Math.max(25, Math.floor(weeklyMinutes / sessionCount));
  const formats: StudyTaskType[] = state.profile.preferredFormats.length
    ? state.profile.preferredFormats
    : ["questions"];

  state.plan = days.slice(0, sessionCount).map((weekday, index) => {
    const topic = ranked[index % ranked.length];
    const weeklyReview = index === sessionCount - 1;
    const type: StudyTaskType = weeklyReview
      ? "weekly_checkin"
      : index % 3 === 1
        ? "review"
        : formats[index % formats.length];
    return {
      id: `task-${now.getTime()}-${index}`,
      scheduledFor: dateForWeekday(weekday, now).toISOString(),
      topicId: topic.id,
      subject: topic.subject,
      topic: weeklyReview ? "Fechamento e calibração da semana" : topic.topic,
      type,
      minutes: weeklyReview ? Math.min(30, sessionMinutes) : sessionMinutes,
      priority: topic.priority,
      status: "planned",
      explanation: weeklyReview
        ? "Mede evolução, revisa erros e recalcula a próxima semana."
        : topic.reason,
    } satisfies StudyTask;
  });

  state.stats.plannedSessions = state.plan.length;
  state.recommendations = [
    {
      createdAt: now.toISOString(),
      reason,
      topTopicId: ranked[0].id,
      priority: ranked[0].priority,
    },
    ...state.recommendations,
  ].slice(0, 20);
  state.updatedAt = now.toISOString();
  return state;
}

function applySelfAssessment(state: RotaState, strengths: string[]) {
  for (const topic of TOPICS) {
    state.mastery[topic.id] ??= createMastery(topic.id);
  }
  for (const mastery of Object.values(state.mastery)) {
    mastery.alpha = 2;
    mastery.beta = 2;
    mastery.score = 0.5;
    mastery.confidence = 0.08;
  }
  for (const topic of TOPICS.filter((item) => strengths.includes(item.subject))) {
    const mastery = state.mastery[topic.id];
    mastery.alpha = 2.6;
    mastery.beta = 1.8;
    mastery.score = mastery.alpha / (mastery.alpha + mastery.beta);
    mastery.confidence = 0.1;
  }
}

export function completeOnboarding(
  input: RotaState,
  profile: OnboardingInput,
  now = new Date(),
): RotaState {
  const state = structuredClone(input);
  state.profile = {
    ...state.profile,
    ...profile,
    name: profile.name ?? state.profile.name,
    weeklyHours: Number(profile.weeklyHours || 7),
    availableDays: profile.availableDays.map(Number),
    onboardingCompleted: true,
    mode: state.profile.mode,
  };
  state.profile.mode = determineMode(state, now);
  applySelfAssessment(state, profile.selfReportedStrengths);
  state.diagnostic = { active: true, answered: 0, target: 10, completedAt: null };
  state.stats.xp += 20;
  state.stats.level = Math.floor(state.stats.xp / 150) + 1;
  return recalculatePlan(
    state,
    "Rota inicial criada com objetivo, disponibilidade e autoavaliação.",
    now,
  );
}

function topicForQuestion(question: QuestionEvidence) {
  return (
    TOPICS.find((topic) => topic.topic.toLowerCase() === question.topic.toLowerCase()) ??
    TOPICS.find((topic) => topic.subject === question.axis) ??
    TOPICS[4]
  );
}

function updateStreak(state: RotaState, now: Date) {
  const today = dateKey(now);
  if (state.stats.lastStudyDate === today) return;
  const yesterday = dateKey(new Date(now.getTime() - DAY));
  state.stats.streak = state.stats.lastStudyDate === yesterday ? state.stats.streak + 1 : 1;
  state.stats.lastStudyDate = today;
}

export function recordAnswer(
  input: RotaState,
  question: QuestionEvidence,
  selectedOption: number,
  context: "diagnostic" | "practice" | "simulation" | "review",
  now = new Date(),
): RotaState {
  const state = structuredClone(input);
  const topic = topicForQuestion(question);
  const mastery = state.mastery[topic.id] ?? createMastery(topic.id);
  const correct = selectedOption === question.answer;
  const weight = question.difficulty === "Difícil" ? 1.25 : question.difficulty === "Fácil" ? 0.8 : 1;

  if (correct) {
    mastery.alpha += weight;
    mastery.correct += 1;
  } else {
    mastery.beta += weight;
    mastery.wrong += 1;
    state.reviewQueue.unshift({
      id: `review-${now.getTime()}`,
      questionText: question.text,
      subject: topic.subject,
      topic: topic.topic,
      dueAt: new Date(now.getTime() + DAY).toISOString(),
      intervalDays: 1,
      recurrenceCount: 0,
      status: "pending",
    });
  }

  mastery.evidenceCount += 1;
  mastery.score = clamp(mastery.alpha / (mastery.alpha + mastery.beta));
  mastery.confidence = clamp(mastery.evidenceCount / 20, 0.05, 0.95);
  mastery.lastAnsweredAt = now.toISOString();
  state.mastery[topic.id] = mastery;
  state.answers = [
    ...state.answers,
    { topicId: topic.id, correct, context, answeredAt: now.toISOString() },
  ].slice(-500);
  state.stats.xp += correct ? 12 : 6;
  updateStreak(state, now);

  if (state.diagnostic.active && context === "diagnostic") {
    state.diagnostic.answered += 1;
    if (state.diagnostic.answered >= state.diagnostic.target) {
      state.diagnostic.active = false;
      state.diagnostic.completedAt = now.toISOString();
      state.stats.xp += 40;
    }
  }

  state.stats.level = Math.floor(state.stats.xp / 150) + 1;
  return recalculatePlan(
    state,
    correct
      ? "Plano recalculado após nova evidência de domínio."
      : "Plano recalculado para reforçar um erro recente.",
    now,
  );
}

export function completeTask(input: RotaState, taskId: string, now = new Date()) {
  const state = structuredClone(input);
  const task = state.plan.find((item) => item.id === taskId);
  if (!task || task.status === "completed") return state;
  task.status = "completed";
  task.completedAt = now.toISOString();
  state.stats.completedSessions += 1;
  state.stats.completedMinutes += task.minutes;
  state.activityLog = [...(state.activityLog ?? []), { type: "study_session", occurredAt: now.toISOString(), minutes: task.minutes } satisfies ActivityEvent].slice(-500);
  state.stats.xp += 20;
  state.stats.level = Math.floor(state.stats.xp / 150) + 1;
  updateStreak(state, now);
  state.updatedAt = now.toISOString();
  return state;
}

export function completeWeeklyCheckin(input: RotaState, now = new Date()) {
  const state = structuredClone(input);
  state.stats.weeklyCheckins += 1;
  state.activityLog = [...(state.activityLog ?? []), { type: "weekly_checkin", occurredAt: now.toISOString(), minutes: 0 } satisfies ActivityEvent].slice(-500);
  state.stats.xp += 50;
  state.stats.level = Math.floor(state.stats.xp / 150) + 1;
  return recalculatePlan(
    state,
    "Nova semana criada após o fechamento semanal.",
    now,
  );
}

export function calculateRotaScore(state: RotaState) {
  const values = topicsForCareer(state.profile.career).map((topic) => state.mastery[topic.id] ?? createMastery(topic.id));
  const mastery = values.reduce((sum, item) => sum + item.score, 0) / values.length;
  const coverage = values.filter((item) => item.confidence >= 0.2).length / values.length;
  const consistency = state.stats.plannedSessions
    ? clamp(state.stats.completedSessions / state.stats.plannedSessions)
    : 0;
  return Math.round((mastery * 0.65 + coverage * 0.15 + consistency * 0.2) * 100);
}

export function getViewModel(state: RotaState, now = new Date()): RotaViewModel {
  const priorities = calculatePriorities(state, now);
  const liveMode = determineMode(state, now);
  const nextAction =
    state.plan.find((task) => task.status === "planned") ?? state.plan[0] ?? {
      id: "fallback",
      scheduledFor: now.toISOString(),
      topicId: priorities[0].id,
      subject: priorities[0].subject,
      topic: priorities[0].topic,
      type: "questions",
      minutes: 35,
      priority: priorities[0].priority,
      status: "planned",
      explanation: priorities[0].reason,
    };
  const correct = state.answers.filter((answer) => answer.correct).length;
  return {
    state,
    priorities,
    nextAction,
    rotaScore: calculateRotaScore(state),
    accuracy: state.answers.length ? Math.round((correct / state.answers.length) * 100) : null,
    totalAnswers: state.answers.length,
    modeLabel: {
      exploration: "Explorando possibilidades",
      pre_notice: "Preparação pré-edital",
      published_notice: "Edital publicado",
      final_sprint: "Reta final",
      post_exam: "Pós-prova",
    }[liveMode],
  };
}
