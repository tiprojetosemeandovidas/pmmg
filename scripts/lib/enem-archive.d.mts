export type ParsedArchiveItem = {
  year: number;
  day: number | null;
  number: number;
  languageVariant: "common" | "english" | "spanish";
  axis: "Linguagens" | "Matemática" | "Ciências Humanas" | "Ciências da Natureza" | "Interdisciplinar";
  sourcePage: number;
  statement: string;
  options: string[];
  correctOption: number | null;
  rawText: string;
  contentHash: string;
  extractionConfidence: number;
  extractionStatus: "ready" | "needs_review";
  metadata: { referencesVisual: boolean; sourceDocumentHash: string };
};

export function digest(value: string | Uint8Array): string;
export function normalizeText(value: string): string;
export function inferDay(type: string, fileName: string): 1 | 2 | null;
export function documentType(type: string, pageCount: number, text: string): "exam" | "answer_key" | "exam_with_answer_key";
export function axisFor(year: number, day: number | null, number: number): ParsedArchiveItem["axis"];
export function parseAnswerKey(text: string): Map<string, string>;
export function parseQuestions(pages: string[], input: { year: number; day: number | null; answers?: Map<string, string>; documentHash: string }): ParsedArchiveItem[];
export function chunksForPage(content: string, pageNumber: number, maxCharacters?: number): Array<{ pageNumber: number; chunkIndex: number; content: string; contentHash: string; tokenEstimate: number }>;
