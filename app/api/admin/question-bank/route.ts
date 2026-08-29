import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { researchQuestions } from "@/lib/perplexity/question-research";
import { recordOperationalEvent, requestId } from "@/lib/platform/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  return profile && ["reviewer", "admin"].includes(profile.account_role) ? { user: data.user, admin } : null;
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
  const [candidates, batches, exams, axes, topics] = await Promise.all([
    access.admin.from("question_candidates").select("*, question_candidate_sources(relation, content_sources(id,title,url,publisher,rights_status,retrieved_at))").order("created_at", { ascending: false }).limit(100),
    access.admin.from("question_import_batches").select("id,origin,provider,model,query,status,source_count,candidate_count,processing_error,created_at").order("created_at", { ascending: false }).limit(30),
    access.admin.from("exams").select("id,title,institution,role,exam_year,status").order("exam_year", { ascending: false }).limit(100),
    access.admin.from("question_axes").select("id,name,slug,display_order").order("display_order"),
    access.admin.from("topics").select("id,name,stable_code,subjects(name)").order("name").limit(500),
  ]);
  const failed = [candidates, batches, exams, axes, topics].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: "Não foi possível carregar a central." }, { status: 500 });
  return NextResponse.json({ candidates: candidates.data, batches: batches.data, exams: exams.data, axes: axes.data, topics: topics.data, perplexityConfigured: Boolean(process.env.PERPLEXITY_API_KEY?.trim()) });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const operationId = requestId(request);
  const access = await curator();
  if (!access) return NextResponse.json({ error: "Acesso restrito à curadoria." }, { status: 403 });
  const body = await request.json().catch(() => null);
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
    source_type: candidate.origin === "web_researched" ? "web_researched" : "manually_created",
    ai_generated: candidate.origin === "web_researched", validation_status: "approved", ingestion_origin: candidate.origin,
    generation_model: candidate.generation_model, provenance: candidate.provenance,
  }).select("id").single();
  if (error || !question) return NextResponse.json({ error: error?.code === "23505" ? "Questão duplicada no banco publicado." : "Não foi possível publicar a questão." }, { status: error?.code === "23505" ? 409 : 500 });
  if (topicId) await access.admin.from("question_topics").upsert({ question_id: question.id, topic_id: topicId, relevance: 1 });
  const { data: links } = await access.admin.from("question_candidate_sources").select("source_id,relation").eq("candidate_id", candidate.id);
  if (links?.length) await access.admin.from("question_source_links").insert(links.map((link) => ({ question_id: question.id, source_id: link.source_id, relation: link.relation })));
  await access.admin.from("question_candidates").update({ status: "approved", published_question_id: question.id, reviewer_notes: parsed.data.notes, reviewed_by: access.user.id, reviewed_at: new Date().toISOString(), exam_id: examId, axis_id: axisId, topic_id: topicId, updated_at: new Date().toISOString() }).eq("id", candidate.id);
  return NextResponse.json({ status: "approved", questionId: question.id });
}
