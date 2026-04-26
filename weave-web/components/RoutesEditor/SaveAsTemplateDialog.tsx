"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FeedbackRule, Route } from "@/lib/api";
import { createTemplate, type Template } from "@/lib/templates";
import { SERVICE_DOMAIN } from "./vocab";

// Modal that captures a label + description for a new user template, then
// POSTs to `/api/templates` with the live rules + feedback as the body.
// Domain and icon are derived from the mapping's `service_type` —
// templates are scoped to a domain so the same template list can be reused
// across mappings of the same shape (any Roon zone, any Hue light).
//
// Icon picker is intentionally not exposed yet; templates carry only the
// derived domain glyph until the broader template-management UI ships.

const DOMAIN_ICON: Record<Template["domain"], string> = {
  playback: "play",
  light: "bulb",
  generic: "press",
};

const DOMAIN_LABEL: Record<Template["domain"], string> = {
  playback: "Playback",
  light: "Light",
  generic: "Generic",
};

const LABEL_MAX = 60;

export interface SaveAsTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  /** Current draft of routes + feedback that will become the template body. */
  routes: Route[];
  feedback: FeedbackRule[];
  /** The mapping's service_type — used to derive the domain
   *  ("playback" | "light" | "generic") via SERVICE_DOMAIN. */
  serviceType: string;
  /** Called after a successful POST. Parent should refresh the templates list. */
  onCreated: (created: Template) => void;
}

export function SaveAsTemplateDialog({
  open,
  onClose,
  routes,
  feedback,
  serviceType,
  onCreated,
}: SaveAsTemplateDialogProps) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset form on each false→true transition of `open` so reopening the
  // dialog presents a clean form without leaking state from the prior
  // session. Uses the render-time previous-state comparison pattern from
  // React docs ("You Might Not Need an Effect") to avoid the
  // setState-in-effect lint rule.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setLabel("");
      setDescription("");
      setError(null);
      setSaving(false);
    }
  }

  const domain: Template["domain"] = SERVICE_DOMAIN[serviceType] ?? "generic";
  const icon = DOMAIN_ICON[domain];
  const trimmedLabel = label.trim();
  const canSave = trimmedLabel.length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const created = await createTemplate({
        label: trimmedLabel,
        description: description.trim(),
        icon,
        domain,
        routes,
        feedback,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogTitle>Save as template</DialogTitle>
      <DialogBody>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Name
              <span className="ml-1 text-zinc-400">·</span>
              <span className="ml-1 font-mono text-[11px] text-zinc-400">
                {trimmedLabel.length}/{LABEL_MAX}
              </span>
            </span>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, LABEL_MAX))}
              placeholder="Kitchen-style"
              maxLength={LABEL_MAX}
              autoFocus
              required
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Description
              <span className="ml-1 text-[11px] font-normal text-zinc-400">
                (optional)
              </span>
            </span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this template do? e.g. rotate→volume · long_press→mute"
              rows={2}
              resizable={false}
            />
          </label>
          <div className="rounded-md bg-zinc-50 px-3 py-2 text-[12px] text-zinc-600 dark:bg-white/5 dark:text-zinc-300">
            <span className="font-medium text-zinc-800 dark:text-zinc-100">
              Domain:
            </span>{" "}
            {DOMAIN_LABEL[domain]}
            <span className="ml-2 text-zinc-400 dark:text-zinc-500">
              ({routes.length} {routes.length === 1 ? "route" : "routes"} ·{" "}
              {feedback.length} {feedback.length === 1 ? "rule" : "rules"})
            </span>
          </div>
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          )}
        </div>
      </DialogBody>
      <DialogActions>
        <Button outline onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button color="blue" onClick={handleSave} disabled={!canSave}>
          {saving ? "Saving…" : "Save template"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
