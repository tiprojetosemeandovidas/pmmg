import { describe, expect, it } from "vitest";
import { createInitialState, recalculatePlan } from "@/lib/domain/adaptive-engine";
import { buildMentorSources, deterministicMentorAnswer } from "@/lib/domain/mentor-context";

describe("mentor context", () => {
  it("expõe apenas fontes identificáveis e auditáveis", () => {
    const state = recalculatePlan(createInitialState(new Date("2026-08-27T12:00:00Z")), "teste", new Date("2026-08-27T12:00:00Z"));
    const sources = buildMentorSources(state, [{ original_filename: "edital.pdf", structured_data: { boardCandidate: "FGV" } }]);
    expect(sources.map((source) => source.id)).toEqual(["plan-current", "performance-current", "review-current", "notice-1"]);
    expect(sources[3].content).toContain("FGV");
  });

  it("mantém orientação útil sem chave de IA", () => {
    const state = recalculatePlan(createInitialState(new Date("2026-08-27T12:00:00Z")), "teste", new Date("2026-08-27T12:00:00Z"));
    const answer = deterministicMentorAnswer(state, "O que estudar agora?");
    expect(answer.answer).toContain("próxima ação");
    expect(answer.citations[0].sourceId).toBe("plan-current");
  });

  it("inclui preparação física somente quando há evidência registrada", () => {
    const state = recalculatePlan(createInitialState(), "teste");
    const sources = buildMentorSources(state, [], { goals: [{ event_code: "run_12m", target_value: 2400 }], results: [] });
    expect(sources.at(-1)?.id).toBe("physical-current");
  });

  it("inclui somente questões validadas relevantes à rota", () => {
    const state = recalculatePlan(createInitialState(), "teste");
    const sources = buildMentorSources(state, [], undefined, [
      { id: "q1", subject: "Linguagens", topic: "Interpretação textual", statement: "Enunciado validado", explanation: "Explicação validada", source_type: "web_researched" },
      { id: "q2", subject: "Biologia", topic: "Ecologia", statement: "Fora da rota atual", explanation: "Não deve entrar", source_type: "web_researched" },
    ]);
    const bank = sources.find((source) => source.id === "question-bank-current");
    expect(bank?.content).toContain("Enunciado validado");
    expect(bank?.content).not.toContain("Fora da rota atual");
  });
});
