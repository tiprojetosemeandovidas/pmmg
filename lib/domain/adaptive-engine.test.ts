import { describe, expect, it } from "vitest";
import {
  calculatePriorities,
  completeOnboarding,
  createInitialState,
  determineMode,
  getViewModel,
  recordAnswer,
  recalculatePlan,
  completeTask,
} from "@/lib/domain/adaptive-engine";

const now = new Date("2026-08-27T12:00:00.000Z");

describe("adaptive engine", () => {
  it("uses exploration mode when the candidate has not selected a contest", () => {
    const state = createInitialState(now);
    state.profile.career = "undecided";
    expect(determineMode(state, now)).toBe("exploration");
  });

  it("uses final sprint when the exam is less than 30 days away", () => {
    const state = createInitialState(now);
    state.profile.notice = "published";
    state.profile.examDate = "2026-09-10";
    expect(determineMode(state, now)).toBe("final_sprint");
  });

  it("builds an ENEM plan without leaking contest-only subjects", () => {
    const state = createInitialState(now);
    state.profile.career = "enem-2026";
    state.profile.careerLabel = "ENEM 2026";
    state.profile.notice = "published";
    state.profile.examDate = "2026-11-08";
    const priorities = calculatePriorities(state, now);
    expect(determineMode(state, now)).toBe("published_notice");
    expect(priorities).toHaveLength(9);
    expect(priorities.some((item) => item.id === "RED.COMPETENCIAS")).toBe(true);
    expect(priorities.some((item) => item.id === "LEG.ETICA_DISCIPLINA")).toBe(false);
  });

  it("keeps the PMMG score and plan scoped to PMMG topics", () => {
    const state = createInitialState(now);
    const priorities = calculatePriorities(state, now);
    expect(priorities).toHaveLength(5);
    expect(priorities.some((item) => item.id.startsWith("NAT."))).toBe(false);
  });

  it("completes the diagnostic and creates review evidence", () => {
    let state = completeOnboarding(
      createInitialState(now),
      {
        career: "pmmg-cfsd",
        careerLabel: "PMMG — Soldado",
        notice: "published",
        noticeFile: null,
        examDate: "2026-09-10",
        education: "medio",
        stage: "active",
        weeklyHours: 8,
        availableDays: [1, 3, 5],
        preferredPeriod: "evening",
        interests: ["policial"],
        preferredFormats: ["questions"],
        selfReportedStrengths: ["Linguagens"],
      },
      now,
    );
    const question = {
      axis: "Raciocínio Lógico",
      topic: "Proposições",
      difficulty: "Difícil" as const,
      answer: 1,
      text: "Questão de teste",
    };
    for (let index = 0; index < 10; index += 1) {
      state = recordAnswer(
        state,
        question,
        index % 3 === 0 ? 0 : 1,
        "diagnostic",
        new Date(now.getTime() + index * 1000),
      );
    }
    expect(state.diagnostic.active).toBe(false);
    expect(state.diagnostic.answered).toBe(10);
    expect(state.reviewQueue).toHaveLength(4);
    expect(getViewModel(state, now).rotaScore).toBeGreaterThan(0);
    expect(calculatePriorities(state, now).every((item) => item.priority <= 100)).toBe(true);
  });

  it("preserves completed sessions when new evidence recalculates the plan", () => {
    let state = recalculatePlan(createInitialState(now), "initial", now);
    const completedId = state.plan[0].id;
    state = completeTask(state, completedId, now);
    state = recordAnswer(
      state,
      {
        axis: "Linguagens",
        topic: "Interpretação",
        topicId: "LING.INTERPRETACAO",
        difficulty: "Média",
        answer: 0,
        text: "Evidência posterior",
      },
      0,
      "practice",
      new Date("2026-08-27T13:00:00.000Z"),
    );
    expect(state.plan.find((task) => task.id === completedId)?.status).toBe("completed");
  });
});
