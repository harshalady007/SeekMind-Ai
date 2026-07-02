"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MODE_CONFIGS } from "@/lib/config/modes";
import {
  ANSWER_LENGTHS,
  SEARCH_MODES,
  type AnswerLength,
  type ProfileRecord,
  type SearchMode,
} from "@/lib/core/types";

interface UsageResponse {
  searchesToday: number;
  dailyLimit: number;
  totalThreads: number;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

const LENGTH_LABELS: Record<AnswerLength, string> = {
  concise: "Concise — quick reads",
  balanced: "Balanced — the default",
  detailed: "Detailed — full reports",
};

export function SettingsView({ email }: { email: string | null }) {
  const router = useRouter();
  const [profile, setProfile] = React.useState<ProfileRecord | null>(null);
  const [usage, setUsage] = React.useState<UsageResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    void Promise.all([
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/usage").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([profileData, usageData]) => {
        if (profileData?.profile) setProfile(profileData.profile as ProfileRecord);
        if (usageData) setUsage(usageData as UsageResponse);
      })
      .finally(() => setLoading(false));
  }, []);

  const patch = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      const data = (await response.json()) as { profile: ProfileRecord };
      setProfile(data.profile);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    }
  };

  const deleteAllData = async () => {
    setDeleting(true);
    try {
      await fetch("/api/profile", { method: "DELETE" });
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-8" aria-busy="true">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="font-display text-2xl text-cream-50">Settings</h1>
      <p aria-live="polite" className="mt-1 h-4 text-xs text-success">
        {savedFlash ? "Saved." : ""}
      </p>

      <section
        aria-labelledby="profile-heading"
        className="mt-6 rounded-card border border-graphite-800 bg-graphite-900/60 p-5"
      >
        <h2 id="profile-heading" className="font-display text-lg text-cream-50">
          Profile
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-graphite-300">Email</dt>
            <dd className="text-cream-100">{email ?? "—"}</dd>
          </div>
        </dl>
        <div className="mt-3">
          <label htmlFor="display-name" className="mb-1 block text-sm text-graphite-300">
            Display name
          </label>
          <div className="flex gap-2">
            <Input
              id="display-name"
              defaultValue={profile?.displayName ?? ""}
              maxLength={100}
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value !== (profile?.displayName ?? "")) {
                  void patch({ displayName: value || null });
                }
              }}
            />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="defaults-heading"
        className="mt-4 rounded-card border border-graphite-800 bg-graphite-900/60 p-5"
      >
        <h2 id="defaults-heading" className="font-display text-lg text-cream-50">
          Search defaults
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="default-mode"
              className="mb-1 block text-sm text-graphite-300"
            >
              Default search mode
            </label>
            <select
              id="default-mode"
              value={profile?.defaultMode ?? "quick"}
              onChange={(e) => void patch({ defaultMode: e.target.value as SearchMode })}
              data-testid="default-mode"
              className="h-10 w-full rounded-xl border border-graphite-700 bg-graphite-900 px-3 text-sm text-cream-100"
            >
              {SEARCH_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_CONFIGS[mode].label} — {MODE_CONFIGS[mode].description}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="default-length"
              className="mb-1 block text-sm text-graphite-300"
            >
              Default answer length
            </label>
            <select
              id="default-length"
              value={profile?.defaultAnswerLength ?? "balanced"}
              onChange={(e) =>
                void patch({ defaultAnswerLength: e.target.value as AnswerLength })
              }
              className="h-10 w-full rounded-xl border border-graphite-700 bg-graphite-900 px-3 text-sm text-cream-100"
            >
              {ANSWER_LENGTHS.map((length) => (
                <option key={length} value={length}>
                  {LENGTH_LABELS[length]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-graphite-400">
          Theme: DeepFind ships in its graphite dark theme; a light theme is on the
          roadmap and this preference will live here.
        </p>
      </section>

      <section
        aria-labelledby="usage-heading"
        className="mt-4 rounded-card border border-graphite-800 bg-graphite-900/60 p-5"
      >
        <h2 id="usage-heading" className="font-display text-lg text-cream-50">
          API usage
        </h2>
        {usage ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-graphite-400">Searches today</dt>
              <dd className="mt-0.5 text-lg text-cream-50">
                {usage.searchesToday}
                <span className="text-xs text-graphite-400"> / {usage.dailyLimit}</span>
              </dd>
            </div>
            <div>
              <dt className="text-graphite-400">Threads</dt>
              <dd className="mt-0.5 text-lg text-cream-50">{usage.totalThreads}</dd>
            </div>
            <div>
              <dt className="text-graphite-400">Input tokens</dt>
              <dd className="mt-0.5 text-lg text-cream-50">
                {usage.tokenUsage.inputTokens.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-graphite-400">Output tokens</dt>
              <dd className="mt-0.5 text-lg text-cream-50">
                {usage.tokenUsage.outputTokens.toLocaleString()}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-graphite-300">Usage data unavailable.</p>
        )}
      </section>

      <section
        aria-labelledby="danger-heading"
        className="mt-4 rounded-card border border-danger/30 bg-danger/5 p-5"
      >
        <h2 id="danger-heading" className="font-display text-lg text-danger">
          Data controls
        </h2>
        <p className="mt-2 text-sm text-graphite-300">
          Delete all threads, sources, workspaces and profile data associated with this
          account. This cannot be undone.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="danger"
            onClick={() => setDeleteOpen(true)}
            data-testid="delete-data"
          >
            Delete all my data
          </Button>
          <Button variant="outline" onClick={signOut} data-testid="settings-sign-out">
            Sign out
          </Button>
        </div>
      </section>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          title="Delete all data?"
          description="Every thread, source, workspace and preference tied to this account will be permanently removed, and you will be signed out."
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void deleteAllData()}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Yes, delete everything"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
