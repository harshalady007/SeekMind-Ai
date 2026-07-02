"use client";

import * as React from "react";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Link2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
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
import { api } from "@/lib/client/api";
import { MODE_CONFIGS } from "@/lib/config/modes";
import type { ThreadRecord } from "@/lib/core/types";

export function ThreadToolbar({
  thread,
  onChanged,
  onDeleted,
  onRegenerate,
  busy,
}: {
  thread: ThreadRecord & { shareToken: string | null };
  onChanged: () => void;
  onDeleted: () => void;
  onRegenerate: () => void;
  busy: boolean;
}) {
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [title, setTitle] = React.useState(thread.title);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [copiedShare, setCopiedShare] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setTitle(thread.title), [thread.title]);

  const toggleSave = async () => {
    setPending(true);
    try {
      await api.updateThread(thread.id, { isSaved: !thread.isSaved });
      onChanged();
    } finally {
      setPending(false);
    }
  };

  const rename = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setPending(true);
    try {
      await api.updateThread(thread.id, { title: trimmed });
      setRenameOpen(false);
      onChanged();
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    setPending(true);
    try {
      await api.deleteThread(thread.id);
      onDeleted();
    } finally {
      setPending(false);
    }
  };

  const openShare = async () => {
    setShareOpen(true);
    if (thread.isPublic && thread.shareToken) {
      setShareUrl(`${window.location.origin}/share/${thread.shareToken}`);
      return;
    }
    const { shareToken } = await api.shareThread(thread.id);
    setShareUrl(`${window.location.origin}/share/${shareToken}`);
    onChanged();
  };

  const copyShare = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 1500);
  };

  const unshare = async () => {
    await api.unshareThread(thread.id);
    setShareUrl(null);
    setShareOpen(false);
    onChanged();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-graphite-800 bg-graphite-900/60 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Badge tone="amber">{MODE_CONFIGS[thread.searchMode].label}</Badge>
        {thread.isPublic && <Badge tone="success">Shared</Badge>}
        <span className="truncate text-sm text-graphite-300" data-testid="thread-title">
          {thread.title}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSave}
          disabled={pending}
          aria-pressed={thread.isSaved}
          data-testid="save-thread"
        >
          {thread.isSaved ? (
            <>
              <BookmarkCheck className="h-4 w-4 text-amber-glow" aria-hidden="true" />
              Saved
            </>
          ) : (
            <>
              <Bookmark className="h-4 w-4" aria-hidden="true" />
              Save
            </>
          )}
        </Button>

        <Button variant="ghost" size="sm" onClick={openShare} data-testid="share-thread">
          <Link2 className="h-4 w-4" aria-hidden="true" />
          Share
        </Button>

        <Dropdown>
          <DropdownTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="More thread actions"
              data-testid="thread-menu"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem
              onSelect={() => setRenameOpen(true)}
              data-testid="rename-thread"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Rename
            </DropdownItem>
            <DropdownItem onSelect={onRegenerate} disabled={busy}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Regenerate answer
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              destructive
              onSelect={() => setDeleteOpen(true)}
              data-testid="delete-thread"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete thread
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent title="Rename thread">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void rename();
            }}
            className="space-y-3"
          >
            <label htmlFor="thread-title-input" className="sr-only">
              Thread title
            </label>
            <Input
              id="thread-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              data-testid="rename-input"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={pending || !title.trim()}
                data-testid="rename-save"
              >
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          title="Delete this thread?"
          description="The question, answers and sources will be permanently removed."
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={remove}
              disabled={pending}
              data-testid="confirm-delete"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent
          title="Share thread"
          description="Anyone with this link can read the thread. The link is unguessable; unsharing invalidates it."
        >
          {shareUrl ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareUrl}
                  aria-label="Share link"
                  data-testid="share-url"
                />
                <Button variant="primary" onClick={copyShare} data-testid="copy-share">
                  {copiedShare ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    "Copy"
                  )}
                </Button>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={unshare}
                  data-testid="unshare"
                >
                  Stop sharing
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-graphite-300">Creating link…</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
