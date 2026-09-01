import { createHash } from "node:crypto";

const MODERN_QUESTION_MARKER = /(?:^|\n)\s*QUEST[ÃA]O\s+0?(\d{1,3})\s*/gimu;
const LEGACY_NUMBER_MARKER = /(?:^|\n)\s*(0?[1-9]|[1-5][0-9]|6[0-3])\s+(?=[A-ZÀ-Ú])\s*/gmu;
const OPTION_MARKER = /(?:^|\n)\s*(?:\(([A-E])\)|([A-E])\2?)(?:\s+|\t+)/gmu;

export function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeText(value) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function inferDay(type, fileName) {
  const value = `${type} ${fileName}`.toLowerCase();
  if (/(?:dia|day)[ _-]*0?1(?=\D|$)/.test(value)) return 1;
  if (/(?:dia|day)[ _-]*0?2(?=\D|$)/.test(value)) return 2;
  return null;
}

export function documentType(type, pageCount, text) {
  const normalized = type.toLowerCase();
  if (normalized.startsWith("prova")) return "exam";
  if (pageCount > 3 && /QUEST[ÃA]O\s+0?1\b/i.test(text)) return "exam_with_answer_key";
  return "answer_key";
}

export function axisFor(year, day, number) {
  if (year <= 2008 || !day) return "Interdisciplinar";
  if (year <= 2016) {
    if (day === 1) return number <= 45 ? "Ciências Humanas" : "Ciências da Natureza";
    return number <= 135 ? "Linguagens" : "Matemática";
  }
  if (day === 1) return number <= 45 ? "Linguagens" : "Ciências Humanas";
  return number <= 135 ? "Ciências da Natureza" : "Matemática";
}

export function parseAnswerKey(text) {
  const answers = new Map();
  for (const line of normalizeText(text).split("\n")) {
    const languageColumns = line.trim().match(/^(\d{1,3})\s+([A-E])\s+([A-E])(?:\s|$)/i);
    if (languageColumns) {
      const number = Number(languageColumns[1]);
      answers.set(`${number}:english`, languageColumns[2].toUpperCase());
      answers.set(`${number}:spanish`, languageColumns[3].toUpperCase());
      continue;
    }
    for (const columns of line.matchAll(/(\d{1,3})\s+([A-E])(?=\s|$)/gi)) {
      const number = Number(columns[1]);
      if (!answers.has(`${number}:common`)) answers.set(`${number}:common`, columns[2].toUpperCase());
    }
  }
  return answers;
}

function pageAt(offsets, position) {
  let page = 1;
  for (let index = 0; index < offsets.length; index += 1) {
    if (offsets[index] > position) break;
    page = index + 1;
  }
  return page;
}

function optionSequence(block) {
  const matches = [...block.matchAll(OPTION_MARKER)].map((match) => ({
    label: (match[1] || match[2]).toUpperCase(),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
  for (let start = 0; start <= matches.length - 5; start += 1) {
    if (matches.slice(start, start + 5).map((item) => item.label).join("") === "ABCDE") {
      return matches.slice(start, start + 5);
    }
  }
  return null;
}

function cleanPart(value) {
  return normalizeText(value)
    .replace(/\n?\s*\f\s*/g, "\n")
    .replace(/\n\s*(?:\*?AMARELO\d*|ENEM\s*\d{4}|LC|CH|CN|MT)\s*[-–—]?\s*\d*\s*$/gimu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseQuestions(pages, { year, day, answers = new Map(), documentHash }) {
  const separators = pages.map((_, index) => `\n\n__ENEM_PAGE_${index + 1}__\n\n`);
  let text = "";
  const offsets = [];
  pages.forEach((page, index) => {
    offsets.push(text.length);
    text += `${separators[index]}${normalizeText(page)}`;
  });
  let markerPattern = MODERN_QUESTION_MARKER;
  if (year <= 2008 && (text.match(/QUEST[ÃA]O\s+0?\d{1,3}/gi) ?? []).length < 20) markerPattern = LEGACY_NUMBER_MARKER;
  let markers = [...text.matchAll(markerPattern)].map((match) => ({
    number: Number(match[1]),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
  if (markerPattern === LEGACY_NUMBER_MARKER) {
    const objectiveStart = Math.max(0, text.toUpperCase().lastIndexOf("QUESTÕES OBJETIVAS"));
    const sequential = [];
    let expected = 1;
    for (const marker of markers) {
      if (marker.start >= objectiveStart && marker.number === expected) {
        sequential.push(marker);
        expected += 1;
      }
    }
    markers = sequential;
  }
  const occurrences = new Map();
  const items = [];

  markers.forEach((marker, index) => {
    const blockEnd = markers[index + 1]?.start ?? text.length;
    const block = text.slice(marker.end, blockEnd);
    const sequence = optionSequence(block);
    if (!sequence) return;
    const statement = cleanPart(block.slice(0, sequence[0].start));
    const options = sequence.map((option, optionIndex) => cleanPart(
      block.slice(option.end, sequence[optionIndex + 1]?.start ?? block.length),
    ));
    if (statement.length < 20 || options.some((option) => option.length < 1 || option.length > 5000)) return;

    const seen = occurrences.get(marker.number) ?? 0;
    occurrences.set(marker.number, seen + 1);
    const foreignLanguageItem = year >= 2017
      ? day === 1 && marker.number <= 5
      : year >= 2009 && day === 2 && marker.number >= 91 && marker.number <= 95;
    const languageVariant = foreignLanguageItem
      ? (seen === 0 ? "english" : "spanish")
      : "common";
    const answer = answers.get(`${marker.number}:${languageVariant}`)
      ?? answers.get(`${marker.number}:common`)
      ?? null;
    const referencesVisual = /\b(?:figura|imagem|gráfico|mapa|tabela|charge|tirinha|cartum)\b/i.test(statement);
    const confidence = answer ? (referencesVisual ? 0.72 : 0.92) : 0.58;
    const rawText = cleanPart(block);
    items.push({
      year,
      day,
      number: marker.number,
      languageVariant,
      axis: axisFor(year, day, marker.number),
      sourcePage: pageAt(offsets, marker.start),
      statement,
      options,
      correctOption: answer ? answer.charCodeAt(0) - 65 : null,
      rawText,
      contentHash: digest(`${year}|${day ?? 0}|${marker.number}|${languageVariant}|${statement}|${options.join("|")}`),
      extractionConfidence: confidence,
      extractionStatus: confidence >= 0.8 ? "ready" : "needs_review",
      metadata: { referencesVisual, sourceDocumentHash: documentHash },
    });
  });
  return items;
}

export function chunksForPage(content, pageNumber, maxCharacters = 6000) {
  const text = normalizeText(content);
  if (!text) return [];
  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maxCharacters) {
      chunks.push(current);
      current = "";
    }
    if (paragraph.length > maxCharacters) {
      if (current) chunks.push(current);
      for (let start = 0; start < paragraph.length; start += maxCharacters) chunks.push(paragraph.slice(start, start + maxCharacters));
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks.map((chunk, chunkIndex) => ({
    pageNumber,
    chunkIndex,
    content: chunk,
    contentHash: digest(chunk),
    tokenEstimate: Math.max(1, Math.ceil(chunk.length / 4)),
  }));
}
