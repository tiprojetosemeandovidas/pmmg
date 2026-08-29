import { PHYSICAL_EVENTS } from "@/lib/progress/catalog";
import type { PhysicalGoal, PhysicalResult } from "@/lib/progress/types";

export type PhysicalProgress = {
  eventCode: string;
  currentValue: number | null;
  targetValue: number | null;
  progress: number | null;
  goalSource: PhysicalGoal["goalSource"] | null;
  isOfficial: boolean;
};

export function calculatePhysicalProgress(goals: PhysicalGoal[], results: PhysicalResult[]): PhysicalProgress[] {
  return PHYSICAL_EVENTS.map((event) => {
    const goal = goals.find((item) => item.eventCode === event.code);
    const latest = results.filter((item) => item.eventCode === event.code)
      .sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())[0];
    let progress: number | null = null;
    if (goal && latest) {
      const ratio = event.direction === "higher" ? latest.value / goal.targetValue : goal.targetValue / latest.value;
      progress = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    }
    return {
      eventCode: event.code,
      currentValue: latest?.value ?? null,
      targetValue: goal?.targetValue ?? null,
      progress,
      goalSource: goal?.goalSource ?? null,
      isOfficial: goal?.isOfficial ?? false,
    };
  });
}
