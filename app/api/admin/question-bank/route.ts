import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { enemDiagnosticQuestions } from "@/lib/data/questions";
import { generateQuestionsFromEnemArchive, type EnemArchiveReference } from "@/lib/enem/question-generator";
import { researchQuestions } from "@/lib/perplexity/question-research";
import { recordOperationalEvent, requestId } from "@/lib/platform/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isOwnerAdministrator } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const maxDuration = 60;

const baseQuestion = {
  examId: z.string().uuid().nullable().default(null),
  axisId: z.string().uuid().nullable().default(null),
  topicId: z.string().uuid().nullable().default(null),
  subject: z.string().trim().min(2).max(120),
  topic: z.string().trim().max(160).default(""),
  statement: z.string().trim().min(20).max(4000),
  options: z.array(z.string().trim().min(1).max(1000)).min(2).max(5),
  correctOption: z.number().int().min(0).max(4),
  explanation: z.string().trim().min(10).max(3000),
  difficulty: z.enum(["easy", "medium", "hard"]),
};

const manualSchema = z.object({
  action: z.literal("manual"),
  ...baseQuestion,
  sourceTitle: z.string().trim().max(300).default("Cadastro manual"),
  sourceUrl: z.union([z.string().trim().url(), z.literal("")]).default(""),
  rightsStatus: z.enum(["unknown","official","public_domain","authorized","restricted"]).default("unknown"),
});

const researchSchema = z.object({
  action: z.literal("research"),
  query: z.string().trim().min(10).max(1200),
  subject: z.string().trim().min(2).max(120),
  topic: z.string().trim().max(160).default(""),
  count: z.number().int().min(1).max(10).default(5),
  domains: z.array(z.string().trim().regex(/^[.-]?[a-z0-9.-]+$/i)).max(20).default(["gov.br"]),
  examId: z.string().uuid().nullable().default(null),
  axisId: z.string().uuid().nullable().default(null),
  topicId: z.string().uuid().nullable().default(null),
});

const archiveGenerationSchema = z.object({
  action: z.literal("generate_from_enem"),
  prompt: z.string().trim().min(5).max(1200),
  subject: z.enum(["Linguagens", "Matemática", "Ciências Humanas", "Ciências da Natureza", "Interdisciplinar"]),
  topic: z.string().trim().min(2).max(160),
  count: z.number().int().min(1).max(10).default(5),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  yearFrom: z.number().int().min(1998).max(2025).default(2009),
  yearTo: z.number().int().min(1998).max(2025).default(2025),
  examId: z.string().uuid().nullable().default(null),
  axisId: z.string().uuid().nullable().default(null),
  topicId: z.string().uuid().nullable().default(null),
}).refine((value) => value.yearFrom <= value.yearTo, { message: "Intervalo de anos inválido.", path: ["yearTo"] });

const reviewSchema = z.object({
  id: z.string().uuid(), status: z.enum(["approved", "rejected"]),
  notes: z.string().trim().max(2000).default(""),
  examId: z.string().uuid().nullable().optional(), axisId: z.string().uuid().nullable().optional(), topicId: z.string().uuid().nullable().optional(),
});

async function curator() {
  const session = await createClient();
  const admin = createAdminClient();
  if (!session || !admin) return null;
  const { data } = await session.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await admin.from("profiles").select("account_role").eq("id", data.user.id).maybeSingle();
  return profile && ["reviewer", "admin"].includes(profile.account_role) || isOwnerAdministrator(data.user) ? { user: data.user, admin } : null;
}

function digest(statement: string, options: string[]) {
  return createHash("sha256").update(`${statement.trim().toLowerCase()}|${options.map((item) => item.trim().toLowerCase()).join("|")}`).digest("hex");
}

