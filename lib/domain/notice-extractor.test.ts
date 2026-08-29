import { describe, expect, it } from "vitest";
import { analyzeNoticeText } from "@/lib/domain/notice-extractor";

describe("notice extractor", () => {
  it("identifica sinais auditáveis sem inventar dados", () => {
    const result = analyzeNoticeText(`EDITAL Nº 01/2026 - CONCURSO PÚBLICO\nBanca CEBRASPE\nProva em 12/10/2026\nLíngua Portuguesa\nDireito Constitucional\nDireito Administrativo\nTeste de Aptidão Física`, 1);
    expect(result.boardCandidate).toBe("CEBRASPE");
    expect(result.dates).toContain("12/10/2026");
    expect(result.subjects).toContain("Língua Portuguesa");
    expect(result.signals.hasTaf).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("encaminha documento sem camada textual para OCR", () => {
    const result = analyzeNoticeText(" ", 20);
    expect(result.textCharacters).toBe(0);
    expect(result.warnings[0]).toMatch(/OCR/);
    expect(result.confidence).toBe(0.05);
  });
});
