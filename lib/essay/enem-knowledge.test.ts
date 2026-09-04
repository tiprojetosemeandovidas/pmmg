import { describe, expect, it } from "vitest";
import { buildEssayKnowledgeContext, CONNECTOR_FAMILIES, CORPUS_FINDINGS, ENEM_METHOD, REFERENCE_PATTERNS } from "@/lib/essay/enem-knowledge";

describe("base pedagógica de redação ENEM", () => {
  it("mantém método completo e separado do texto integral dos participantes", () => {
    expect(ENEM_METHOD).toHaveLength(5);
    expect(CONNECTOR_FAMILIES.length).toBeGreaterThanOrEqual(6);
    expect(REFERENCE_PATTERNS.length).toBeGreaterThanOrEqual(5);
    expect(CORPUS_FINDINGS.some((item) => item.includes("intervenção"))).toBe(true);
    const context = buildEssayKnowledgeContext();
    expect(context).toContain("16 redações");
    expect(context).not.toContain("Casa-grande e Senzala");
  });
});
