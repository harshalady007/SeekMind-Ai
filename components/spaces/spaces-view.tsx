"use client";

import * as React from "react";
import Link from "next/link";
import { FlaskConical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client/api";
import type { SpaceRecord } from "@/lib/core/types";
import { formatRelativeTime } from "@/lib/utils";

export function SpacesView() {
  const [spaces, setSpaces] = React.useState<SpaceRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [instructions, setInstructions] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    api
      .listSpaces()
      .then(({ spaces }) => setSpaces(spaces))
      .finally(() => setLoading(false));
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    setPending(true);
    try {
      const { space } = await api.createSpace({
        name: name.trim(),
        description: description.trim(),
        customInstructions: instructions.trim(),
      });
      setSpaces((prev) => [space, ...prev]);
      setCreateOpen(false);
      setName("");
      setDescription("");
      setInstructions("");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cream-50">Spaces</h1>
          <p className="mt-1 text-sm text-graphite-300">
            Workspaces group related threads and steer new searches with custom
            instructions.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setCreateOpen(true)}
          data-testid="create-space"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New space
        </Button>
      </header>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : spaces.length === 0 ? (
        <div className="rounded-card border border-dashed border-graphite-700 py-16 text-center">
          <FlaskConical
            className="mx-auto h-8 w-8 text-graphite-400"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm text-graphite-300">
            No spaces yet. Create one to organize a research project.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {spaces.map((space) => (
            <li key={space.id}>
              <Link
                href={`/spaces/${space.id}`}
                data-testid="space-card"
                className="block h-full rounded-card border border-graphite-700 bg-graphite-900 p-4 transition-colors hover:border-amber-glow/50"
              >
                <h2 className="font-display text-lg text-cream-50">{space.name}</h2>
                {space.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-graphite-300">
                    {space.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-graphite-400">
                  Updated {formatRelativeTime(space.updatedAt)}
                  {space.customInstructions && " · Custom instructions active"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          title="Create a space"
          description="Threads in a space share its custom AI instructions."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="space-name" className="mb-1 block text-sm text-cream-300">
                Name
              </label>
              <Input
                id="space-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 100))}
                placeholder="e.g. Battery research"
                data-testid="space-name-input"
                autoFocus
              />
            </div>
            <div>
              <label
                htmlFor="space-description"
                className="mb-1 block text-sm text-cream-300"
              >
                Description <span className="text-graphite-400">(optional)</span>
              </label>
              <Input
                id="space-description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                placeholder="What is this workspace for?"
              />
            </div>
            <div>
              <label
                htmlFor="space-instructions"
                className="mb-1 block text-sm text-cream-300"
              >
                Custom AI instructions{" "}
                <span className="text-graphite-400">(optional)</span>
              </label>
              <Textarea
                id="space-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value.slice(0, 4000))}
                rows={3}
                placeholder="e.g. Prefer peer-reviewed sources. Always mention sample sizes."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={pending || !name.trim()}
                data-testid="space-create-confirm"
              >
                Create space
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
