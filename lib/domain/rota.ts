export type JourneyMode =
  | "exploration"
  | "pre_notice"
  | "published_notice"
  | "final_sprint"
  | "post_exam";

export type StudyTaskType =
  | "theory"
  | "questions"
  | "review"
  | "simulation"
  | "weekly_checkin";

export type TopicDefinition = {
  id: string;
  subject: string;
  topic: string;
  weight: number;
  icon: string;
};

export type TopicMastery = {
  topicId: string;
  alpha: number;
  beta: number;
  score: number;
  confidence: number;
  evidenceCount: number;
  correct: number;
  wrong: number;
  lastAnsweredAt: string | null;
  lastReviewedAt: string | null;
};

export type CandidateProfile = {
  name: string;
  career: string;
  careerLabel: string;
  notice: "pre_notice" | "published" | "file";
  noticeFile: string | null;
  examDate: string | null;
  education: string;
  stage: string;
  weeklyHours: number;
  availableDays: number[];
  preferredPeriod: string;
  interests: string[];
  preferredFormats: StudyTaskType[];
  selfReportedStrengths: string[];
  onboardingCompleted: boolean;
  mode: JourneyMode;
};

export type StudyTask = {
  id: string;
  scheduledFor: string;
  topicId: string;
  subject: string;
  topic: string;
  type: StudyTaskType;
  minutes: number;
  priority: number;
  status: "planned" | "completed";
  explanation: string;
  completedAt?: string;
};

export type ReviewItem = {
  id: string;
  questionText: string;
  subject: string;
  topic: string;
  dueAt: string;
  intervalDays: number;
  recurrenceCount: number;
  status: "pending" | "completed";
};

export type AnswerRecord = {
  topicId: string;
  correct: boolean;
  context: "diagnostic" | "practice" | "simulation" | "review";
  answeredAt: string;
};

export type ActivityEvent = {
  type: "study_session" | "weekly_checkin";
  occurredAt: string;
  minutes: number;
};

export type RotaState = {
  version: 3;
  profile: CandidateProfile;
  mastery: Record<string, TopicMastery>;
  answers: AnswerRecord[];
  activityLog?: ActivityEvent[];
  reviewQueue: ReviewItem[];
  plan: StudyTask[];
  recommendations: Array<{
    createdAt: string;
    reason: string;
    topTopicId: string;
    priority: number;
  }>;
  diagnostic: {
    active: boolean;
    answered: number;
    target: number;
    completedAt: string | null;
  };
  stats: {
    xp: number;
    level: number;
    streak: number;
    lastStudyDate: string | null;
    plannedSessions: number;
    completedSessions: number;
    completedMinutes: number;
    weeklyCheckins: number;
  };
  updatedAt: string;
};

export type Priority = TopicDefinition & {
  mastery: number;
  confidence: number;
  priority: number;
  reason: string;
};

export type QuestionEvidence = {
  axis: string;
  topic: string;
  difficulty: "Fácil" | "Média" | "Difícil";
  answer: number;
  text: string;
};

export type OnboardingInput = Omit<
  CandidateProfile,
  "name" | "onboardingCompleted" | "mode"
> & { name?: string };

export type RotaViewModel = {
  state: RotaState;
  priorities: Priority[];
  nextAction: StudyTask;
  rotaScore: number;
  accuracy: number | null;
  totalAnswers: number;
  modeLabel: string;
};
