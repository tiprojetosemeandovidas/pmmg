import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { analyzeNoticeText } from "@/lib/domain/notice-extractor";
import { getUserEntitlements, usageInWindow } from "@/lib/platform/entitlements";
import { recordOperationalEvent, requestId as resolveRequestId } from "@/lib/platform/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PAGES = 400;
const MAX_TEXT = 750_000;

function jsonError(message: string, status: number, id?: string) {
  return NextResponse.json({ error: message, ...(id ? { requestId: id } : {}) }, { status, headers: id ? { "x-request-id": id } : undefined });
}

async function authenticatedUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

function safeFilename(filename: string) {
  const normalized = filename.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120);
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Tempo limite de extração excedido.")), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET() {
  const user = await authenticatedUser();
  if (!user) return jsonError("Entre na sua conta para consultar editais.", 401);
  const supabase = await createClient();
  if (!supabase) return jsonError("Banco indisponível.", 503);
  const { data, error } = await supabase
    .from("notice_submissions")
    .select("id, original_filename, file_size, page_count, structured_data, extraction_confidence, status, processing_error, reviewer_notes, created_at, updated_at")
    .order("created_at", { ascending: false });
  return error ? jsonError("Não foi possível carregar os editais.", 500) : NextResponse.json({ submissions: data });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const operationRequestId = resolveRequestId(request);
  const user = await authenticatedUser();
  if (!user) return jsonError("Entre na sua conta para enviar um edital.", 401, operationRequestId);
  const admin = createAdminClient();
  if (!admin) return jsonError("Processamento seguro ainda não está configurado.", 503, operationRequestId);
  const subscription = await getUserEntitlements(admin, user.id);
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const used = await usageInWindow(admin, user.id, "notice_upload", monthStart.toISOString());
  if (used >= subscription.entitlements.noticeMonthlyUploads) {
    await recordOperationalEvent(admin, { requestId: operationRequestId, route: "/api/notices", eventType: "rate_limited", statusCode: 429, durationMs: Date.now() - startedAt, userId: user.id, metadata: { planCode: subscription.planCode, used } });
    return jsonError(`Seu plano permite ${subscription.entitlements.noticeMonthlyUploads} envio(s) de edital por mês.`, 429, operationRequestId);
  }

  let formData: FormData;
  try { formData = await request.formData(); } catch { return jsonError("Envio inválido.", 400, operationRequestId); }
  const input = formData.get("file");
  if (!(input instanceof File)) return jsonError("Selecione um arquivo PDF.", 400, operationRequestId);
  const maxBytes = Math.min(MAX_BYTES, subscription.entitlements.noticeMaxBytes);
  if (input.size <= 0 || input.size > maxBytes) return jsonError(`O PDF deve ter no máximo ${Math.floor(maxBytes / 1024 / 1024)} MB.`, 413, operationRequestId);
  if (input.type !== "application/pdf" || !input.name.toLowerCase().endsWith(".pdf")) return jsonError("Envie somente arquivos PDF.", 415, operationRequestId);

  const bytes = new Uint8Array(await input.arrayBuffer());
  const header = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  const trailer = new TextDecoder("ascii").decode(bytes.slice(Math.max(0, bytes.length - 2048)));
  if (header !== "%PDF-" || !trailer.includes("%%EOF")) return jsonError("O arquivo não possui uma estrutura PDF válida.", 422, operationRequestId);
  const fileHash = createHash("sha256").update(bytes).digest("hex");

  const { data: duplicate } = await admin
    .from("notice_submissions")
    .select("id, original_filename, file_size, page_count, structured_data, extraction_confidence, status, processing_error, reviewer_notes, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("file_hash", fileHash)
    .maybeSingle();
  if (duplicate) return NextResponse.json({ submission: duplicate, duplicate: true, requestId: operationRequestId }, { headers: { "x-request-id": operationRequestId } });

  let pageCount = 0;
  let extracted = "";
  try {
    const pdf = await withTimeout(getDocumentProxy(bytes, { maxImageSize: 16_777_216 }), 12_000);
    pageCount = pdf.numPages;
    if (pageCount < 1 || pageCount > MAX_PAGES) return jsonError(`O PDF deve ter entre 1 e ${MAX_PAGES} páginas.`, 422, operationRequestId);
    const result = await withTimeout(extractText(pdf, { mergePages: true }), 25_000);
    extracted = result.text.slice(0, MAX_TEXT);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Não foi possível ler o PDF.", 422, operationRequestId);
  }

  const structured = analyzeNoticeText(extracted, pageCount);
  const status = structured.textCharacters < Math.max(100, pageCount * 30) ? "needs_ocr" : "needs_review";
  const id = randomUUID();
  const storagePath = `${user.id}/${id}/${safeFilename(input.name)}`;
  const { error: uploadError } = await admin.storage.from("notice-submissions").upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) return jsonError("Não foi possível armazenar o PDF com segurança.", 500, operationRequestId);

  const { data, error } = await admin.from("notice_submissions").insert({
    id,
    user_id: user.id,
    original_filename: input.name.slice(0, 255),
    storage_path: storagePath,
    mime_type: "application/pdf",
    file_size: input.size,
    file_hash: fileHash,
    page_count: pageCount,
    extracted_text: extracted,
    structured_data: structured,
    extraction_confidence: structured.confidence,
    status,
  }).select("id, original_filename, file_size, page_count, structured_data, extraction_confidence, status, processing_error, reviewer_notes, created_at, updated_at").single();

  if (error) {
    await admin.storage.from("notice-submissions").remove([storagePath]);
    return jsonError("O PDF foi lido, mas o registro não pôde ser criado.", 500, operationRequestId);
  }
  await admin.from("usage_events").insert({ user_id: user.id, metric: "notice_upload", request_id: operationRequestId, metadata: { planCode: subscription.planCode, fileSize: input.size, pageCount } });
  await recordOperationalEvent(admin, { requestId: operationRequestId, route: "/api/notices", eventType: "uploaded", statusCode: 201, durationMs: Date.now() - startedAt, userId: user.id, metadata: { planCode: subscription.planCode, fileSize: input.size, pageCount, status } });
  return NextResponse.json({ submission: data, duplicate: false, requestId: operationRequestId }, { status: 201, headers: { "x-request-id": operationRequestId } });
}
