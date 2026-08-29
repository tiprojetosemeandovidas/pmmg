import "server-only";

import OpenAI from "openai";

export function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  return apiKey ? new OpenAI({ apiKey }) : null;
}

export function getMentorModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.6-luna";
}
