import { describe, expect, it } from "vitest";
import { primaryInterestsForCareer } from "@/lib/domain/onboarding";

describe("onboarding por objetivo", () => {
  it("seleciona somente o interesse educacional para ENEM", () => {
    expect(primaryInterestsForCareer("enem-2026")).toEqual(["educacional"]);
    expect(primaryInterestsForCareer("enem-2026")).not.toContain("policial");
  });

  it("mantém carreiras policiais separadas do ENEM", () => {
    expect(primaryInterestsForCareer("pmmg-cfsd")).toEqual(["policial"]);
    expect(primaryInterestsForCareer("federal-police")).toEqual(["policial"]);
  });
});
