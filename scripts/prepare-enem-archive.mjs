#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { extractText } from "unpdf";
import {
  chunksForPage, digest, documentType, inferDay, normalizeText, parseAnswerKey, parseQuestions,
} from "./lib/enem-archive.mjs";

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values;
}

async function readIndex(file) {
  const lines = [];
  const input = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of input) if (line.trim()) lines.push(parseCsvLine(line));
  const headers = lines.shift();
  return lines.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

async function knownChecksums(file) {
  const result = new Map();
  for (const line of (await readFile(file, "utf8")).split(/\r?\n/)) {
    const match = line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    if (match) result.set(match[2].replace(/^\.\//, "").replace(/^ENEM_1998_2025\//, ""), match[1].toLowerCase());
  }
  return result;
}

async function writeNdjson(file, rows) {
  await writeFile(file, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
}

async function main() {
  const archiveRoot = resolve(process.argv[2] || "Concursos/Enem/ENEM_1998_2025");
  const outputRoot = resolve(process.argv[3] || join(archiveRoot, ".prepared"));
  const indexRows = await readIndex(join(archiveRoot, "INDICE_E_FONTES.csv"));
  const checksums = await knownChecksums(join(archiveRoot, "SHA256SUMS.txt"));
  const documents = [];
  const chunks = [];
  const extracted = [];

  for (const row of indexRows) {
    const file = join(archiveRoot, row.ano, row.arquivo);
    const bytes = new Uint8Array(await readFile(file));
    const sha256 = digest(bytes);
    const checksumKey = relative(archiveRoot, file);
    const expectedChecksum = checksums.get(checksumKey);
    if (!expectedChecksum) throw new Error(`Checksum ausente: ${checksumKey}`);
    if (expectedChecksum !== sha256) throw new Error(`Checksum divergente: ${checksumKey}`);
    const extraction = await extractText(bytes);
    const pages = Array.isArray(extraction.text) ? extraction.text.map(normalizeText) : [normalizeText(extraction.text)];
    const day = inferDay(row.tipo, row.arquivo) ?? 1;
    const type = documentType(row.tipo, extraction.totalPages, pages.join("\n"));
    const document = {
      year: Number(row.ano),
      day,
      documentType: type,
      fileName: basename(file),
      relativePath: checksumKey,
      officialPageUrl: row.pagina_oficial_riep || null,
      officialDownloadUrl: row.download_oficial || null,
      sha256,
      pageCount: extraction.totalPages,
      extractionStatus: pages.some((page) => page.length < 40) ? "partial" : "extracted",
      metadata: { indexType: row.tipo, localArchive: true },
    };
    documents.push(document);
    pages.forEach((page, pageIndex) => chunks.push(...chunksForPage(page, pageIndex + 1).map((chunk) => ({ documentHash: sha256, ...chunk }))));
    extracted.push({ document, pages });
    process.stdout.write(`\rExtraídos ${documents.length}/${indexRows.length} documentos`);
  }
  process.stdout.write("\n");

  const answerKeys = new Map();
  for (const entry of extracted.filter(({ document }) => document.documentType !== "exam")) {
    const key = `${entry.document.year}:${entry.document.day ?? 0}`;
    const current = answerKeys.get(key) ?? { answers: new Map(), documentHash: entry.document.sha256 };
    const joined = entry.pages.join("\n");
    const answerSection = entry.document.documentType === "exam_with_answer_key" && joined.toUpperCase().lastIndexOf("GABARITO") > 0
      ? joined.slice(joined.toUpperCase().lastIndexOf("GABARITO"))
      : joined;
    for (const [answerKey, answer] of parseAnswerKey(answerSection)) current.answers.set(answerKey, answer);
    current.documentHash = entry.document.sha256;
    answerKeys.set(key, current);
  }

  const items = [];
  for (const entry of extracted.filter(({ document }) => document.documentType !== "answer_key")) {
    const key = `${entry.document.year}:${entry.document.day ?? 0}`;
    const answerKey = answerKeys.get(key) ?? { answers: new Map(), documentHash: null };
    items.push(...parseQuestions(entry.pages, {
      year: entry.document.year,
      day: entry.document.day,
      answers: answerKey.answers,
      documentHash: entry.document.sha256,
    }).map((item) => ({ ...item, sourceDocumentHash: entry.document.sha256, answerKeyDocumentHash: answerKey.documentHash })));
  }
  const uniqueItems = [...items.reduce((byKey, item) => {
    const key = `${item.year}:${item.day}:${item.number}:${item.languageVariant}`;
    const current = byKey.get(key);
    if (!current || item.extractionConfidence > current.extractionConfidence || (item.extractionConfidence === current.extractionConfidence && item.statement.length > current.statement.length)) byKey.set(key, item);
    return byKey;
  }, new Map()).values()];

  await mkdir(outputRoot, { recursive: true });
  await writeNdjson(join(outputRoot, "documents.ndjson"), documents);
  await writeNdjson(join(outputRoot, "chunks.ndjson"), chunks);
  await writeNdjson(join(outputRoot, "items.ndjson"), uniqueItems);
  const report = {
    generatedAt: new Date().toISOString(),
    archiveRoot: relative(dirname(outputRoot), archiveRoot),
    documentCount: documents.length,
    chunkCount: chunks.length,
    itemCount: uniqueItems.length,
    readyItemCount: uniqueItems.filter((item) => item.extractionStatus === "ready").length,
    reviewItemCount: uniqueItems.filter((item) => item.extractionStatus === "needs_review").length,
    duplicateItemCount: items.length - uniqueItems.length,
    years: Object.fromEntries([...new Set(documents.map((document) => document.year))].sort().map((year) => [year, uniqueItems.filter((item) => item.year === year).length])),
  };
  await writeFile(join(outputRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
