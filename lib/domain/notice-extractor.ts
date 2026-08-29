const SUBJECTS = [
  "Língua Portuguesa", "Raciocínio Lógico", "Matemática", "Informática",
  "Direito Constitucional", "Direito Administrativo", "Direito Penal",
  "Direito Processual Penal", "Direitos Humanos", "Legislação Especial",
  "Administração Pública", "Contabilidade", "Atualidades", "Redação",
  "Conhecimentos Gerais", "Legislação Institucional",
];

const BOARDS = ["CEBRASPE", "CESPE", "FGV", "FCC", "VUNESP", "IBFC", "AOCP", "IDECAN", "CONSULPLAN", "FUNDEP"];

export type NoticeExtraction = {
  titleCandidate: string | null;
  boardCandidate: string | null;
  dates: string[];
  subjects: string[];
  signals: { hasTaf: boolean; hasEssay: boolean; educationLevel: string | null };
  textCharacters: number;
  confidence: number;
  warnings: string[];
};

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

export function analyzeNoticeText(text: string, pageCount: number): NoticeExtraction {
  const normalized = clean(text);
  const upper = normalized.toLocaleUpperCase("pt-BR");
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const titleCandidate = lines.find((line) => /EDITAL|CONCURSO P[ÚU]BLICO|PROCESSO SELETIVO/i.test(line))?.slice(0, 240) ?? null;
  const boardCandidate = BOARDS.find((board) => new RegExp(`\\b${board}\\b`, "i").test(normalized)) ?? null;
  const subjects = SUBJECTS.filter((subject) => upper.includes(subject.toLocaleUpperCase("pt-BR")));
  const dates = [...new Set(normalized.match(/\b(?:0?[1-9]|[12]\d|3[01])[\/.-](?:0?[1-9]|1[0-2])[\/.-](?:20)?\d{2}\b/g) ?? [])].slice(0, 30);
  const density = pageCount ? normalized.length / pageCount : 0;
  const warnings: string[] = [];
  if (density < 80) warnings.push("Texto insuficiente; o documento pode ser digitalizado e exigir OCR.");
  if (!titleCandidate) warnings.push("Título do edital não identificado automaticamente.");
  if (!boardCandidate) warnings.push("Banca organizadora não identificada automaticamente.");
  if (!subjects.length) warnings.push("Disciplinas não identificadas automaticamente.");
  const confidence = Math.min(0.95, Math.max(0.05,
    (density >= 250 ? 0.35 : density >= 80 ? 0.2 : 0.05) +
    (titleCandidate ? 0.2 : 0) + (boardCandidate ? 0.2 : 0) +
    (subjects.length >= 3 ? 0.2 : subjects.length ? 0.1 : 0),
  ));
  const educationLevel = /N[ÍI]VEL SUPERIOR|ENSINO SUPERIOR/.test(upper)
    ? "superior"
    : /N[ÍI]VEL M[ÉE]DIO|ENSINO M[ÉE]DIO/.test(upper) ? "medio" : null;
  return {
    titleCandidate,
    boardCandidate,
    dates,
    subjects,
    signals: {
      hasTaf: /TESTE DE APTID[ÃA]O F[ÍI]SICA|\bTAF\b/.test(upper),
      hasEssay: /PROVA DISCURSIVA|REDA[CÇ][ÃA]O/.test(upper),
      educationLevel,
    },
    textCharacters: normalized.length,
    confidence: Math.round(confidence * 1000) / 1000,
    warnings,
  };
}
