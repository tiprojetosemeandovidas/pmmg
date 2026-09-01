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

export function primaryInterestsForCareer(career: string): string[] {
  if (career === "enem-2026") return ["educacional"];
  if (["pmmg-cfsd", "pmmg-cfo", "federal-police"].includes(career)) return ["policial"];
  if (career === "courts") return ["juridica"];
  if (career === "fiscal") return ["fiscal"];
  if (career === "administrative") return ["administrativa"];
  return [];
}
