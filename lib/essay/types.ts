import { z } from "zod";

export const competencySchema = z.object({
  id: z.enum(["C1", "C2", "C3", "C4", "C5"]),
  score: z.number().int().min(0).max(200),
  evidence: z.string(),
  nextStep: z.string(),
});

export const essayCoachSchema = z.object({
  mode: z.enum(["feedback", "model"]),
  summary: z.string(),
  estimatedScore: z.number().int().min(0).max(1000).nullable(),
  competencies: z.array(competencySchema).length(5),
  strengths: z.array(z.string()).max(4),
  priorities: z.array(z.string()).max(4),
  connectorSuggestions: z.array(z.object({ purpose: z.string(), suggestion: z.string(), placement: z.string() })).max(6),
  referenceSuggestions: z.array(z.object({ reference: z.string(), connection: z.string(), verification: z.string() })).max(4),
  essay: z.string().nullable(),
  outline: z.array(z.string()).min(4).max(6),
  caveat: z.string(),
});

export type EssayCoachResult = z.infer<typeof essayCoachSchema>;
