"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookMarked, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client/api";
import { MODE_CONFIGS } from "@/lib/config/modes";
import {
  SEARCH_MODES,
  type SearchMode,
  type SpaceRecord,
  type ThreadRecord,
} from "@/lib/core/types";
import { formatRelativeTime } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";

type DateFilter = "any" | "day" | "week" | "month";

const DATE_FILTERS: Array<{ value: DateFilter; label: string }> = [
  { value: "any", label: "Any time" },
  { value: "day", label: "Past 24 hours" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
];

function sinceFor(filter: DateFilter): string | undefined {
  if (filter === "any") return undefined;
  const days = filter === "day" ? 1 : filter === "week" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function LibraryView() {
  const router = useRouter();
  const [threads, setThreads] = React.useState<ThreadRecord[]>([]);
  const [spaces, setSpaces] = React.useState<SpaceRecord[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<SearchMode | "all">("all");
  const [savedOnly, setSavedOnly] = React.useState(false);
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("any");
  const [spaceFilter, setSpaceFilter] = React.useState<string>("all");
  const [renameTarget, setRenameTarget] = React.useState<ThreadRecord | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<ThreadRecord | null>(null);

  const buildParams = React.useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams({ limit: "20" });
      if (query.trim()) params.set("query", query.trim());
      if (mode !== "all") params.set("mode", mode);
      if (savedOnly) params.set("savedOnly", "true");
      const since = sinceFor(dateFilter);
      if (since) params.set("since", since);
      if (spaceFilter !== "all") params.set("spaceId", spaceFilter);
      if (cursor) params.set("cursor", cursor);
      return params;
    },
    [query, mode, savedOnly, dateFilter, spaceFilter],
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const page = await api.listThreads(buildParams());
      setThreads(page.threads);
      setNextCursor(page.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  React.useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  React.useEffect(() => {
    api
      .listSpaces()
      .then(({ spaces }) => setSpaces(spaces))
      .catch(() => setSpaces([]));
  }, []);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await api.listThreads(buildParams(nextCursor));
      setThreads((prev) => [...prev, ...page.threads]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const patchThread = (updated: ThreadRecord) =>
    setThreads((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  const toggleSave = async (thread: ThreadRecord) => {
    const { thread: updated } = await api.updateThread(thread.id, {
      isSaved: !thread.isSaved,
    });
    patchThread(updated);
  };

  const moveToSpace = async (thread: ThreadRecord, spaceId: string | null) => {
    const { thread: updated } = await api.updateThread(thread.id, { spaceId });
    patchThread(updated);
  };

  const confirmRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    const { thread: updated } = await api.updateThread(renameTarget.id, {
      title: renameValue.trim(),
    });
    patchThread(updated);
    setRenameTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await api.deleteThread(deleteTarget.id);
    setThreads((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="mx-auto max-w-4xl py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl text-cream-50">Library</h1>
        <p className="mt-1 text-sm text-graphite-300">
          Every search you have run, searchable and filterable.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your threads…"
            aria-label="Search threads"
            className="pl-9"
            data-testid="library-search"
          />
        </div>

        <label className="sr-only" htmlFor="library-mode">
          Filter by mode
        </label>
        <select
          id="library-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as SearchMode | "all")}
          className="h-10 rounded-xl border border-graphite-700 bg-graphite-900 px-3 text-sm text-cream-100"
        >
          <option value="all">All modes</option>
          {SEARCH_MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_CONFIGS[m].label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="library-date">
          Filter by date
        </label>
        <select
          id="library-date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="h-10 rounded-xl border border-graphite-700 bg-graphite-900 px-3 text-sm text-cream-100"
        >
          {DATE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {spaces.length > 0 && (
          <>
            <label className="sr-only" htmlFor="library-space">
              Filter by workspace
            </label>
            <select
              id="library-space"
              value={spaceFilter}
              onChange={(e) => setSpaceFilter(e.target.value)}
              className="h-10 rounded-xl border border-graphite-700 bg-graphite-900 px-3 text-sm text-cream-100"
            >
              <option value="all">All workspaces</option>
              <option value="null">No workspace</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </>
        )}

        <Button
          variant={savedOnly ? "primary" : "outline"}
          size="sm"
          aria-pressed={savedOnly}
          onClick={() => setSavedOnly((v) => !v)}
          data-testid="filter-saved"
        >
          <BookMarked className="h-3.5 w-3.5" aria-hidden="true" />
          Saved
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading threads">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-card border border-dashed border-graphite-700 py-16 text-center">
          <p className="text-sm text-graphite-300">
            {query || savedOnly || mode !== "all" || dateFilter !== "any"
              ? "No threads match these filters."
              : "No research yet. Ask your first question to start a thread."}
          </p>
          <Button variant="primary" className="mt-4" onClick={() => router.push("/")}>
            Start searching
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-graphite-800 overflow-hidden rounded-card border border-graphite-800 bg-graphite-900/60">
          {threads.map((thread) => (
            <li
              key={thread.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-graphite-850"
              data-testid="library-thread"
            >
              <Link href={`/thread/${thread.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm text-cream-100">
                  {thread.title}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-graphite-400">
                  {formatRelativeTime(thread.updatedAt)}
                  <Badge tone="neutral">{MODE_CONFIGS[thread.searchMode].label}</Badge>
                  {thread.isSaved && <Badge tone="amber">Saved</Badge>}
                  {thread.spaceId && (
                    <Badge tone="success">
                      {spaces.find((s) => s.id === thread.spaceId)?.name ?? "Workspace"}
                    </Badge>
                  )}
                </span>
              </Link>

              <Dropdown>
                <DropdownTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Actions for ${thread.title}`}
                    data-testid="library-thread-menu"
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownTrigger>
                <DropdownContent>
                  <DropdownItem onSelect={() => void toggleSave(thread)}>
                    {thread.isSaved ? "Unsave" : "Save"}
                  </DropdownItem>
                  <DropdownItem
                    onSelect={() => {
                      setRenameTarget(thread);
                      setRenameValue(thread.title);
                    }}
                  >
                    Rename
                  </DropdownItem>
                  {spaces.length > 0 && <DropdownSeparator />}
                  {spaces.map((space) => (
                    <DropdownItem
                      key={space.id}
                      disabled={thread.spaceId === space.id}
                      onSelect={() => void moveToSpace(thread, space.id)}
                    >
                      Move to “{space.name}”
                    </DropdownItem>
                  ))}
                  {thread.spaceId && (
                    <DropdownItem onSelect={() => void moveToSpace(thread, null)}>
                      Remove from workspace
                    </DropdownItem>
                  )}
                  <DropdownSeparator />
                  <DropdownItem destructive onSelect={() => setDeleteTarget(thread)}>
                    Delete
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>
            </li>
          ))}
        </ul>
      )}

      {nextCursor && !loading && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Load more
          </Button>
        </div>
      )}

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent title="Rename thread">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirmRename();
            }}
            className="space-y-3"
          >
            <label htmlFor="library-rename" className="sr-only">
              Thread title
            </label>
            <Input
              id="library-rename"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value.slice(0, 200))}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={!renameValue.trim()}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent
          title="Delete this thread?"
          description="The question, answers and sources will be permanently removed."
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
