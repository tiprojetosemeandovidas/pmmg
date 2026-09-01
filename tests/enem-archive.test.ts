import { describe, expect, it } from "vitest";
import { axisFor, chunksForPage, inferDay, parseAnswerKey, parseQuestions } from "../scripts/lib/enem-archive.mjs";

describe("preparação do acervo ENEM", () => {
  it("interpreta gabaritos tabulares e variantes de idioma", () => {
    const answers = parseAnswerKey("1 A D\n2 C E\n6 D\n7 A\n8 B 24 C 40 E");
    expect(answers.get("1:english")).toBe("A");
    expect(answers.get("1:spanish")).toBe("D");
    expect(answers.get("6:common")).toBe("D");
    expect(answers.get("24:common")).toBe("C");
  });

  it("extrai questão moderna com cinco alternativas e resposta", () => {
    const pages = ["LINGUAGENS\nQUESTÃO 01\nUm texto suficientemente longo apresenta uma situação de leitura.\nA primeira opção\nB segunda opção\nC terceira opção\nD quarta opção\nE quinta opção\nQUESTÃO 02\nOutro enunciado suficientemente longo para avaliação.\nA alfa\nB beta\nC gama\nD delta\nE épsilon"];
    const answers = new Map([["1:english", "C"], ["2:english", "A"]]);
    const items = parseQuestions(pages, { year: 2024, day: 1, answers, documentHash: "a".repeat(64) });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ number: 1, languageVariant: "english", correctOption: 2, axis: "Linguagens", extractionStatus: "ready" });
    expect(items[0].options).toHaveLength(5);
  });

  it("extrai o padrão legado e classifica a prova interdisciplinar", () => {
    const pages = ["QUESTÕES OBJETIVAS\n01 Um enunciado legado suficientemente longo para ser reconhecido.\n(A) alternativa um\n(B) alternativa dois\n(C) alternativa três\n(D) alternativa quatro\n(E) alternativa cinco"];
    const items = parseQuestions(pages, { year: 1998, day: 1, answers: new Map([["1:common", "B"]]), documentHash: "b".repeat(64) });
    expect(items[0]).toMatchObject({ number: 1, axis: "Interdisciplinar", correctOption: 1 });
  });

  it("infere dia, área e divide páginas longas em trechos pesquisáveis", () => {
    expect(inferDay("prova", "Cadernodeprova_dia2_amarelo.pdf")).toBe(2);
    expect(axisFor(2025, 2, 140)).toBe("Matemática");
    expect(axisFor(2012, 1, 12)).toBe("Ciências Humanas");
    expect(axisFor(2012, 2, 92)).toBe("Linguagens");
    const chunks = chunksForPage(`${"a".repeat(80)}\n\n${"b".repeat(80)}`, 3, 100);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ pageNumber: 3, chunkIndex: 0 });
  });
});
