import "server-only";

import { z } from "zod";

export const researchedQuestionSchema = z.object({
  questions: z.array(z.object({
    subject: z.string().trim().min(2).max(120),
    topic: z.string().trim().min(2).max(160),
    statement: z.string().trim().min(20).max(4000),
    options: z.array(z.string().trim().min(1).max(1000)).length(4),
    correctOption: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(10).max(3000),
    difficulty: z.enum(["easy", "medium", "hard"]),
    sourceSummary: z.string().trim().min(5).max(1200),
  })).min(1).max(10),
});

export type ResearchedQuestion = z.infer<typeof researchedQuestionSchema>["questions"][number];

type PerplexitySource = {
  title: string;
  url: string;
  date: string | null;
  snippet: string | null;
  source: string;
};

type ResearchResult = {
  requestId: string;
  model: string;
  questions: ResearchedQuestion[];
  sources: PerplexitySource[];
  usage: Record<string, unknown>;
};

const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          subject: { type: "string" }, topic: { type: "string" }, statement: { type: "string" },
          options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
          correctOption: { type: "integer", minimum: 0, maximum: 3 }, explanation: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] }, sourceSummary: { type: "string" },
        },
        required: ["subject", "topic", "statement", "options", "correctOption", "explanation", "difficulty", "sourceSummary"],
      },
    },
  },
  required: ["questions"],
};

function normalizedSources(payload: Record<string, unknown>): PerplexitySource[] {
  const results = Array.isArray(payload.search_results) ? payload.search_results : [];
  const citations = Array.isArray(payload.citations) ? payload.citations : [];
  const fromResults = results.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.url !== "string" || !row.url.startsWith("http")) return [];
    return [{ title: typeof row.title === "string" ? row.title : row.url, url: row.url, date: typeof row.date === "string" ? row.date : null, snippet: typeof row.snippet === "string" ? row.snippet.slice(0, 4000) : null, source: typeof row.source === "string" ? row.source : "web" }];
  });
  const known = new Set(fromResults.map((item) => item.url));
  for (const citation of citations) {
    if (typeof citation === "string" && citation.startsWith("http") && !known.has(citation)) {
      fromResults.push({ title: citation, url: citation, date: null, snippet: null, source: "citation" });
      known.add(citation);
    }
  }
  return fromResults.slice(0, 20);
}

export async function researchQuestions(input: { query: string; subject: string; topic?: string; count: number; domains: string[] }): Promise<ResearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) throw new Error("perplexity_not_configured");
  const model = process.env.PERPLEXITY_MODEL?.trim() || "sonar";
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Pesquise apenas fontes públicas ou oficiais. Crie questões inéditas em português brasileiro; não reproduza questões, alternativas ou explicações protegidas. Use somente fatos sustentados pelos resultados. Se as fontes forem insuficientes, gere menos questões. Toda questão deve ter exatamente quatro alternativas e uma única resposta correta." },
        { role: "user", content: `Produza até ${input.count} questões autorais para preparação educacional. Disciplina: ${input.subject}. Tópico: ${input.topic || "definido pela pesquisa"}. Pesquisa: ${input.query}. Retorne também um resumo curto do fundamento encontrado nas fontes para cada questão.` },
      ],
      max_tokens: 6000,
      temperature: 0.15,
      ...(input.domains.length ? { search_domain_filter: input.domains } : {}),
      response_format: { type: "json_schema", json_schema: { name: "rota_question_research", schema: outputSchema } },
    }),
    signal: AbortSignal.timeout(55_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`perplexity_${response.status}`);
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  if (typeof message?.content !== "string") throw new Error("perplexity_empty_output");
  const parsed = researchedQuestionSchema.safeParse(JSON.parse(message.content));
  if (!parsed.success) throw new Error("perplexity_invalid_output");
  return {
    requestId: typeof payload.id === "string" ? payload.id : "unknown",
    model,
    questions: parsed.data.questions.slice(0, input.count),
    sources: normalizedSources(payload),
    usage: payload.usage && typeof payload.usage === "object" ? payload.usage as Record<string, unknown> : {},
  };
}
