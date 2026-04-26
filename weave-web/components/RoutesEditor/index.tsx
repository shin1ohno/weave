"use client";

import {
  useCallback,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
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
import {
  ChevronRight,
  Lightbulb,
  Play,
  SERVICE_ICON,
  Volume2,
  Zap,
} from "@/components/icon";
import { useMappingDraft, type DraftMode } from "@/hooks/useMappingDraft";
import { useTryIt } from "@/hooks/useTryIt";
import { createMapping, type Mapping } from "@/lib/api";
import { summarizeDevices } from "@/lib/devices";
import { useUIState } from "@/lib/ws";
import { NuimoViz } from "@/components/ConnectionsView/NuimoViz";
import { FeedbackRail } from "./FeedbackRail";
import { IdentityBlock } from "./IdentityBlock";
import { PresetChips } from "./PresetChips";
import { RoutesList } from "./RoutesList";
import { TargetBlock } from "./TargetBlock";
import { TargetSwitchingBox } from "./TargetSwitchingBox";

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

/** Routes editor. Layout depends on variant:
 *   - full + inline: 2-column (max-w-[880px], `1fr 260px`) with Save/Cancel
 *     in a header strip and a right rail carrying the device mirror + Try
 *     it now + Feedback rules.
 *   - drawer: single column with sticky footer (slide-in width is too
 *     narrow for the 2-column layout to read).
 *
 * Shared `useMappingDraft` plumbing — conflict detection, optimistic
 * local updates, and delete semantics are unchanged. */
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
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const isEdit = mode.kind === "edit";
  const isInline = variant === "inline";
  const isFull = variant === "full";
  const isDrawer = variant === "drawer";
  const useTwoColumn = isFull || isInline;
  const tryIt = useTryIt();
  const { deviceStates, mappings } = useUIState();

  if (loadError && !mapping)
    return <Text className="text-red-600">{loadError}</Text>;
  if (!mapping) return <Text>Loading…</Text>;

  const devices = summarizeDevices(deviceStates, mappings);
  const device =
    devices.find(
      (d) => d.device_id === mapping.device_id && d.edge_id === mapping.edge_id
    ) ?? null;

  const ServiceIcon =
    SERVICE_ICON[mapping.service_type] ??
    (mapping.service_type === "roon"
      ? Play
      : mapping.service_type === "hue"
        ? Lightbulb
        : Volume2);

  const confirmDelete = async () => {
    await handleDelete();
    if (!deleteError) setDeleteOpen(false);
  };

  const handleDuplicate = async () => {
    if (!isEdit) return;
    setDuplicating(true);
    setDuplicateError(null);
    try {
      // Strip the mapping_id; let the server mint a new one.
      const { mapping_id: _, ...rest } = mapping;
      void _;
      await createMapping(rest);
    } catch (err) {
      setDuplicateError(err instanceof Error ? err.message : String(err));
    } finally {
      setDuplicating(false);
    }
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      {isEdit && (
        <Button
          plain
          onClick={handleDuplicate}
          disabled={duplicating}
          title="Create a copy of this connection"
        >
          {duplicating ? "Duplicating…" : "Duplicate"}
        </Button>
      )}
      {onCancel && (
        <Button outline type="button" onClick={onCancel}>
          Cancel
        </Button>
      )}
      <Button
        color="blue"
        onClick={handleSave}
        disabled={saving || conflict !== null}
      >
        {saving ? "Saving…" : isEdit ? "Save" : "Create connection"}
      </Button>
    </div>
  );

  const summary = (
    <div className="flex min-w-0 items-center gap-2 text-[15px] font-semibold text-zinc-950 dark:text-white">
      <span className="truncate">{device?.nickname ?? mapping.device_id}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <ServiceIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      <span className="truncate">{mapping.service_target || "—"}</span>
      <Badge color={mapping.active ? "green" : "zinc"}>
        {mapping.active ? "active" : "inactive"}
      </Badge>
    </div>
  );

  const errorBanner = (
    <>
      {saveError && (
        <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {saveError}
        </div>
      )}
      {duplicateError && (
        <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          Duplicate failed: {duplicateError}
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
    </>
  );

  const showTargetBlock = mode.kind === "new" || isFull;

  const leftColumn = (
    <div className="flex flex-col gap-4">
      {showTargetBlock && (
        <Section title="Target">
          <TargetBlock
            mapping={mapping}
            onUpdate={updateField}
            mode={mode.kind}
            layout={variant}
          />
        </Section>
      )}

      <Section
        title="Preset"
        action={
          <span className="font-mono text-[11px] text-zinc-400">
            start with a template, or skip
          </span>
        }
        compact
      >
        <PresetChips onApply={replaceRoutes} currentRoutes={mapping.routes} />
      </Section>

      <Section
        title={`Routes (${mapping.routes.length})`}
        action={
          <span className="font-mono text-[11px] text-zinc-400">
            ↑↓ reorder · first match wins
          </span>
        }
        compact
      >
        <RoutesList
          routes={mapping.routes}
          onUpdate={updateRoute}
          onRemove={removeRoute}
          onMove={moveRoute}
          onAdd={(input) =>
            addRoute(input ? { input, intent: "play" } : undefined)
          }
        />
      </Section>

      <InlineTargetSwitchingSection mapping={mapping} onUpdate={updateField} />

      <CollapsibleSection
        id="identity"
        variant={variant}
        mode={mode.kind}
        heading="Identity (advanced)"
        summary={identitySummary(mapping)}
        defaultOpen={false}
      >
        <IdentityBlock
          mapping={mapping}
          onUpdate={updateField}
          mode={mode.kind}
        />
      </CollapsibleSection>
    </div>
  );

  const rightRail = (
    <aside className="flex flex-col gap-4">
      <section className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Device preview
        </h3>
        <div className="flex flex-col items-center gap-2 py-2">
          <NuimoViz pattern={device?.led ?? "blank"} size={96} firing={false} />
          <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {device?.nickname ?? mapping.device_id} · live mirror
          </div>
        </div>
        {isEdit && (
          <Button
            color="orange"
              type="button"
            onClick={() => tryIt.openFor(mapping)}
            className="w-full"
          >
            <Zap className="h-3 w-3" />
            Try it now
          </Button>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Feedback
        </h3>
        <FeedbackRail mapping={mapping} onUpdate={updateField} />
      </section>
    </aside>
  );

  if (useTwoColumn) {
    return (
      <div className="mx-auto w-full max-w-[880px] rounded-2xl border border-zinc-950/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
        {/* Header strip */}
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-950/5 px-5 py-3 dark:border-white/10">
          {isFull ? (
            <Heading className="mr-auto">
              {title ?? (isEdit ? "Edit connection" : "New connection")}
            </Heading>
          ) : (
            <div className="mr-auto min-w-0 flex-1">{summary}</div>
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
          {headerActions}
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

        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[1fr_260px]">
          <div className="flex flex-col gap-4">
            {errorBanner}
            {leftColumn}
          </div>
          {rightRail}
        </div>

        {renderDeleteDialog()}
      </div>
    );
  }

  // drawer variant — keep the existing single-column shape with sticky footer.
  return (
    <div className="flex flex-col">
      <div className={isDrawer ? "space-y-5 pb-28" : "space-y-5"}>
        <div className="flex flex-wrap items-center gap-3">
          {title && (
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

        {errorBanner}

        <Section title="Target">
          <TargetBlock
            mapping={mapping}
            onUpdate={updateField}
            mode={mode.kind}
            layout={variant}
          />
        </Section>

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
              onAdd={(input) =>
                addRoute(input ? { input, intent: "play" } : undefined)
              }
            />
          </div>
        </Section>

        <CollapsibleSection
          id="target-switching"
          variant={variant}
          mode={mode.kind}
          heading="Target switching (advanced)"
          summary={candidateSummary(mapping)}
        >
          <TargetSwitchingBox mapping={mapping} onUpdate={updateField} />
        </CollapsibleSection>

        <CollapsibleSection
          id="feedback"
          variant={variant}
          mode={mode.kind}
          heading="Feedback"
          summary={feedbackSummary(mapping)}
        >
          <FeedbackRail mapping={mapping} onUpdate={updateField} />
        </CollapsibleSection>

        <CollapsibleSection
          id="identity"
          variant={variant}
          mode={mode.kind}
          heading="Identity (advanced)"
          summary={identitySummary(mapping)}
          defaultOpen={false}
        >
          <IdentityBlock
            mapping={mapping}
            onUpdate={updateField}
            mode={mode.kind}
          />
        </CollapsibleSection>
      </div>

      <div
        className={
          isDrawer
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
          {isEdit && (
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

      {renderDeleteDialog()}
    </div>
  );

  function renderDeleteDialog() {
    if (!mapping) return null;
    return (
      <Dialog
        open={deleteOpen}
        onClose={() => (deleting ? null : setDeleteOpen(false))}
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
    );
  }
}

// --- Helpers ------------------------------------------------------------

function Section({
  title,
  action,
  children,
  compact,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={
        compact
          ? "space-y-2"
          : "space-y-3 rounded-lg border border-zinc-950/5 bg-white p-4 dark:border-white/10 dark:bg-zinc-900"
      }
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Inline (non-collapsible) target-switching section that stays visible as
 * part of the routes flow — the hi-fi treats this as a peer of the routes
 * list, not as an "advanced" hidden block. */
function InlineTargetSwitchingSection({
  mapping,
  onUpdate,
}: {
  mapping: Mapping;
  onUpdate: <K extends keyof Mapping>(key: K, value: Mapping[K]) => void;
}) {
  return (
    <section className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Target switching{" "}
            <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              advanced
            </span>
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Let a gesture cycle between multiple targets (e.g. swipe_up →
            switch zone)
          </p>
        </div>
      </div>
      <TargetSwitchingBox mapping={mapping} onUpdate={onUpdate} />
    </section>
  );
}

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
  mode,
  heading,
  summary,
  children,
  defaultOpen = true,
}: {
  id: string;
  variant: RoutesEditorVariant;
  mode: "new" | "edit";
  heading: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const storageKey = `weave:edit:collapse:${id}`;
  const [open, setOpen] = usePersistedBool(storageKey, defaultOpen);

  // New mappings always render expanded — context matters most for
  // brand-new authors. Drawer + inline + full all respect localStorage.
  const forceOpen = mode === "new";
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
