export const ENEM_FOCUS_AREAS = [
  ["undecided", "Ainda não decidi"],
  ["health", "Saúde e Ciências Biológicas"],
  ["engineering", "Engenharias e Ciências Exatas"],
  ["technology", "Tecnologia e Computação"],
  ["humanities", "Ciências Humanas e Sociais"],
  ["law", "Direito"],
  ["education", "Licenciaturas e Educação"],
  ["business", "Administração, Economia e Negócios"],
  ["languages", "Linguagens, Comunicação e Artes"],
] as const;

export type EnemFocusArea = (typeof ENEM_FOCUS_AREAS)[number][0];

export type EnemScoreArea = "languages" | "essay" | "mathematics" | "humanities" | "nature";

const BALANCED_EMPHASIS: Record<EnemScoreArea, number> = {
  languages: 1,
  essay: 1,
  mathematics: 1,
  humanities: 1,
  nature: 1,
};

export const ENEM_FOCUS_EMPHASIS: Record<EnemFocusArea, Record<EnemScoreArea, number>> = {
  undecided: BALANCED_EMPHASIS,
  health: { languages: 0.78, essay: 0.92, mathematics: 0.82, humanities: 0.7, nature: 1 },
  engineering: { languages: 0.7, essay: 0.84, mathematics: 1, humanities: 0.62, nature: 0.96 },
  technology: { languages: 0.76, essay: 0.82, mathematics: 1, humanities: 0.62, nature: 0.9 },
  humanities: { languages: 0.94, essay: 1, mathematics: 0.62, humanities: 1, nature: 0.62 },
  law: { languages: 0.96, essay: 1, mathematics: 0.58, humanities: 1, nature: 0.55 },
  education: { languages: 0.9, essay: 1, mathematics: 0.78, humanities: 0.9, nature: 0.78 },
  business: { languages: 0.84, essay: 0.9, mathematics: 1, humanities: 0.86, nature: 0.62 },
  languages: { languages: 1, essay: 1, mathematics: 0.55, humanities: 0.86, nature: 0.55 },
};

export function enemFocusLabel(focus?: string | null) {
  return ENEM_FOCUS_AREAS.find(([value]) => value === focus)?.[1] ?? ENEM_FOCUS_AREAS[0][1];
}

export function enemScoreAreaForTopic(topicId: string): EnemScoreArea | null {
  if (topicId.startsWith("LING.")) return "languages";
  if (topicId.startsWith("RED.")) return "essay";
  if (topicId.startsWith("MAT.")) return "mathematics";
  if (topicId.startsWith("HUM.")) return "humanities";
  if (topicId.startsWith("NAT.")) return "nature";
  return null;
}

export function enemEmphasisForTopic(topicId: string, focus?: string | null) {
  const area = enemScoreAreaForTopic(topicId);
  const validFocus = ENEM_FOCUS_AREAS.some(([value]) => value === focus) ? focus as EnemFocusArea : "undecided";
  return area ? ENEM_FOCUS_EMPHASIS[validFocus][area] : 1;
}

export function primaryInterestsForCareer(career: string): string[] {
  if (career === "enem-2026") return ["educacional"];
  if (["pmmg-cfsd", "pmmg-cfo", "federal-police"].includes(career)) return ["policial"];
  if (career === "courts") return ["juridica"];
  if (career === "fiscal") return ["fiscal"];
  if (career === "administrative") return ["administrativa"];
  return [];
}
