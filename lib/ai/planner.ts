import { z } from "zod";
import type { QueryPlan } from "./provider";

export const PLANNER_JSON_INSTRUCTIONS = [
  "You turn a user's question into focused web-search queries.",
  'Respond with ONLY a JSON object: {"queries": string[], "subquestions": string[]}.',
  "Queries should be short keyword-style searches, each targeting a distinct aspect.",
  "Subquestions decompose the question for research mode (empty array otherwise).",
].join("\n");

const planSchema = z.object({
  queries: z.array(z.string().min(1).max(400)).max(20),
  subquestions: z.array(z.string().min(1).max(500)).max(20).default([]),
});

/** Parse an LLM planning response; falls back to the raw question. */
export function parsePlan(
  text: string,
  fallbackQuery: string,
  maxQueries: number,
): QueryPlan {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = planSchema.safeParse(JSON.parse(jsonMatch[0]));
      if (parsed.success && parsed.data.queries.length > 0) {
        return {
          queries: parsed.data.queries.slice(0, maxQueries),
          subquestions: parsed.data.subquestions,
        };
      }
    } catch {
      // fall through to fallback
    }
  }
  return { queries: [fallbackQuery], subquestions: [] };
}
