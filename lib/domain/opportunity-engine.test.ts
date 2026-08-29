import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/domain/adaptive-engine";
import { calculateOpportunityMatches } from "@/lib/domain/opportunity-engine";

describe("opportunity engine", () => {
  it("keeps the current track first and separates readiness from compatibility", () => {
    const state = createInitialState(new Date("2026-08-27T12:00:00Z"));
    state.profile.onboardingCompleted = true;
    state.profile.education = "medio";
    state.profile.interests = ["policial"];
    const matches = calculateOpportunityMatches(state);
    expect(matches[0].track.code).toBe("pmmg-cfsd");
    expect(matches[0].compatibility).toBeGreaterThan(matches[0].readiness);
    expect(matches.every((match) => match.rankingScore >= 0 && match.rankingScore <= 100)).toBe(true);
  });

  it("flags higher-education tracks without declaring the candidate ineligible", () => {
    const state = createInitialState();
    state.profile.education = "medio";
    const federal = calculateOpportunityMatches(state).find((item) => item.track.code === "federal-police");
    expect(federal?.eligibility).toBe("attention");
  });

  it("uses a general baseline when the candidate is still exploring", () => {
    const state = createInitialState();
    state.profile.career = "undecided";
    state.profile.interests = ["administrativa"];
    const matches = calculateOpportunityMatches(state);
    expect(matches[0].track.area).toBe("administrativa");
    expect(matches[0].reusableTopics).toHaveLength(0);
  });

  it("offers ENEM as an educational route with no enrollment eligibility warning", () => {
    const state = createInitialState();
    state.profile.education = "medio";
    state.profile.interests = ["educacional"];
    const enem = calculateOpportunityMatches(state).find((item) => item.track.code === "enem-2026");
    expect(enem?.track.examDates).toEqual(["2026-11-08", "2026-11-15"]);
    expect(enem?.eligibility).toBe("eligible");
  });
});
