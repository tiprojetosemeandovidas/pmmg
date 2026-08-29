export type EducationRequirement = "none" | "medio" | "superior";

export type CareerTrack = {
  code: string;
  title: string;
  institution: string;
  area: "policial" | "juridica" | "fiscal" | "administrativa" | "educacional";
  scope: string;
  educationRequirement: EducationRequirement;
  hasPhysicalTest: boolean;
  summary: string;
  topicWeights: Record<string, number>;
  examDates?: string[];
  officialSourceUrl?: string;
};

export type OpportunityMatch = {
  track: CareerTrack;
  isCurrent: boolean;
  compatibility: number;
  readiness: number;
  confidence: number;
  rankingScore: number;
  eligibility: "eligible" | "attention";
  reusableTopics: string[];
  gaps: Array<{ topicId: string; label: string; impact: number }>;
  explanation: string;
};

export type TrackedOpportunity = {
  trackCode: string;
  status: "watching" | "secondary";
  compatibilityScore: number;
  updatedAt: string;
};
