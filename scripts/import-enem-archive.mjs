#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !serviceKey) throw new Error("Configure SUPABASE_URL e SUPABASE_SECRET_KEY (ou a chave legada SUPABASE_SERVICE_ROLE_KEY).");

// As chaves novas `sb_secret_...` autenticam pelo header `apikey` e não são
// JWTs. A chave legada service_role continua exigindo também Bearer.
const headers = {
  apikey: serviceKey,
  ...(!serviceKey.startsWith("sb_secret_") ? { authorization: `Bearer ${serviceKey}` } : {}),
  "content-type": "application/json",
};

async function rows(file) {
  return (await readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function rest(path, init = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${path}: ${body.slice(0, 800)}`);
  return body ? JSON.parse(body) : null;
}

async function insertBatches(table, payload, onConflict, size = 150) {
  for (let start = 0; start < payload.length; start += size) {
    await rest(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(payload.slice(start, start + size)),
    });
    process.stdout.write(`\r${table}: ${Math.min(start + size, payload.length)}/${payload.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  const root = resolve(process.argv[2] || "Concursos/Enem/ENEM_1998_2025/.prepared");
  const [documents, chunks, items, exams] = await Promise.all([
    rows(`${root}/documents.ndjson`), rows(`${root}/chunks.ndjson`), rows(`${root}/items.ndjson`),
    rest("exams?select=id,exam_year&role=eq.ENEM"),
  ]);
  const examByYear = new Map(exams.map((exam) => [exam.exam_year, exam.id]));
  await insertBatches("enem_archive_documents", documents.map((document) => ({
    exam_id: examByYear.get(document.year), exam_year: document.year, exam_day: document.day,
    document_type: document.documentType, file_name: document.fileName, relative_path: document.relativePath,
    official_page_url: document.officialPageUrl, official_download_url: document.officialDownloadUrl,
    sha256: document.sha256, page_count: document.pageCount, extraction_status: document.extractionStatus, metadata: document.metadata,
  })), "sha256");
  const storedDocuments = await rest("enem_archive_documents?select=id,sha256");
  const documentByHash = new Map(storedDocuments.map((document) => [document.sha256, document.id]));
  await insertBatches("enem_archive_chunks", chunks.map((chunk) => ({
    document_id: documentByHash.get(chunk.documentHash), page_number: chunk.pageNumber,
    chunk_index: chunk.chunkIndex, content: chunk.content, content_hash: chunk.contentHash, token_estimate: chunk.tokenEstimate,
  })), "document_id,page_number,chunk_index", 80);
  await insertBatches("enem_archive_items", items.map((item) => ({
    exam_id: examByYear.get(item.year), source_document_id: documentByHash.get(item.sourceDocumentHash),
    answer_key_document_id: documentByHash.get(item.answerKeyDocumentHash) || null,
    exam_year: item.year, exam_day: item.day, item_number: item.number, language_variant: item.languageVariant,
    axis: item.axis, source_page: item.sourcePage, statement: item.statement, options: item.options,
    correct_option: item.correctOption, raw_text: item.rawText, content_hash: item.contentHash,
    extraction_confidence: item.extractionConfidence, extraction_status: item.extractionStatus, metadata: item.metadata,
  })), "exam_year,exam_day,item_number,language_variant", 80);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
