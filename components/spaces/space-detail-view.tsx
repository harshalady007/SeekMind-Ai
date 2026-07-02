"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Search, Settings2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchComposer } from "@/components/search/composer";
import { api } from "@/lib/client/api";
import { MODE_CONFIGS } from "@/lib/config/modes";
import type {
  NewsTimeRange,
  SearchMode,
  SpaceRecord,
  ThreadRecord,
} from "@/lib/core/types";
import { formatRelativeTime } from "@/lib/utils";

export function SpaceDetailView({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const [space, setSpace] = React.useState<SpaceRecord | null>(null);
  const [threads, setThreads] = React.useState<ThreadRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("");
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const data = await api.getSpace(spaceId);
      setSpace(data.space);
      setThreads(data.threads);
      setName(data.space.name);
      setDescription(data.space.description);
      setInstructions(data.space.customInstructions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspace.");
    } finally {
      setLoading(false);
    }
  }, [spaceId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const saveEdits = async () => {
    if (!name.trim()) return;
    setPending(true);
    try {
      const { space: updated } = await api.updateSpace(spaceId, {
        name: name.trim(),
        description: description.trim(),
        customInstructions: instructions.trim(),
      });
      setSpace(updated);
      setEditOpen(false);
    } finally {
      setPending(false);
    }
  };

  const removeSpace = async () => {
    setPending(true);
    try {
      await api.deleteSpace(spaceId);
      router.push("/spaces");
    } finally {
      setPending(false);
    }
  };

  const removeThread = async (thread: ThreadRecord) => {
    await api.updateThread(thread.id, { spaceId: null });
    setThreads((prev) => prev.filter((t) => t.id !== thread.id));
  };

  const startSearch = (input: {
    query: string;
    mode: SearchMode;
    timeRange?: NewsTimeRange;
  }) => {
    const params = new URLSearchParams({
      q: input.query,
      mode: input.mode,
      len: "balanced",
      spaceId,
    });
    if (input.timeRange) params.set("range", input.timeRange);
    router.push(`/thread/new?${params.toString()}`);
  };

  const visibleThreads = filter.trim()
    ? threads.filter((t) => t.title.toLowerCase().includes(filter.trim().toLowerCase()))
    : threads;

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 py-8" aria-busy="true">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-danger" aria-hidden="true" />
        <h1 className="mt-3 font-display text-xl text-cream-50">Workspace unavailable</h1>
        <p className="mt-2 text-sm text-graphite-300">{error}</p>
        <Button variant="primary" className="mt-6" onClick={() => router.push("/spaces")}>
          Back to spaces
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl text-cream-50" data-testid="space-title">
            {space.name}
          </h1>
          {space.description && (
            <p className="mt-1 text-sm text-graphite-300">{space.description}</p>
          )}
          {space.customInstructions && (
            <p className="mt-2 rounded-xl border border-amber-glow/25 bg-amber-glow/5 px-3 py-2 text-xs text-amber-soft">
              Instructions applied to searches here: “{space.customInstructions}”
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            data-testid="edit-space"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            data-testid="delete-space"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </header>

      <section aria-label="Search in this workspace" className="mb-8">
        <SearchComposer
          onSubmit={startSearch}
          placeholder={`Ask within “${space.name}”…`}
        />
      </section>

      <section aria-label="Workspace threads">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-graphite-300">
            Threads <span className="text-graphite-400">({threads.length})</span>
          </h2>
          <div className="relative w-56">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-graphite-400"
              aria-hidden="true"
            />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter threads…"
              aria-label="Search within workspace threads"
              className="h-9 pl-8 text-xs"
            />
          </div>
        </div>

        {visibleThreads.length === 0 ? (
          <div className="rounded-card border border-dashed border-graphite-700 py-12 text-center text-sm text-graphite-300">
            {threads.length === 0
              ? "No threads yet. Run a search above, or move threads here from the Library."
              : "No threads match that filter."}
          </div>
        ) : (
          <ul className="divide-y divide-graphite-800 overflow-hidden rounded-card border border-graphite-800 bg-graphite-900/60">
            {visibleThreads.map((thread) => (
              <li
                key={thread.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-graphite-850"
                data-testid="space-thread"
              >
                <Link href={`/thread/${thread.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-cream-100">
                    {thread.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-graphite-400">
                    {formatRelativeTime(thread.updatedAt)}
                    <Badge tone="neutral">{MODE_CONFIGS[thread.searchMode].label}</Badge>
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void removeThread(thread)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent title="Edit space">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveEdits();
            }}
            className="space-y-3"
          >
            <div>
              <label
                htmlFor="edit-space-name"
                className="mb-1 block text-sm text-cream-300"
              >
                Name
              </label>
              <Input
                id="edit-space-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 100))}
                data-testid="edit-space-name"
              />
            </div>
            <div>
              <label
                htmlFor="edit-space-description"
                className="mb-1 block text-sm text-cream-300"
              >
                Description
              </label>
              <Input
                id="edit-space-description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              />
            </div>
            <div>
              <label
                htmlFor="edit-space-instructions"
                className="mb-1 block text-sm text-cream-300"
              >
                Custom AI instructions
              </label>
              <Textarea
                id="edit-space-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value.slice(0, 4000))}
                rows={3}
                data-testid="edit-space-instructions"
              />
              <p className="mt-1 text-xs text-graphite-400">
                Applied to every new search launched from this workspace.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={pending || !name.trim()}>
                Save changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          title="Delete this space?"
          description="Threads inside it are kept — they just leave the workspace."
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void removeSpace()}
              disabled={pending}
            >
              Delete space
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