function safeTimestamp(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export async function GET() {
  const access = await curator();
  if (!access) return NextResponse.json({ error: "Acesso restrito à curadoria." }, { status: 403 });
  const [candidates, batches, exams, axes, topics, archiveItems, archiveDocuments, archiveEntries] = await Promise.all([
    access.admin.from("question_candidates").select("*, question_candidate_sources(relation, content_sources(id,title,url,publisher,rights_status,retrieved_at))").order("created_at", { ascending: false }).limit(100),
    access.admin.from("question_import_batches").select("id,origin,provider,model,query,status,source_count,candidate_count,processing_error,created_at").order("created_at", { ascending: false }).limit(30),
    access.admin.from("exams").select("id,title,institution,role,exam_year,status").order("exam_year", { ascending: false }).limit(100),
    access.admin.from("question_axes").select("id,name,slug,display_order").order("display_order"),
    access.admin.from("topics").select("id,name,stable_code,subjects(name)").order("name").limit(500),
    access.admin.from("enem_archive_items").select("id", { count: "exact", head: true }),
    access.admin.from("enem_archive_documents").select("id", { count: "exact", head: true }),
    access.admin.from("enem_archive_items")
      .select("id,exam_year,exam_day,item_number,language_variant,axis,source_page,statement,options,correct_option,extraction_confidence,extraction_status,source_document:enem_archive_documents!source_document_id(file_name,official_page_url)")
      .order("exam_year", { ascending: false })
      .order("exam_day", { ascending: true })
      .order("item_number", { ascending: true })
      .limit(50),
  ]);
  const failed = [candidates, batches, exams, axes, topics, archiveItems, archiveDocuments, archiveEntries].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: "Não foi possível carregar a central." }, { status: 500 });
  return NextResponse.json({
    candidates: candidates.data, batches: batches.data, exams: exams.data, axes: axes.data, topics: topics.data,
    perplexityConfigured: Boolean(process.env.PERPLEXITY_API_KEY?.trim()),
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    archive: { itemCount: archiveItems.count ?? 0, documentCount: archiveDocuments.count ?? 0, items: archiveEntries.data ?? [] },
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const operationId = requestId(request);
  const access = await curator();
  if (!access) return NextResponse.json({ error: "Acesso restrito à curadoria." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body?.action === "seed_enem_pilot") {
    let { data: exam } = await access.admin.from("exams").select("id").eq("slug", "enem-2026-autoral-rota").maybeSingle();
    if (!exam) {
      const created = await access.admin.from("exams").insert({ institution: "INEP", state: "DF", role: "ENEM — treino autoral", exam_year: 2026, organizer: "Rota", source_url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem", authorization_reference: "Questões autorais Rota; referência de competências no portal oficial do Inep", status: "published", slug: "enem-2026-autoral-rota", title: "ENEM 2026 — diagnóstico autoral Rota", metadata: { officialQuestions: false, purpose: "pilot_diagnostic" } }).select("id").single();
      if (created.error || !created.data) return NextResponse.json({ error: "Não foi possível preparar a prova autoral ENEM." }, { status: 500 });
      exam = created.data;
    }
    const [{ data: axes }, { data: topics }] = await Promise.all([
      access.admin.from("question_axes").select("id,name"),
      access.admin.from("topics").select("id,name,stable_code"),
    ]);
    const axisByName = new Map((axes ?? []).map((item) => [item.name, item.id]));
    const topicByName = new Map((topics ?? []).map((item) => [item.name, item.id]));
    const { data: batch, error: batchError } = await access.admin.from("question_import_batches").insert({ created_by: access.user.id, origin: "manual", provider: "rota_editorial", query: "Lote autoral inicial ENEM 2026", status: "draft" }).select("id").single();
    if (batchError || !batch) return NextResponse.json({ error: "Não foi possível criar o lote ENEM." }, { status: 500 });
    const { data: source, error: sourceError } = await access.admin.from("content_sources").insert({ batch_id: batch.id, origin: "manual", provider: "rota_editorial", title: "Rota — diagnóstico autoral ENEM", url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem", publisher: "Rota", rights_status: "authorized", content_hash: createHash("sha256").update(`enem-pilot-authorial:${batch.id}`).digest("hex"), metadata: { officialQuestions: false, reference: "Competências ENEM" }, created_by: access.user.id }).select("id").single();
    if (sourceError || !source) return NextResponse.json({ error: "Não foi possível registrar a origem autoral." }, { status: 500 });
    const candidates = enemDiagnosticQuestions.map((question) => ({ batch_id: batch.id, origin: "manual", exam_id: exam!.id, axis_id: axisByName.get(question.axis) ?? null, topic_id: topicByName.get(question.topic) ?? null, subject: question.axis, topic: question.topic, statement: question.text, options: question.options, correct_option: question.answer, explanation: question.explanation, difficulty: question.difficulty === "Fácil" ? "easy" : question.difficulty === "Difícil" ? "hard" : "medium", content_hash: digest(question.text, question.options), provenance: { author: "Rota", purpose: "pilot_diagnostic", officialQuestion: false }, created_by: access.user.id }));
    const { data: inserted, error: candidateError } = await access.admin.from("question_candidates").upsert(candidates, { onConflict: "content_hash", ignoreDuplicates: true }).select("id");
    if (candidateError) return NextResponse.json({ error: "Não foi possível preparar as questões autorais." }, { status: 500 });
    if (inserted?.length) await access.admin.from("question_candidate_sources").insert(inserted.map((candidate) => ({ candidate_id: candidate.id, source_id: source.id, relation: "original_question" })));
    await access.admin.from("question_import_batches").update({ status: "needs_review", source_count: 1, candidate_count: inserted?.length ?? 0, updated_at: new Date().toISOString() }).eq("id", batch.id);
    return NextResponse.json({ batchId: batch.id, candidateCount: inserted?.length ?? 0, sourceCount: 1 }, { status: 201 });
  }
  if (body?.action === "generate_from_enem") {
    const parsed = archiveGenerationSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Parâmetros de geração inválidos.", details: parsed.error.flatten() }, { status: 400 });
    const action = parsed.data;
    let query = access.admin.from("enem_archive_items")
      .select("id,exam_year,exam_day,item_number,language_variant,axis,statement,options,correct_option,source_page,source_document:enem_archive_documents!source_document_id(id,file_name,official_page_url,sha256)")
      .eq("extraction_status", "ready").not("correct_option", "is", null)
      .eq("axis", action.subject).gte("exam_year", action.yearFrom).lte("exam_year", action.yearTo)
      .order("exam_year", { ascending: false }).limit(40);
    if (action.topic.trim()) query = query.textSearch("search_document", action.topic, { type: "websearch", config: "portuguese" });
    let { data: references, error: referenceError } = await query;
    if (!referenceError && (!references || references.length < 3)) {
      const fallback = await access.admin.from("enem_archive_items")
        .select("id,exam_year,exam_day,item_number,language_variant,axis,statement,options,correct_option,source_page,source_document:enem_archive_documents!source_document_id(id,file_name,official_page_url,sha256)")
        .eq("extraction_status", "ready").not("correct_option", "is", null)
        .eq("axis", action.subject).gte("exam_year", action.yearFrom).lte("exam_year", action.yearTo)
        .order("exam_year", { ascending: false }).limit(40);
      references = fallback.data;
      referenceError = fallback.error;
    }
    if (referenceError || !references?.length) return NextResponse.json({ error: "O acervo não possui referências extraídas para esse filtro." }, { status: 409 });
    const selected = references.filter((_, index) => index % Math.max(1, Math.floor(references.length / 10)) === 0).slice(0, 10) as unknown as Array<EnemArchiveReference & { source_page: number; source_document: { id: string; file_name: string; official_page_url: string | null; sha256: string } | null }>;
    const model = process.env.OPENAI_QUESTION_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna";
    const { data: batch, error: batchError } = await access.admin.from("question_import_batches").insert({
      created_by: access.user.id, origin: "file_import", provider: "openai", model,
      query: action.prompt, search_filters: { archive: "enem_1998_2025", subject: action.subject, topic: action.topic, yearFrom: action.yearFrom, yearTo: action.yearTo }, status: "searching",
    }).select("id").single();
    if (batchError || !batch) return NextResponse.json({ error: "Não foi possível iniciar o lote baseado no acervo." }, { status: 500 });
    try {
      const generated = await generateQuestionsFromEnemArchive({ ...action, references: selected });
      const referencedIds = new Set(generated.questions.flatMap((question) => question.referenceItemIds));
      const usedReferences = selected.filter((reference) => referencedIds.has(reference.id) && reference.source_document);
      const documents = [...new Map(usedReferences.map((reference) => [reference.source_document!.id, reference.source_document!])).values()];
      const { data: sources, error: sourceError } = await access.admin.from("content_sources").insert(documents.map((document) => ({
        batch_id: batch.id, origin: "file_import", provider: "enem_archive", title: `ENEM — ${document.file_name}`,
        url: document.official_page_url, publisher: "Inep", rights_status: "official",
        content_hash: createHash("sha256").update(`${batch.id}:${document.sha256}`).digest("hex"),
        metadata: { archiveDocumentId: document.id, sha256: document.sha256 }, created_by: access.user.id,
      }))).select("id,metadata");
      if (sourceError || !sources?.length) throw new Error("archive_sources_failed");
      const rows = generated.questions.map((question) => ({
        batch_id: batch.id, origin: "file_import", exam_id: action.examId, axis_id: action.axisId, topic_id: action.topicId,
        subject: question.subject, topic: question.topic, statement: question.statement, options: question.options,
        correct_option: question.correctOption, explanation: question.explanation, difficulty: question.difficulty,
        content_hash: digest(question.statement, question.options), generation_model: generated.model, prompt_version: "enem-archive-v1",
        provenance: { providerRequestId: generated.requestId, referenceItemIds: question.referenceItemIds, sourceSummary: question.sourceSummary, officialQuestion: false, archive: "ENEM 1998-2025", usage: generated.usage }, created_by: access.user.id,
      }));
      const { data: candidates, error: candidateError } = await access.admin.from("question_candidates").insert(rows).select("id");
      if (candidateError || !candidates?.length) throw new Error(candidateError?.code === "23505" ? "duplicate_question" : "archive_candidates_failed");
      await access.admin.from("question_candidate_sources").insert(candidates.flatMap((candidate) => sources.map((source) => ({ candidate_id: candidate.id, source_id: source.id, relation: "research_context" }))));
      await access.admin.from("question_import_batches").update({ status: "needs_review", source_count: sources.length, candidate_count: candidates.length, model: generated.model, updated_at: new Date().toISOString() }).eq("id", batch.id);
      await recordOperationalEvent(access.admin, { requestId: operationId, route: "/api/admin/question-bank", eventType: "enem_archive_generation_completed", statusCode: 201, durationMs: Date.now() - startedAt, userId: access.user.id, metadata: { referenceCount: usedReferences.length, candidateCount: candidates.length, model: generated.model } });
      return NextResponse.json({ batchId: batch.id, candidateCount: candidates.length, sourceCount: sources.length, referenceCount: usedReferences.length }, { status: 201 });
    } catch (caught) {
      const code = caught instanceof Error ? caught.message.slice(0, 120) : "enem_archive_generation_failed";
      await access.admin.from("question_import_batches").update({ status: "failed", processing_error: code, updated_at: new Date().toISOString() }).eq("id", batch.id);
      const message = code === "openai_not_configured" ? "Configure OPENAI_API_KEY no servidor." : code === "duplicate_question" ? "Uma questão idêntica já está na fila." : "Não foi possível gerar questões a partir do acervo ENEM.";
      return NextResponse.json({ error: message, code }, { status: code === "duplicate_question" ? 409 : 502 });
    }
  }
  const action = body?.action === "research" ? researchSchema.safeParse(body) : manualSchema.safeParse(body);
  if (!action.success) return NextResponse.json({ error: "Dados do lote inválidos.", details: action.error.flatten() }, { status: 400 });

  const origin = action.data.action === "research" ? "web_researched" : "manual";
  const model = action.data.action === "research" ? process.env.PERPLEXITY_MODEL?.trim() || "sonar" : null;
  const { data: batch, error: batchError } = await access.admin.from("question_import_batches").insert({
    created_by: access.user.id, origin, provider: action.data.action === "research" ? "perplexity" : "rota_admin",
    model, query: action.data.action === "research" ? action.data.query : null,
    search_filters: action.data.action === "research" ? { domains: action.data.domains } : {},
    status: action.data.action === "research" ? "searching" : "draft",
  }).select("id").single();
  if (batchError || !batch) return NextResponse.json({ error: "Não foi possível criar o lote." }, { status: 500 });

  try {
    if (action.data.action === "manual") {
      const sourceHash = createHash("sha256").update(`${action.data.sourceTitle}|${action.data.sourceUrl}`).digest("hex");
      const { data: source, error: sourceError } = await access.admin.from("content_sources").insert({
        batch_id: batch.id, origin, provider: "rota_admin", title: action.data.sourceTitle || "Cadastro manual",
        url: action.data.sourceUrl || null, rights_status: action.data.rightsStatus, content_hash: sourceHash, created_by: access.user.id,
      }).select("id").single();
      if (sourceError || !source) throw new Error("manual_source_failed");
      const questionHash = digest(action.data.statement, action.data.options);
      const { data: candidate, error: candidateError } = await access.admin.from("question_candidates").insert({
        batch_id: batch.id, origin, exam_id: action.data.examId, axis_id: action.data.axisId, topic_id: action.data.topicId,
        subject: action.data.subject, topic: action.data.topic || null, statement: action.data.statement, options: action.data.options,
        correct_option: action.data.correctOption, explanation: action.data.explanation, difficulty: action.data.difficulty,
        content_hash: questionHash, provenance: { enteredBy: access.user.id }, created_by: access.user.id,
      }).select("id").single();
      if (candidateError || !candidate) throw new Error(candidateError?.code === "23505" ? "duplicate_question" : "manual_candidate_failed");
      await access.admin.from("question_candidate_sources").insert({ candidate_id: candidate.id, source_id: source.id, relation: "original_question" });
      await access.admin.from("question_import_batches").update({ status: "needs_review", source_count: 1, candidate_count: 1, updated_at: new Date().toISOString() }).eq("id", batch.id);
      return NextResponse.json({ batchId: batch.id, candidateId: candidate.id }, { status: 201 });
    }

    const result = await researchQuestions(action.data);
    if (!result.sources.length) throw new Error("research_without_sources");
    const { data: sources, error: sourceError } = await access.admin.from("content_sources").insert(result.sources.map((source) => ({
      batch_id: batch.id, origin, provider: "perplexity", title: source.title, url: source.url,
      published_at: safeTimestamp(source.date), excerpt: source.snippet,
      rights_status: /\.gov\.br\b|gov\.br\//i.test(source.url) ? "official" : "unknown",
      content_hash: createHash("sha256").update(source.url).digest("hex"), metadata: { sourceType: source.source }, created_by: access.user.id,
    }))).select("id");
    if (sourceError || !sources?.length) throw new Error("research_sources_failed");
    const rows = result.questions.map((question) => ({
      batch_id: batch.id, origin, exam_id: action.data.examId, axis_id: action.data.axisId, topic_id: action.data.topicId,
      subject: question.subject, topic: question.topic, statement: question.statement, options: question.options,
      correct_option: question.correctOption, explanation: question.explanation, difficulty: question.difficulty,
      content_hash: digest(question.statement, question.options), generation_model: result.model, prompt_version: "question-research-v1",
      provenance: { providerRequestId: result.requestId, sourceSummary: question.sourceSummary, usage: result.usage }, created_by: access.user.id,
    }));
    const { data: candidates, error: candidateError } = await access.admin.from("question_candidates").insert(rows).select("id");
    if (candidateError || !candidates?.length) throw new Error(candidateError?.code === "23505" ? "duplicate_question" : "research_candidates_failed");
    await access.admin.from("question_candidate_sources").insert(candidates.flatMap((candidate) => sources.map((source) => ({ candidate_id: candidate.id, source_id: source.id, relation: "research_context" }))));
    await access.admin.from("question_import_batches").update({ status: "needs_review", source_count: sources.length, candidate_count: candidates.length, updated_at: new Date().toISOString() }).eq("id", batch.id);
    await recordOperationalEvent(access.admin, { requestId: operationId, route: "/api/admin/question-bank", eventType: "web_research_completed", statusCode: 201, durationMs: Date.now() - startedAt, userId: access.user.id, metadata: { sourceCount: sources.length, candidateCount: candidates.length, model: result.model } });
    return NextResponse.json({ batchId: batch.id, candidateCount: candidates.length, sourceCount: sources.length }, { status: 201 });
  } catch (caught) {
    const code = caught instanceof Error ? caught.message.slice(0, 120) : "question_ingestion_failed";
    await access.admin.from("question_import_batches").update({ status: "failed", processing_error: code, updated_at: new Date().toISOString() }).eq("id", batch.id);
    await recordOperationalEvent(access.admin, { requestId: operationId, route: "/api/admin/question-bank", eventType: "ingestion_failed", statusCode: 502, durationMs: Date.now() - startedAt, userId: access.user.id, metadata: { code } });
    const message = code === "perplexity_not_configured" ? "Configure PERPLEXITY_API_KEY no servidor." : code === "duplicate_question" ? "Esta questão já existe na fila ou no banco." : "A importação não pôde ser concluída.";
    return NextResponse.json({ error: message, code }, { status: code === "duplicate_question" ? 409 : 502 });
  }
}

export async function PATCH(request: Request) {
  const access = await curator();
  if (!access) return NextResponse.json({ error: "Acesso restrito à curadoria." }, { status: 403 });
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisão inválida." }, { status: 400 });
  const { data: candidate } = await access.admin.from("question_candidates").select("*").eq("id", parsed.data.id).maybeSingle();
  if (!candidate) return NextResponse.json({ error: "Questão candidata não encontrada." }, { status: 404 });
  if (parsed.data.status === "rejected") {
    await access.admin.from("question_candidates").update({ status: "rejected", reviewer_notes: parsed.data.notes, reviewed_by: access.user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", candidate.id);
    return NextResponse.json({ status: "rejected" });
  }
  const examId = parsed.data.examId ?? candidate.exam_id;
  const axisId = parsed.data.axisId ?? candidate.axis_id;
  const topicId = parsed.data.topicId ?? candidate.topic_id;
  if (!examId || !axisId) return NextResponse.json({ error: "Associe uma prova e um eixo antes de publicar." }, { status: 409 });
  const { data: question, error } = await access.admin.from("questions").insert({
    exam_id: examId, axis_id: axisId, subject: candidate.subject, topic: candidate.topic, statement: candidate.statement,
    options: candidate.options, correct_option: candidate.correct_option, explanation: candidate.explanation, difficulty: candidate.difficulty,
    content_hash: candidate.content_hash, status: "published", reviewed_by: access.user.id, reviewed_at: new Date().toISOString(),
    source_type: candidate.generation_model ? "ai_generated" : candidate.origin === "web_researched" ? "web_researched" : "manually_created",
    ai_generated: Boolean(candidate.generation_model), validation_status: "validated", ingestion_origin: candidate.origin,
    validated_by: access.user.id, validated_at: new Date().toISOString(),
    generation_model: candidate.generation_model, provenance: candidate.provenance,
  }).select("id").single();
  if (error || !question) return NextResponse.json({ error: error?.code === "23505" ? "Questão duplicada no banco publicado." : "Não foi possível publicar a questão." }, { status: error?.code === "23505" ? 409 : 500 });
  const { error: optionsError } = await access.admin.from("question_options").insert((candidate.options as string[]).map((content, optionIndex) => ({ question_id: question.id, option_index: optionIndex, label: String.fromCharCode(65 + optionIndex), content })));
  if (optionsError) {
    await access.admin.from("questions").delete().eq("id", question.id);
    return NextResponse.json({ error: "Não foi possível normalizar as alternativas da questão." }, { status: 500 });
  }
  if (topicId) await access.admin.from("question_topics").upsert({ question_id: question.id, topic_id: topicId, relevance: 1, is_primary: true, classification_method: "manual", classified_by: access.user.id });
  const { data: links } = await access.admin.from("question_candidate_sources").select("source_id,relation").eq("candidate_id", candidate.id);
  if (links?.length) await access.admin.from("question_source_links").insert(links.map((link) => ({ question_id: question.id, source_id: link.source_id, relation: link.relation })));
  await access.admin.from("question_candidates").update({ status: "approved", published_question_id: question.id, reviewer_notes: parsed.data.notes, reviewed_by: access.user.id, reviewed_at: new Date().toISOString(), exam_id: examId, axis_id: axisId, topic_id: topicId, updated_at: new Date().toISOString() }).eq("id", candidate.id);
  return NextResponse.json({ status: "approved", questionId: question.id });
}
