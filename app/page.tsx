import { getIdentity } from "@/lib/auth/session";
import { getEnv } from "@/lib/config/env";
import { getStore } from "@/lib/db";
import type { AnswerLength, SearchMode, ThreadRecord } from "@/lib/core/types";
import { EXAMPLE_QUERIES } from "@/lib/search/fixtures";
import { LandingView } from "@/components/search/landing-view";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const env = getEnv();
  const identity = await getIdentity();

  let recentThreads: ThreadRecord[] = [];
  let defaultMode: SearchMode = "quick";
  let defaultAnswerLength: AnswerLength = "balanced";

  if (identity) {
    const store = await getStore();
    const page = await store.listThreads(identity, { limit: 6 });
    recentThreads = page.threads;
    if (identity.kind === "user") {
      const profile = await store.getProfile(identity.userId);
      if (profile) {
        defaultMode = profile.defaultMode;
        defaultAnswerLength = profile.defaultAnswerLength;
      }
    }
  }

  return (
    <LandingView
      demoMode={env.DEMO_MODE}
      signedIn={identity?.kind === "user"}
      recentThreads={recentThreads}
      exampleQueries={[...EXAMPLE_QUERIES]}
      defaultMode={defaultMode}
      defaultAnswerLength={defaultAnswerLength}
    />
  );
}
