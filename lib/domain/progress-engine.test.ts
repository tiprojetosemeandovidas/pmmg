import { describe, expect, it } from "vitest";
import { completeWeeklyCheckin, createInitialState, recalculatePlan } from "@/lib/domain/adaptive-engine";
import { calculateGamification } from "@/lib/domain/gamification-engine";
import { calculatePhysicalProgress } from "@/lib/domain/physical-engine";

describe("physical and gamification engines", () => {
  it("calculates progress in both higher and lower-is-better events", () => {
    const goals = [
      { eventCode: "run_12m", targetValue: 2400, goalSource: "personal" as const, isOfficial: false, updatedAt: "2026-08-27" },
      { eventCode: "shuttle_run", targetValue: 11, goalSource: "personal" as const, isOfficial: false, updatedAt: "2026-08-27" },
    ];
    const results = [
      { id: "1", eventCode: "run_12m", value: 1800, measuredAt: "2026-08-27", notes: null },
      { id: "2", eventCode: "shuttle_run", value: 12, measuredAt: "2026-08-27", notes: null },
    ];
    const progress = calculatePhysicalProgress(goals, results);
    expect(progress.find((item) => item.eventCode === "run_12m")?.progress).toBe(75);
    expect(progress.find((item) => item.eventCode === "shuttle_run")?.progress).toBe(92);
  });

  it("rewards planned consistency without scaling rewards with excess hours", () => {
    const state = recalculatePlan(createInitialState(new Date("2026-08-27T12:00:00Z")), "test");
    state.profile.onboardingCompleted = true;
    state.plan.slice(0, 3).forEach((task) => { task.status = "completed"; });
    state.stats.completedSessions = 30;
    state.stats.completedMinutes = 2000;
    const snapshot = calculateGamification(state, 1, new Date("2026-08-27T12:00:00Z"));
    const mission = snapshot.missions.find((item) => item.code === "steady_sessions");
    expect(mission?.progress).toBe(mission?.target);
    expect(snapshot.achievements.find((item) => item.code === "taf_started")?.earned).toBe(true);
  });

  it("requires a weekly check-in inside the current rolling week", () => {
    const now = new Date("2026-08-27T12:00:00Z");
    let state = createInitialState(now);
    state.stats.weeklyCheckins = 4;
    expect(calculateGamification(state, 0, now).missions.find((item) => item.code === "weekly_close")?.completed).toBe(false);
    state = completeWeeklyCheckin(state, now);
    expect(calculateGamification(state, 0, now).missions.find((item) => item.code === "weekly_close")?.completed).toBe(true);
  });
});
