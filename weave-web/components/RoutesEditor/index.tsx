"use client";

import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMappingDraft, type DraftMode } from "@/hooks/useMappingDraft";
import { useTryIt } from "@/hooks/useTryIt";
import type { Mapping } from "@/lib/api";
import { PresetChips } from "./PresetChips";
import { RoutesList } from "./RoutesList";
import { TargetBlock } from "./TargetBlock";
import { IdentityBlock } from "./IdentityBlock";
import { TargetSwitchingBox } from "./TargetSwitchingBox";
import { FeedbackRail } from "./FeedbackRail";

export type RoutesEditorVariant = "full" | "drawer" | "inline";

interface Props {
  mode: DraftMode;
  onSaved: () => void;
  onCancel?: () => void;
  title?: string;
  variant?: RoutesEditorVariant;
  /** Optional field defaults for mode=new (pre-selected device / target). */
  newDefaults?: Partial<Mapping>;
}

/** The new Connections-first routes editor. Layout adapts per variant:
 *   - full: two-column blocks, sticky footer pinned to content width
 *   - drawer: single-column, footer stuck to drawer bottom
 *   - inline: single-column, compact, rendered inside an expanded
 *             ConnectionCard; footer lives inline (not sticky)
 *
 * Shares state plumbing with both via `useMappingDraft`, so conflict
 * detection, optimistic local updates, and delete semantics match the
 * legacy full-page form exactly. */
