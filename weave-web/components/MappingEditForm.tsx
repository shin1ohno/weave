"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createMapping,
  deleteMapping,
  getMapping,
  updateMapping,
  type FeedbackRule,
  type Mapping,
  type Route,
  type TargetCandidate,
} from "@/lib/api";
import { useUIState, useUIDispatch } from "@/lib/ws";
import { FeedbackSection } from "@/components/FeedbackSection";
import { TargetCandidatesSection } from "@/components/TargetCandidatesSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Label } from "@/components/ui/fieldset";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

export const INPUT_TYPES = [
  "rotate",
  "press",
  "release",
  "long_press",
  "swipe_up",
  "swipe_down",
  "swipe_left",
  "swipe_right",
  "slide",
  "hover",
  "touch_top",
  "touch_bottom",
  "touch_left",
  "touch_right",
  "key_press",
];

// Intent optgroups — presented in this order. "Other" catches any intent
// that appears at runtime but isn't listed here, so the union of the Select
// still accepts arbitrary server-defined intents without dropping them.
const INTENT_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Playback",
    items: ["play", "pause", "play_pause", "stop", "next", "previous"],
  },
  {
    label: "Continuous",
    items: [
      "volume_change",
      "volume_set",
      "brightness_change",
      "brightness_set",
      "seek_relative",
      "seek_absolute",
    ],
  },
  {
    label: "Toggle",
    items: ["mute", "unmute", "power_toggle", "power_on", "power_off"],
  },
];

export const INTENT_TYPES = INTENT_GROUPS.flatMap((g) => g.items);

const DEFAULT_NEW_ROUTES: Route[] = [
  { input: "rotate", intent: "volume_change", params: { damping: 80 } },
  { input: "press", intent: "play_pause" },
  { input: "swipe_right", intent: "next" },
  { input: "swipe_left", intent: "previous" },
];

const DEVICE_TYPES = ["nuimo"];
const SERVICE_TYPES = ["roon", "hue"];

type Mode = { kind: "new" } | { kind: "edit"; mappingId: string };
type Variant = "drawer" | "full";

interface Props {
  mode: Mode;
  /** Called after a successful save. The host decides whether to close the
   *  drawer (`router.back()`) or navigate away (`router.push("/")`). */
  onSaved: () => void;
  /** Heading string. Defaults: "New mapping" / "Edit mapping". */
  title?: string;
  /** Optional cancel handler. If provided, renders a Cancel button next to Save. */
  onCancel?: () => void;
  /** Layout variant. `drawer` hides the heading, sticks the footer, and
   *  uses a single column for the 32rem-wide drawer panel. */
  variant?: Variant;
}

