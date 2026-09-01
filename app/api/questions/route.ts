import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  career: z.string().max(80).default("enem-2026"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const difficultyLabel: Record<string, "Fácil" | "Média" | "Difícil"> = {
  easy: "Fácil",
  medium: "Média",
  hard: "Difícil",
};

const adaptiveTopicAliases: Record<string, string> = {
  "LINGUAGENS.INTERPRETACAO": "LING.INTERPRETACAO",
  "CONHECIMENTOS_GERAIS.CIDADANIA": "GERAL.CIDADANIA",
};

export async function GET(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Banco de questões indisponível." }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Entre para acessar questões validadas." }, { status: 401 });
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Filtros inválidos." }, { status: 400 });

  let query = supabase
    .from("questions")
    .select("id,subject,topic,statement,options,difficulty,source_type,exams!inner(role,exam_year,organizer),question_axes(name),question_topics(is_primary,topics(stable_code)),question_sources(source_name,source_url,official),question_source_links(relation,content_sources(title,url,rights_status))")
    .eq("status", "published")
    .eq("validation_status", "validated")
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);
  if (parsed.data.career === "enem-2026") query = query.ilike("exams.role", "%ENEM%");
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Não foi possível carregar o banco de questões." }, { status: 500 });

  return NextResponse.json({
    data: (data ?? []).map((item) => {
      const exam = Array.isArray(item.exams) ? item.exams[0] : item.exams;
      const axis = Array.isArray(item.question_axes) ? item.question_axes[0] : item.question_axes;
      const sources = Array.isArray(item.question_sources) ? item.question_sources : [];
      const linkedSources = (Array.isArray(item.question_source_links) ? item.question_source_links : []).map((link) => Array.isArray(link.content_sources) ? link.content_sources[0] : link.content_sources).filter(Boolean);
      const normalizedSource = sources.find((candidate) => candidate.official) ?? sources[0];
      const linkedSource = linkedSources.find((candidate) => candidate?.rights_status === "official") ?? linkedSources[0];
      const topicLinks = Array.isArray(item.question_topics) ? item.question_topics : [];
      const primaryTopic = topicLinks.find((candidate) => candidate.is_primary) ?? topicLinks[0];
      const normalizedTopic = Array.isArray(primaryTopic?.topics) ? primaryTopic.topics[0] : primaryTopic?.topics;
      const source = normalizedSource ? { name: normalizedSource.source_name, url: normalizedSource.source_url, official: normalizedSource.official }
        : linkedSource ? { name: linkedSource.title, url: linkedSource.url, official: linkedSource.rights_status === "official" } : null;
      return {
        id: item.id,
        axis: axis?.name ?? item.subject,
        exam: exam ? `${exam.role} ${exam.exam_year}` : "Questão validada",
        difficulty: difficultyLabel[item.difficulty ?? "medium"] ?? "Média",
        topic: item.topic ?? item.subject,
        topicId: normalizedTopic?.stable_code ? (adaptiveTopicAliases[normalizedTopic.stable_code] ?? normalizedTopic.stable_code) : undefined,
        text: item.statement,
        options: Array.isArray(item.options) ? item.options : [],
        sourceType: item.source_type,
        source,
      };
    }),
  });
}
