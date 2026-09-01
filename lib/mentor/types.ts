import { z } from "zod";

export const mentorAnswerSchema = z.object({
  answer: z.string(),
  actions: z.array(z.object({ title: z.string(), reason: z.string(), path: z.string().nullable() })),
  citations: z.array(z.object({ sourceId: z.string(), claim: z.string() })),
  confidence: z.enum(["low", "medium", "high"]),
  caveats: z.array(z.string()),
});

export type MentorAnswer = z.infer<typeof mentorAnswerSchema>;

export type MentorSource = {
  id: string;
  label: string;
  type: "plan" | "performance" | "notice" | "review" | "physical" | "question_bank" | "enem_archive";
  content: string;
};

export type MentorInteraction = {
  id: string;
  question: string;
  answer: MentorAnswer | null;
  sources: MentorSource[];
  model: string | null;
  mode: "ai" | "deterministic";
  status: "started" | "completed" | "refused" | "failed";
  created_at: string;
};