export function MappingEditForm({
  mode,
  onSaved,
  title,
  onCancel,
  variant = "full",
}: Props) {
  const state = useUIState();
  const dispatch = useUIDispatch();

  const [mapping, setMapping] = useState<Mapping | null>(() =>
    mode.kind === "new" ? newMappingDraft() : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Snapshot captured once on load — used to detect concurrent server-side
  // changes at Save time (optimistic lock).
  const baselineRef = useRef<Mapping | null>(
    mode.kind === "new" ? null : null
  );
  const [conflict, setConflict] = useState<Mapping | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit mode: load once. Deliberately NOT re-syncing on `state.mappings`
  // change — that would silently clobber the user's in-progress draft if
  // the server broadcast updates this mapping while the form is open.
  // Concurrent changes are surfaced as a conflict banner on Save instead.
  useEffect(() => {
    if (mode.kind !== "edit") return;
    const fromLive = state.mappings.find(
      (m) => m.mapping_id === mode.mappingId
    );
    if (fromLive) {
      setMapping(fromLive);
      baselineRef.current = deepClone(fromLive);
      return;
    }
    let cancelled = false;
    getMapping(mode.mappingId)
      .then((m) => {
        if (cancelled) return;
        setMapping(m);
        baselineRef.current = deepClone(m);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.kind === "edit" ? mode.mappingId : null]);

  const knownTargets = useMemo(() => {
    if (!mapping) return [];
    const metaProperty =
      mapping.service_type === "hue" ? "light" : "zone";
    return state.serviceStates
      .filter(
        (s) =>
          s.service_type === mapping.service_type &&
          s.property === metaProperty
      )
      .map((s) => ({
        target: s.target,
        label:
          (s.value as { display_name?: string } | undefined)?.display_name ??
          s.target,
      }))
      .filter((v, i, a) => a.findIndex((x) => x.target === v.target) === i);
  }, [state.serviceStates, mapping]);

  const knownEdges = useMemo(
    () => state.edges.map((e) => e.edge_id).sort(),
    [state.edges]
  );
  const knownDevices = useMemo(() => {
    if (!mapping) return [];
    return state.deviceStates
      .filter((d) => d.device_type === mapping.device_type)
      .map((d) => d.device_id)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
  }, [state.deviceStates, mapping]);

  if (error && !mapping) return <Text className="text-red-600">{error}</Text>;
  if (!mapping) return <Text>Loading…</Text>;

  const updateField = <K extends keyof Mapping>(key: K, value: Mapping[K]) => {
    setMapping({ ...mapping, [key]: value });
  };

  const updateRoute = (i: number, next: Route) => {
    const routes = [...mapping.routes];
    routes[i] = next;
    setMapping({ ...mapping, routes });
  };
  const removeRoute = (i: number) => {
    setMapping({
      ...mapping,
      routes: mapping.routes.filter((_, idx) => idx !== i),
    });
  };
  const addRoute = () => {
    setMapping({
      ...mapping,
      routes: [...mapping.routes, { input: "press", intent: "play" }],
    });
  };
  const moveRoute = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= mapping.routes.length) return;
    const next = [...mapping.routes];
    [next[i], next[j]] = [next[j], next[i]];
    setMapping({ ...mapping, routes: next });
  };

  const persistSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode.kind === "edit") {
        dispatch({ kind: "local_upsert_mapping", mapping });
        await updateMapping(mode.mappingId, mapping);
      } else {
        const created = await createMapping({
          edge_id: mapping.edge_id,
          device_type: mapping.device_type,
          device_id: mapping.device_id,
          service_type: mapping.service_type,
          service_target: mapping.service_target,
          routes: mapping.routes,
          feedback: mapping.feedback,
          active: mapping.active,
          target_candidates: mapping.target_candidates,
          target_switch_on: mapping.target_switch_on,
        });
        dispatch({ kind: "local_upsert_mapping", mapping: created });
      }
      baselineRef.current = deepClone(mapping);
      setConflict(null);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (mode.kind === "edit" && baselineRef.current) {
      const live = state.mappings.find(
        (m) => m.mapping_id === mode.mappingId
      );
      if (live && !sameMapping(live, baselineRef.current)) {
        setConflict(live);
        return;
      }
    }
    await persistSave();
  };

  const handleReloadFromLive = () => {
    if (!conflict) return;
    setMapping(conflict);
    baselineRef.current = deepClone(conflict);
    setConflict(null);
  };

  const handleDeleteConfirm = async () => {
    if (mode.kind !== "edit") return;
    setDeleting(true);
    setDeleteError(null);
    dispatch({ kind: "local_delete_mapping", id: mode.mappingId });
    try {
      await deleteMapping(mode.mappingId);
      setDeleteOpen(false);
      onSaved();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const isDrawer = variant === "drawer";
  const isEdit = mode.kind === "edit";

  return (
    <div className="flex flex-col">
      <div className="space-y-5 pb-28">
        {/* Header strip */}
        <div className="flex flex-wrap items-center gap-4">
          {!isDrawer && (
            <Heading className="mr-auto">
              {title ?? (isEdit ? "Edit mapping" : "New mapping")}
            </Heading>
          )}
          <div className={`flex items-center gap-2 ${isDrawer ? "ml-auto" : ""}`}>
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
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
              className="!text-red-600"
            >
              Delete
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {conflict && (
          <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200">
            <div className="font-medium">
              Server updated this mapping since you started.
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
              <Button plain onClick={() => setConflict(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {/* Target section */}
        <Card title="Target">
          <TargetBlock
            mapping={mapping}
            knownTargets={knownTargets}
            updateField={updateField}
            variant={variant}
            mode={mode}
          />
        </Card>

        {/* Routes section — primary use case */}
        <Card title="Routes" action={
          <Button type="button" plain onClick={addRoute}>
            + Add route
          </Button>
        }>
          {mapping.routes.length === 0 && (
            <Text>
              No routes yet. Add one to route a device input to an intent.
            </Text>
          )}
          {mapping.routes.map((route, i) => (
            <RouteRow
              key={i}
              index={i}
              total={mapping.routes.length}
              route={route}
              onChange={(next) => updateRoute(i, next)}
              onRemove={() => removeRoute(i)}
              onMove={(dir) => moveRoute(i, dir)}
            />
          ))}
        </Card>

        {/* Target candidates */}
        <CollapsibleSection
          id="candidates"
          variant={variant}
          mode={mode}
          summary={candidateSummary(mapping)}
          heading="Switch-mode candidates"
        >
          <TargetCandidatesSection
            candidates={mapping.target_candidates ?? []}
            switchOn={mapping.target_switch_on ?? null}
            onCandidatesChange={(next: TargetCandidate[]) =>
              updateField("target_candidates", next)
            }
            onSwitchOnChange={(next: string | null) =>
              updateField("target_switch_on", next)
            }
            serviceType={mapping.service_type}
            serviceTarget={mapping.service_target}
          />
        </CollapsibleSection>

        {/* Feedback */}
        <CollapsibleSection
          id="feedback"
          variant={variant}
          mode={mode}
          summary={feedbackSummary(mapping)}
          heading="Feedback"
        >
          <FeedbackSection
            feedback={mapping.feedback}
            onChange={(next: FeedbackRule[]) => updateField("feedback", next)}
            serviceType={mapping.service_type}
            serviceTarget={mapping.service_target}
          />
        </CollapsibleSection>

        {/* Identity (advanced) */}
        <CollapsibleSection
          id="identity"
          variant={variant}
          mode={mode}
          summary={identitySummary(mapping)}
          heading="Identity (advanced)"
        >
          <IdentityBlock
            mapping={mapping}
            mode={mode}
            knownEdges={knownEdges}
            knownDevices={knownDevices}
            updateField={updateField}
          />
        </CollapsibleSection>
      </div>

      {/* Footer */}
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
            {saving ? "Saving…" : isEdit ? "Save" : "Create mapping"}
          </Button>
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
        <DialogTitle>Delete this mapping?</DialogTitle>
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
          <Button color="red" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

// --- Sub-components -----------------------------------------------------

function Card({
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

function TargetBlock({
  mapping,
  knownTargets,
  updateField,
  variant,
  mode,
}: {
  mapping: Mapping;
  knownTargets: { target: string; label: string }[];
  updateField: <K extends keyof Mapping>(key: K, value: Mapping[K]) => void;
  variant: Variant;
  mode: Mode;
}) {
  const isKnown = knownTargets.some(
    (t) => t.target === mapping.service_target
  );
  // Preference is nullable: `null` means "infer from the live list"; once
  // the user explicitly toggles it we honor their choice until they toggle
  // again. Kept out of an effect so the lint rule about set-state-in-effect
  // stays green.
  const [userPrefersRaw, setUserPrefersRaw] = useState<boolean | null>(null);
  const mustUseRaw =
    knownTargets.length === 0 ||
    (mapping.service_target !== "" && !isKnown);
  const useRaw = userPrefersRaw ?? mustUseRaw;

  const isNew = mode.kind === "new";

  return (
    <div
      className={`grid gap-4 ${
        variant === "full" ? "sm:grid-cols-2" : "grid-cols-1"
      }`}
    >
      <Field>
        <Label>Service Type</Label>
        {isNew ? (
          <Select
            value={mapping.service_type}
            onChange={(e) => updateField("service_type", e.target.value)}
          >
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={mapping.service_type}
            readOnly
            className="font-mono"
            aria-readonly
          />
        )}
      </Field>

      <Field>
        <Label>Service Target</Label>
        {!useRaw && knownTargets.length > 0 ? (
          <Select
            value={mapping.service_target}
            onChange={(e) => updateField("service_target", e.target.value)}
          >
            <option value="">— pick —</option>
            {knownTargets.map((t) => (
              <option key={t.target} value={t.target}>
                {t.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={mapping.service_target}
            onChange={(e) => updateField("service_target", e.target.value)}
            className="font-mono"
          />
        )}
        <div className="mt-1 flex items-center gap-2 text-xs">
          {knownTargets.length > 0 && (
            <button
              type="button"
              onClick={() => setUserPrefersRaw(!useRaw)}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {useRaw ? "← pick from list" : "use raw value"}
            </button>
          )}
          {knownTargets.length === 0 && (
            <span className="text-zinc-500 dark:text-zinc-400">
              No live targets — enter a raw value.
            </span>
          )}
        </div>
      </Field>
    </div>
  );
}

function IdentityBlock({
  mapping,
  mode,
  knownEdges,
  knownDevices,
  updateField,
}: {
  mapping: Mapping;
  mode: Mode;
  knownEdges: string[];
  knownDevices: string[];
  updateField: <K extends keyof Mapping>(key: K, value: Mapping[K]) => void;
}) {
  const isNew = mode.kind === "new";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field>
        <Label>Edge ID</Label>
        <Input
          value={mapping.edge_id}
          onChange={(e) => updateField("edge_id", e.target.value)}
          list="mapping-edges"
          placeholder="living-room"
        />
        <datalist id="mapping-edges">
          {knownEdges.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </Field>
      <Field>
        <Label>Device Type</Label>
        {isNew ? (
          <Select
            value={mapping.device_type}
            onChange={(e) => updateField("device_type", e.target.value)}
          >
            {DEVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={mapping.device_type}
            readOnly
            className="font-mono"
            aria-readonly
          />
        )}
      </Field>
      <Field>
        <Label>Device ID</Label>
        <Input
          value={mapping.device_id}
          onChange={(e) => updateField("device_id", e.target.value)}
          list="mapping-devices"
          placeholder="C3:81:DF:4E:FF:6A"
        />
        <datalist id="mapping-devices">
          {knownDevices.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </Field>
    </div>
  );
}

function RouteRow({
  index,
  total,
  route,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  total: number;
  route: Route;
  onChange: (next: Route) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const isRotate = route.input === "rotate";
  const damping =
    typeof route.params?.damping === "number" ? route.params.damping : 1;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-40">
        <Select
          value={route.input}
          onChange={(e) => onChange({ ...route, input: e.target.value })}
          aria-label="Input"
        >
          {INPUT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <span className="text-zinc-400">→</span>
      <div className="min-w-44">
        <Select
          value={route.intent}
          onChange={(e) => onChange({ ...route, intent: e.target.value })}
          aria-label="Intent"
        >
          {INTENT_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((it) => (
                <option key={it} value={it}>
                  {it}
                </option>
              ))}
            </optgroup>
          ))}
          {/* Catch-all for server-defined intents outside the curated groups */}
          {!INTENT_TYPES.includes(route.intent) && (
            <option value={route.intent}>{route.intent}</option>
          )}
        </Select>
      </div>
      <div className="w-24">
        <Input
          type="number"
          value={damping}
          disabled={!isRotate}
          onChange={(e) =>
            onChange({
              ...route,
              params: { damping: Number(e.target.value) },
            })
          }
          title={
            isRotate ? "Damping factor" : "Damping applies only to `rotate`"
          }
          aria-label="Damping"
          className={!isRotate ? "opacity-60" : undefined}
        />
      </div>
      <Button
        type="button"
        plain
        onClick={() => onMove(-1)}
        disabled={index === 0}
        title="Move up"
      >
        ↑
      </Button>
      <Button
        type="button"
        plain
        onClick={() => onMove(1)}
        disabled={index === total - 1}
        title="Move down"
      >
        ↓
      </Button>
      <Button
        type="button"
        plain
        onClick={onRemove}
        className="!text-red-600"
      >
        ✕
      </Button>
    </div>
  );
}

function CollapsibleSection({
  id,
  variant,
  mode,
  summary,
  heading,
  children,
}: {
  id: string;
  variant: Variant;
  mode: Mode;
  summary: string;
  heading: string;
  children: ReactNode;
}) {
  // Persist open/closed per-section across reloads. Keyed by section id so
  // candidates and feedback track independently. The initial value is true
  // (expanded) — users opt *into* compactness by collapsing.
  const storageKey = `weave:edit:collapse:${id}`;
  const [open, setOpen] = usePersistedBool(storageKey, true);

  // New mappings always render expanded: a creating user needs context.
  // Full-page edit also renders expanded for scanability on a wide viewport.
  const forceOpen = mode.kind === "new" || variant === "full";
  const effectiveOpen = forceOpen ? true : open;

  const toggle = useCallback(() => {
    if (forceOpen) return;
    setOpen(!effectiveOpen);
  }, [forceOpen, effectiveOpen, setOpen]);

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

// --- Helpers ------------------------------------------------------------

// Module-scope listener set so multiple `usePersistedBool` subscribers for
// the same key stay in sync within the same tab (the browser's native
// `storage` event only fires across tabs).
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
  // `useSyncExternalStore` handles SSR (via `getServerSnapshot`) and avoids
  // the "setState in effect" lint violation that the simpler
  // useState+useEffect pattern would trigger.
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
        // Ignore localStorage failures (private mode, quota, etc.)
      }
      notifyPersistedBool();
    },
    [key]
  );
  return [value, set];
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

function sameMapping(a: Mapping, b: Mapping): boolean {
  return JSON.stringify(normalizeMapping(a)) ===
    JSON.stringify(normalizeMapping(b));
}

function normalizeMapping(m: Mapping): Mapping {
  // Strip undefined optional fields so absent vs null/undefined doesn't
  // trigger a spurious conflict.
  return {
    mapping_id: m.mapping_id,
    edge_id: m.edge_id,
    device_type: m.device_type,
    device_id: m.device_id,
    service_type: m.service_type,
    service_target: m.service_target,
    routes: m.routes,
    feedback: m.feedback,
    active: m.active,
    target_candidates: m.target_candidates ?? [],
    target_switch_on: m.target_switch_on ?? null,
  };
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function newMappingDraft(): Mapping {
  return {
    mapping_id: "",
    edge_id: "",
    device_type: "nuimo",
    device_id: "",
    service_type: "roon",
    service_target: "",
    routes: DEFAULT_NEW_ROUTES,
    feedback: [],
    active: true,
    target_candidates: [],
    target_switch_on: null,
  };
}
