"use client";

import {
  useCallback,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { Plus, Settings, X } from "@/components/icon";
import { useMappingDraft, type DraftMode } from "@/hooks/useMappingDraft";
import {
  createMapping,
  type FeedbackRule,
  type Mapping,
} from "@/lib/api";
import { summarizeDevices } from "@/lib/devices";
import { summarizeServices } from "@/lib/services";
import {
  useFiringMappingIds,
  useLastInputByDevice,
  useTemplates,
  useDispatchTemplates,
  useUIState,
} from "@/lib/ws";
import {
  deleteTemplate as apiDeleteTemplate,
  listTemplates,
  type Template,
} from "@/lib/templates";
import { feedbackTemplatesFor } from "./vocab";
import { ConnHeader } from "./ConnHeader";
import { FeedbackTemplatePicker } from "./FeedbackTemplatePicker";
import { IdentityBlock } from "./IdentityBlock";
import { RuleSentence } from "./RuleSentence";
import { SaveAsTemplateDialog } from "./SaveAsTemplateDialog";
import { TargetBlock } from "./TargetBlock";
import { TemplateCard } from "./TemplateCard";
import { TryFooter } from "./TryFooter";

export type RoutesEditorVariant = "full" | "drawer" | "inline";

interface Props {
  mode: DraftMode;
  onSaved: () => void;
  onCancel?: () => void;
  title?: string;
  variant?: RoutesEditorVariant;
  newDefaults?: Partial<Mapping>;
}

/** D2 "conversation builder" Routes editor.
 *
 *  Single-column layout for all variants — the outer container is
 *  `max-w-[860px]` and the parent drawer / page / card handles its own
 *  positioning. Sections from top to bottom:
 *
 *    1. ConnHeader    — device → target visual + dirty + Cancel/Save
 *    2. Templates row — Built-in 4 + Yours N + "Save as template" card
 *    3. Rules         — RuleSentence per route (+ duplicate detection)
 *    4. Advanced      — Target switching sentence + Feedback templates
 *    5. TryFooter     — live firing trace + ⌘ Enter / esc kbd hints
 *
 *  Data plumbing reuses `useMappingDraft` (conflict / save / delete),
 *  `useFiringMappingIds` (live `hot` highlight), `useLastInputByDevice`
 *  (live value badge), and the new `useTemplates` (templates list +
 *  setter for create/delete). New-mapping mode also surfaces TargetBlock
 *  for picking service + target before the rest of the form makes sense.
 *  Identity (edge_id / device_type / device_id) lives in a default-closed
 *  collapsible because the d2 design hides it; advanced users still need
 *  the escape hatch. */
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
    dirty,
    updateField,
    replaceRoutes,
    addRoute,
    updateRoute,
    removeRoute,
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

  const isEdit = mode.kind === "edit";
  const isDrawer = variant === "drawer";

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [openTplMenu, setOpenTplMenu] = useState<string | null>(null);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [showFeedbackPicker, setShowFeedbackPicker] = useState(false);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(
    null,
  );

  const templates = useTemplates();
  const setTemplates = useDispatchTemplates();
  const firingMappingIds = useFiringMappingIds();
  const lastInputByDevice = useLastInputByDevice();
  const { deviceStates, mappings, serviceStates } = useUIState();

  if (loadError && !mapping)
    return <Text className="text-red-600">{loadError}</Text>;
  if (!mapping) return <Text>Loading…</Text>;

  const devices = summarizeDevices(deviceStates, mappings);
  const device =
    devices.find(
      (d) =>
        d.device_id === mapping.device_id && d.edge_id === mapping.edge_id,
    ) ?? null;

  const services = summarizeServices(serviceStates, mappings);
  const target =
    services
      .find((s) => s.type === mapping.service_type)
      ?.targets.find((t) => t.target === mapping.service_target) ?? null;
  const targetLabel = target?.label ?? mapping.service_target ?? "—";

  // Live firing — the dispatcher only fires for known mappings, so we
  // gate per-mapping. The chip-level `hot` is the gesture name; the
  // value badge wants a string ("+5") only when the value is scalar.
  const isFiringNow = isEdit && firingMappingIds.has(mapping.mapping_id);
  const lastInput = lastInputByDevice[mapping.device_id] ?? null;
  const hot = isFiringNow && lastInput ? lastInput.input : null;
  const lastValue =
    hot && lastInput && lastInput.value !== undefined && lastInput.value !== null && typeof lastInput.value !== "object"
      ? String(lastInput.value)
      : null;

  // Stable per-route ids for picker keying. We synthesize from index when
  // the server payload doesn't already carry them (it doesn't — Route is
  // positional). That's stable enough since add/remove/move all reset
  // the ids together.
  const ruleRows = mapping.routes.map((route, idx) => ({
    ...route,
    id: `r${idx}`,
  }));

  const dupeIds = (() => {
    const counts: Record<string, number> = {};
    for (const r of mapping.routes) counts[r.input] = (counts[r.input] ?? 0) + 1;
    return new Set(
      ruleRows.filter((r) => (counts[r.input] ?? 0) > 1).map((r) => r.id),
    );
  })();

  const builtinTemplates = templates.filter((t) => t.builtin);
  const userTemplates = templates.filter((t) => !t.builtin);

  // Apply a template: replace routes + feedback. The active template id
  // is local UI state — it visually marks the chosen card but doesn't
  // persist (matching d2's transient highlight).
  const applyTemplate = (t: Template) => {
    replaceRoutes(t.routes);
    updateField("feedback", t.feedback);
    setAppliedTemplateId(t.id);
  };

  const usedFeedbackIds = new Set(
    mapping.feedback.map((f) => f.feedback_type),
  );
  const removeFeedback = (feedbackType: string) => {
    updateField(
      "feedback",
      mapping.feedback.filter((f) => f.feedback_type !== feedbackType),
    );
  };
  const addFeedbackFromTemplate = (tpl: {
    state: string;
    feedback_type: string;
  }) => {
    const next: FeedbackRule[] = [
      ...mapping.feedback,
      {
        state: tpl.state,
        feedback_type: tpl.feedback_type,
        mapping: {},
      },
    ];
    updateField("feedback", next);
  };

  const confirmDelete = async () => {
    await handleDelete();
    if (!deleteError) setDeleteOpen(false);
  };

  const handleDuplicate = async () => {
    if (!isEdit) return;
    setDuplicating(true);
    setDuplicateError(null);
    try {
      const { mapping_id: _ignored, ...rest } = mapping;
      void _ignored;
      await createMapping(rest);
    } catch (err) {
      setDuplicateError(err instanceof Error ? err.message : String(err));
    } finally {
      setDuplicating(false);
    }
  };

  const handleTemplateDelete = async (t: Template) => {
    await apiDeleteTemplate(t.id);
    const refreshed = await listTemplates();
    setTemplates(refreshed);
    setOpenTplMenu(null);
  };

  // Outer container — same shape for all variants. Drawer parent already
  // owns slide animation + max-width; using `mx-auto max-w-[860px]` here
  // is a no-op for narrower parents and centers the editor on full-page.
  const containerClass = clsx(
    "mx-auto w-full max-w-[860px] overflow-hidden rounded-2xl border bg-white shadow-xl shadow-zinc-900/5 dark:bg-zinc-900 dark:shadow-black/40",
    "border-zinc-950/5 dark:border-white/10",
    isDrawer && "shadow-none",
  );

  // For new-mapping mode we still need the user to pick a service/target
  // before the sentences make sense. Show a TargetBlock at the top above
  // ConnHeader's device→target visual (which would otherwise render with
  // a placeholder).
  const showTargetBlock = mode.kind === "new";

  return (
    <div className={containerClass}>
      <ConnHeader
        device={device}
        targetLabel={targetLabel}
        serviceType={mapping.service_type}
        dirty={dirty}
        saving={saving || conflict !== null}
        onSave={handleSave}
        onCancel={onCancel ?? (() => undefined)}
      />

      {(saveError || duplicateError || conflict) && (
        <div className="space-y-2 px-5 pt-3">
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
                Reload to discard your edits and adopt the server state, or
                save anyway to overwrite.
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
        </div>
      )}

      {showTargetBlock && (
        <div className="border-b border-zinc-950/5 px-5 py-4 dark:border-white/10">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Pick a target
          </h3>
          <TargetBlock
            mapping={mapping}
            onUpdate={updateField}
            mode={mode.kind}
            layout={variant}
          />
        </div>
      )}

      {/* Templates */}
      <div className="border-b border-zinc-950/5 bg-zinc-50/50 px-5 py-3 dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Apply a template
          </span>
          <span className="text-[11px] text-zinc-400">
            applying replaces the current rules · you can edit afterwards
          </span>
        </div>
        {builtinTemplates.length > 0 && (
          <>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Built-in
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {builtinTemplates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  selected={appliedTemplateId === t.id}
                  onClick={() => applyTemplate(t)}
                  openMenu={openTplMenu}
                  setOpenMenu={setOpenTplMenu}
                />
              ))}
            </div>
          </>
        )}
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          Yours
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {userTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              selected={appliedTemplateId === t.id}
              onClick={() => applyTemplate(t)}
              openMenu={openTplMenu}
              setOpenMenu={setOpenTplMenu}
              onDelete={handleTemplateDelete}
            />
          ))}
          <TemplateCard
            template={{ id: "__new__" }}
            onSaveAsNew={() => setShowSaveAsTemplate(true)}
          />
        </div>
      </div>

      {/* Rules */}
      <div className="space-y-2 p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Rules{" "}
            <span className="ml-1 font-normal normal-case text-zinc-400">
              {ruleRows.length}
            </span>
          </h3>
          <span className="text-[11px] text-zinc-400">
            read top-to-bottom · first match wins
          </span>
        </div>
        {ruleRows.length === 0 ? (
          <Text className="rounded-xl border border-dashed border-zinc-300 bg-white py-6 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            No rules yet — apply a template or click <em>Add another rule</em>{" "}
            below.
          </Text>
        ) : (
          ruleRows.map((r, idx) => (
            <RuleSentence
              key={r.id}
              route={r}
              hot={hot}
              lastValue={hot === r.input ? lastValue : null}
              openPicker={openPicker}
              setOpenPicker={setOpenPicker}
              onUpdate={(next) => {
                const { id: _id, ...rest } = next;
                void _id;
                updateRoute(idx, rest);
              }}
              onRemove={() => removeRoute(idx)}
              onParamChange={(damping) =>
                updateRoute(idx, { ...r, params: { ...r.params, damping } })
              }
              duplicate={dupeIds.has(r.id)}
              deviceType={mapping.device_type}
            />
          ))
        )}
        <button
          type="button"
          onClick={() => addRoute()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-2.5 text-[13px] font-medium text-zinc-500 transition hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600 dark:border-zinc-700 dark:hover:bg-blue-500/10"
        >
          <Plus className="h-3 w-3" />
          Add another rule
        </button>
      </div>

      {/* Advanced — always visible. Target switching has moved to the
          DeviceTile's CycleSection (device-level cycle of multiple
          Connections). The per-Connection target_switch_on /
          target_candidates pair is retired. */}
      <div className="space-y-4 border-t border-zinc-950/5 bg-zinc-50/40 p-5 dark:border-white/10 dark:bg-white/[0.02]">
        <section>
          <div className="mb-1.5 flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Feedback on the device{" "}
              <span className="ml-1 font-normal normal-case text-zinc-400">
                show what&apos;s happening on the LED matrix
              </span>
            </h3>
            <span className="text-[11px] text-zinc-400">
              {mapping.feedback.length} active
            </span>
          </div>
          <div className="space-y-2">
            {mapping.feedback.map((f) => {
              const tpl = feedbackTemplatesFor(mapping.service_type).find(
                (t) => t.feedback_type === f.feedback_type,
              );
              const label = tpl?.label ?? f.feedback_type;
              return (
                <div
                  key={f.feedback_type}
                  className="group/fb flex items-center gap-3 rounded-xl border border-zinc-950/10 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-zinc-900"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <Settings className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                      {label}
                    </div>
                    <div className="font-mono text-[10px] text-zinc-500">
                      on{" "}
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {f.state}
                      </span>{" "}
                      change →{" "}
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {f.feedback_type}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFeedback(f.feedback_type)}
                    aria-label="Remove feedback"
                    className="rounded p-1 text-zinc-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover/fb:opacity-100 dark:hover:bg-rose-500/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFeedbackPicker(!showFeedbackPicker)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 py-2 text-[13px] font-medium text-zinc-500 hover:border-emerald-400 hover:bg-emerald-50/40 hover:text-emerald-700 dark:border-zinc-700 dark:hover:bg-emerald-500/10"
              >
                <Plus className="h-3 w-3" />
                Add feedback
              </button>
              {showFeedbackPicker && (
                <div className="absolute left-1/2 top-full z-30 mt-1.5 -translate-x-1/2">
                  <FeedbackTemplatePicker
                    serviceType={mapping.service_type}
                    used={usedFeedbackIds}
                    onPick={(tpl) => {
                      addFeedbackFromTemplate(tpl);
                      setShowFeedbackPicker(false);
                    }}
                    onClose={() => setShowFeedbackPicker(false)}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <CollapsibleSection
          id="identity"
          mode={mode.kind}
          heading="Identity (advanced)"
          summary={`${mapping.edge_id || "(no edge)"} · ${mapping.device_type}/${
            mapping.device_id || "?"
          }`}
          defaultOpen={false}
        >
          <IdentityBlock
            mapping={mapping}
            onUpdate={updateField}
            mode={mode.kind}
          />
        </CollapsibleSection>

        {isEdit && (
          <div className="flex items-center justify-end gap-2 border-t border-zinc-950/5 pt-4 dark:border-white/10">
            <Button
              plain
              onClick={handleDuplicate}
              disabled={duplicating}
              title="Create a copy of this connection"
            >
              {duplicating ? "Duplicating…" : "Duplicate"}
            </Button>
            <Button
              plain
              onClick={() => setDeleteOpen(true)}
              className="!text-red-600"
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      <TryFooter hot={hot} lastValue={lastValue} recentTarget={targetLabel} />

      {/* Save-as-template modal */}
      <SaveAsTemplateDialog
        open={showSaveAsTemplate}
        onClose={() => setShowSaveAsTemplate(false)}
        routes={mapping.routes}
        feedback={mapping.feedback}
        serviceType={mapping.service_type}
        onCreated={(created) => {
          setTemplates([...templates, created]);
          setShowSaveAsTemplate(false);
        }}
      />

      {/* Delete confirmation */}
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
      {/* Suppress unused-prop warnings — title is accepted for parent
          contracts but the new layout uses ConnHeader for visual identity. */}
      {title ? null : null}
    </div>
  );
}

// --- Identity collapsible (default closed) ----------------------------

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
  defaultValue: boolean,
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
    getServerSnapshot,
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
    [key],
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
  mode: "new" | "edit";
  heading: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const storageKey = `weave:edit:collapse:${id}`;
  const [open, setOpen] = usePersistedBool(storageKey, defaultOpen);

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
