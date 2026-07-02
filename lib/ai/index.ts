import { getEnv } from "@/lib/config/env";
import { DeepSeekAnswerProvider } from "./deepseek";
import { MockAnswerProvider } from "./mock";
import type { AnswerProvider, QueryPlanner } from "./provider";

let cached: (AnswerProvider & QueryPlanner) | null = null;

/** Active answer provider + planner, selected from validated env config. */
export function getAnswerProvider(): AnswerProvider & QueryPlanner {
  if (cached) return cached;
  const env = getEnv();
  if (env.DEMO_MODE || !env.DEEPSEEK_API_KEY) {
    cached = new MockAnswerProvider();
  } else {
    cached = new DeepSeekAnswerProvider({
      apiKey: env.DEEPSEEK_API_KEY,
      model: env.DEEPSEEK_MODEL,
    });
  }
  return cached;
}

/** Test-only. */
export function resetAnswerProviderCache(): void {
  cached = null;
}
