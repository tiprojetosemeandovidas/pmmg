import { TOPICS } from "@/lib/domain/adaptive-engine";
import type { RotaState } from "@/lib/domain/rota";
import { CAREER_TRACKS } from "@/lib/opportunities/catalog";
import type { CareerTrack, OpportunityMatch } from "@/lib/opportunities/types";

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function weightedAverage(weights: Record<string, number>, value: (topicId: string) => number) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  return total ? entries.reduce((sum, [topicId, weight]) => sum + value(topicId) * weight, 0) / total : 0;
}

function transferCoverage(current: CareerTrack | undefined, target: CareerTrack) {
  if (!current) return 0.65;
  return weightedAverage(target.topicWeights, (topicId) => {
    const targetWeight = target.topicWeights[topicId] ?? 0;
    const currentWeight = current.topicWeights[topicId] ?? 0;
    return targetWeight ? Math.min(1, currentWeight / targetWeight) : 0;
  });
}

function educationStatus(education: string, requirement: CareerTrack["educationRequirement"]) {
  if (requirement === "none" || requirement === "medio") return "eligible" as const;
  return education === "superior" || education === "pos" ? "eligible" as const : "attention" as const;
}

export function calculateOpportunityMatches(
  state: RotaState,
  tracks = CAREER_TRACKS,
): OpportunityMatch[] {
  const current = tracks.find((track) => track.code === state.profile.career);
  return tracks.map((track) => {
    const overlap = transferCoverage(current, track);
    const interest = state.profile.interests.includes(track.area) ? 1 : 0.35;
    const eligibility = educationStatus(state.profile.education, track.educationRequirement);
    const eligibilityFactor = eligibility === "eligible" ? 1 : 0.35;
    const compatibility = clampPercent((overlap * .75 + interest * .15 + eligibilityFactor * .1) * 100);
    const readiness = clampPercent(weightedAverage(track.topicWeights, (topicId) => state.mastery[topicId]?.score ?? .5) * 100);
    const confidence = clampPercent(weightedAverage(track.topicWeights, (topicId) => state.mastery[topicId]?.confidence ?? 0) * 100);
    const rankingScore = clampPercent(compatibility * .65 + readiness * .35);
    const reusableTopics = TOPICS.filter((topic) => (current?.topicWeights[topic.id] ?? 0) > 0 && (track.topicWeights[topic.id] ?? 0) > 0).map((topic) => topic.subject);
    const gaps = TOPICS.filter((topic) => (track.topicWeights[topic.id] ?? 0) > 0).map((topic) => ({
      topicId: topic.id,
      label: `${topic.subject} — ${topic.topic}`,
      impact: clampPercent((1 - (state.mastery[topic.id]?.score ?? .5)) * (track.topicWeights[topic.id] ?? 0) * 100),
    })).sort((a, b) => b.impact - a.impact).slice(0, 2);
    return {
      track,
      isCurrent: track.code === state.profile.career,
      compatibility,
      readiness,
      confidence,
      rankingScore,
      eligibility,
      reusableTopics: [...new Set(reusableTopics)],
      gaps,
      explanation: `${compatibility}% de compatibilidade estrutural; prontidão estimada em ${readiness}% com ${confidence}% de confiança nas evidências.`,
    };
  }).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.rankingScore - a.rankingScore);
}