export function RoutesEditor({
  mode,
  onSaved,
  onCancel,
  title,
  variant = "full",
  newDefaults,
}: Props) {
  const draft = useMappingDraft(mode, { onSaved, newDefaults });
  const {
    mapping,
    loadError,
    updateField,
    replaceRoutes,
    addRoute,
    updateRoute,
    removeRoute,
    moveRoute,
    saving,
    saveError,
    conflict,
    handleSave,
    persistSave,
    handleReloadFromLive,
    dismissConflict,
    deleting,
    deleteError,
    handleDelete,
  } = draft;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const isEdit = mode.kind === "edit";
  const tryIt = useTryIt();

  if (loadError && !mapping)
    return <Text className="text-red-600">{loadError}</Text>;
  if (!mapping) return <Text>Loading…</Text>;

  const confirmDelete = async () => {
    await handleDelete();
    if (!deleteError) setDeleteOpen(false);
  };

  return (
    <div className="flex flex-col">
      <div className={variant === "drawer" ? "space-y-5 pb-28" : "space-y-5"}>
        {/* Header strip */}
        <div className="flex flex-wrap items-center gap-4">
          {variant === "full" && (
            <Heading className="mr-auto">
              {title ?? (isEdit ? "Edit connection" : "New connection")}
            </Heading>
          )}
          {variant !== "full" && title && (
            <h3 className="mr-auto text-base font-semibold text-zinc-950 dark:text-white">
              {title}
            </h3>
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500 dark:text-zinc-400">
              active
            </label>
            <Switch
              checked={mapping.active}
              onChange={(checked) => updateField("active", checked)}
              aria-label="Active"
            />
          </div>
          {isEdit && (
            <Button
              plain
              onClick={() => setDeleteOpen(true)}
              className="!text-red-600"
            >
              Delete
            </Button>
          )}
        </div>

        {saveError && (
          <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {saveError}
          </div>
        )}

        {conflict && (
          <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
            <div className="font-medium">
              Server updated this connection since you started.
            </div>
            <div className="mt-1 text-xs">
              Reload to discard your edits and adopt the server state, or save
              anyway to overwrite.
            </div>
            <div className="mt-2 flex gap-2">
              <Button plain onClick={handleReloadFromLive}>
                Reload
              </Button>
              <Button color="red" onClick={persistSave} disabled={saving}>
                {saving ? "Saving…" : "Save anyway"}
              </Button>
              <Button plain onClick={dismissConflict}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Target */}
        <Section title="Target">
          <TargetBlock
            mapping={mapping}
            onUpdate={updateField}
            mode={mode.kind}
            layout={variant}
          />
        </Section>

        {/* Routes — the primary act */}
        <Section
          title="Routes"
          action={
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              first match wins — order matters
            </span>
          }
        >
          <div className="space-y-4">
            <PresetChips
              onApply={replaceRoutes}
              currentRoutes={mapping.routes}
            />
            <RoutesList
              routes={mapping.routes}
              onUpdate={updateRoute}
              onRemove={removeRoute}
              onMove={moveRoute}
              onAdd={() => addRoute()}
            />
          </div>
        </Section>

        {/* Target switching */}
        <CollapsibleSection
          id="target-switching"
          variant={variant}
          mode={mode.kind}
          heading="Target switching (advanced)"
          summary={candidateSummary(mapping)}
        >
          <TargetSwitchingBox mapping={mapping} onUpdate={updateField} />
        </CollapsibleSection>

        {/* Feedback */}
        <CollapsibleSection
          id="feedback"
          variant={variant}
          mode={mode.kind}
          heading="Feedback"
          summary={feedbackSummary(mapping)}
        >
          <FeedbackRail mapping={mapping} onUpdate={updateField} />
        </CollapsibleSection>

        {/* Identity (hidden by default on edit — you rarely change edge_id) */}
        <CollapsibleSection
          id="identity"
          variant={variant}
          mode={mode.kind}
          heading="Identity (advanced)"
          summary={identitySummary(mapping)}
        >
          <IdentityBlock
            mapping={mapping}
            onUpdate={updateField}
            mode={mode.kind}
          />
        </CollapsibleSection>
      </div>

      {/* Footer */}
      <div
        className={
          variant === "drawer"
            ? "sticky bottom-0 -mx-6 border-t border-zinc-950/5 bg-white/90 px-6 py-3 backdrop-blur dark:border-white/10 dark:bg-zinc-900/90"
            : "pt-2"
        }
      >
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saving || conflict !== null}
            color="blue"
          >
            {saving ? "Saving…" : isEdit ? "Save" : "Create connection"}
          </Button>
          {isEdit && mapping && (
            <Button
              type="button"
              color="orange"
              onClick={() => tryIt.openFor(mapping)}
              aria-label="Open Try it panel"
            >
              Try it now
            </Button>
          )}
          {onCancel && (
            <Button type="button" outline onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog
        open={deleteOpen}
        onClose={() => (deleting ? null : setDeleteOpen(false))}
        size="sm"
      >
        <DialogTitle>Delete this connection?</DialogTitle>
        <DialogDescription>
          {mapping.device_type}/{mapping.device_id} → {mapping.service_type}/
          {mapping.service_target || "?"} will be removed. This cannot be
          undone.
        </DialogDescription>
        {deleteError && (
          <DialogBody>
            <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
              {deleteError}
            </div>
          </DialogBody>
        )}
        <DialogActions>
          <Button
            plain
            onClick={() => setDeleteOpen(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button color="red" onClick={confirmDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

// --- Helpers ------------------------------------------------------------

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-950/5 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// Module-scoped listener set for localStorage — the browser's native
// `storage` event only fires across tabs, so we hand-wire in-tab fanout.
const persistedBoolListeners = new Set<() => void>();
function subscribePersistedBool(cb: () => void): () => void {
  persistedBoolListeners.add(cb);
  let offStorage = () => {};
  if (typeof window !== "undefined") {
    const onStorage = (e: StorageEvent) => {
      if (e.key) cb();
    };
    window.addEventListener("storage", onStorage);
    offStorage = () => window.removeEventListener("storage", onStorage);
  }
  return () => {
    persistedBoolListeners.delete(cb);
    offStorage();
  };
}
function notifyPersistedBool(): void {
  for (const cb of persistedBoolListeners) cb();
}

function usePersistedBool(
  key: string,
  defaultValue: boolean
): [boolean, (v: boolean) => void] {
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);
  const getServerSnapshot = useCallback(() => null, []);
  const raw = useSyncExternalStore(
    subscribePersistedBool,
    getSnapshot,
    getServerSnapshot
  );
  const value = raw === null ? defaultValue : raw === "true";
  const set = useCallback(
    (v: boolean) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, v ? "true" : "false");
      } catch {
        // private mode / storage quota — silently ignore
      }
      notifyPersistedBool();
    },
    [key]
  );
  return [value, set];
}

function CollapsibleSection({
  id,
  variant,
  mode,
  heading,
  summary,
  children,
}: {
  id: string;
  variant: RoutesEditorVariant;
  mode: "new" | "edit";
  heading: string;
  summary: string;
  children: ReactNode;
}) {
  const storageKey = `weave:edit:collapse:${id}`;
  const [open, setOpen] = usePersistedBool(storageKey, true);

  // New mappings + full-page always render expanded — context matters most
  // for brand-new authors on a wide viewport. Drawer + inline can collapse
  // to keep the visual footprint tight.
  const forceOpen = mode === "new" || variant === "full";
  const effectiveOpen = forceOpen ? true : open;

  const toggle = () => {
    if (forceOpen) return;
    setOpen(!effectiveOpen);
  };

  return (
    <section className="rounded-lg border border-zinc-950/5 bg-white dark:border-white/10 dark:bg-zinc-900">
      <button
        type="button"
        onClick={toggle}
        disabled={forceOpen}
        aria-expanded={effectiveOpen}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left"
      >
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-zinc-950 dark:text-white">
            {heading}
          </span>
          {!effectiveOpen && summary && (
            <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {summary}
            </span>
          )}
        </div>
        {!forceOpen && (
          <span
            aria-hidden
            className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400"
          >
            {effectiveOpen ? "Hide" : "Show"}
          </span>
        )}
      </button>
      {effectiveOpen && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function candidateSummary(m: Mapping): string {
  const n = m.target_candidates?.length ?? 0;
  if (n === 0) return "No candidates";
  const sw = m.target_switch_on ?? null;
  return `${n} candidate${n === 1 ? "" : "s"}${sw ? ` · switch on ${sw}` : ""}`;
}

function feedbackSummary(m: Mapping): string {
  const n = m.feedback?.length ?? 0;
  if (n === 0) return "No rules";
  const props = m.feedback.map((r) => r.state).filter(Boolean);
  return `${n} rule${n === 1 ? "" : "s"}${
    props.length > 0 ? `: ${props.join(", ")}` : ""
  }`;
}

function identitySummary(m: Mapping): string {
  return `${m.edge_id || "(no edge)"} · ${m.device_type}/${m.device_id || "?"}`;
}
