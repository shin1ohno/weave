"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createMapping,
  deleteMapping,
  getMapping,
  updateMapping,
  type Mapping,
  type Route,
} from "@/lib/api";
import { useUIDispatch, useUIState } from "@/lib/ws";

export type DraftMode = { kind: "new" } | { kind: "edit"; mappingId: string };

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
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

function sameMapping(a: Mapping, b: Mapping): boolean {
  return (
    JSON.stringify(normalizeMapping(a)) ===
    JSON.stringify(normalizeMapping(b))
  );
}

const DEFAULT_NEW_ROUTES: Route[] = [
  { input: "rotate", intent: "volume_change", params: { damping: 80 } },
  { input: "press", intent: "play_pause" },
  { input: "swipe_right", intent: "next" },
  { input: "swipe_left", intent: "previous" },
];

export function newMappingDraft(overrides: Partial<Mapping> = {}): Mapping {
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
    ...overrides,
  };
}

export interface UseMappingDraft {
  mapping: Mapping | null;
  loadError: string | null;
  /** True iff the in-memory `mapping` differs from the load-time
   *  baseline. False when there's no baseline yet (still loading). */
  dirty: boolean;
  setMapping: (next: Mapping) => void;
  updateField: <K extends keyof Mapping>(key: K, value: Mapping[K]) => void;

  // Route helpers
  addRoute: (route?: Route) => void;
  updateRoute: (index: number, next: Route) => void;
  removeRoute: (index: number) => void;
  moveRoute: (index: number, dir: -1 | 1) => void;
  replaceRoutes: (routes: Route[]) => void;

  // Save / delete state
  saving: boolean;
  saveError: string | null;
  conflict: Mapping | null;
  handleSave: () => Promise<void>;
  persistSave: () => Promise<void>;
  handleReloadFromLive: () => void;
  dismissConflict: () => void;

  deleting: boolean;
  deleteError: string | null;
  handleDelete: () => Promise<void>;
}

/** Core state + side-effect controller for the mapping editor. Extracted
 * from MappingEditForm so both the legacy full-page form and the new
 * ConnectionCard inline-expand share identical save / conflict / delete
 * semantics.
 *
 * Responsibilities:
 * - Load the mapping (new → seeded draft, edit → fetch+cache baseline)
 * - Optimistic-lock: capture a baseline snapshot on load, diff against the
 *   live server state at Save time, surface `conflict` when another client
 *   has changed the same row
 * - Create/update/delete with local_upsert_mapping / local_delete_mapping
 *   dispatches so the rest of the UI reflects the change immediately
 *
 * Deliberately NOT handled here: UI layout, field-level validation,
 * CollapsibleSection state. Those live in the presentational components. */
export function useMappingDraft(
  mode: DraftMode,
  opts: { onSaved: () => void; newDefaults?: Partial<Mapping> } = {
    onSaved: () => {},
  }
): UseMappingDraft {
  const state = useUIState();
  const dispatch = useUIDispatch();
  const { onSaved, newDefaults } = opts;

  const [mapping, setMappingState] = useState<Mapping | null>(() =>
    mode.kind === "new" ? newMappingDraft(newDefaults) : null
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Mapping | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const baselineRef = useRef<Mapping | null>(null);

  // Edit mode: seed from cached live state if present, else fetch. Snapshot
  // is captured only at load time — later server broadcasts do NOT
  // overwrite the in-progress draft; the conflict check at save time is the
  // point of reconciliation.
  useEffect(() => {
    if (mode.kind !== "edit") return;
    const cached = state.mappings.find((m) => m.mapping_id === mode.mappingId);
    if (cached) {
      setMappingState(cached);
      baselineRef.current = deepClone(cached);
      return;
    }
    let cancelled = false;
    getMapping(mode.mappingId)
      .then((m) => {
        if (cancelled) return;
        setMappingState(m);
        baselineRef.current = deepClone(m);
      })
      .catch((e) => {
        if (!cancelled) setLoadError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
    // intentionally narrow — don't re-fetch on state.mappings churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.kind === "edit" ? mode.mappingId : null]);

  const setMapping = useCallback((next: Mapping) => setMappingState(next), []);

  const updateField = useCallback(
    <K extends keyof Mapping>(key: K, value: Mapping[K]) => {
      setMappingState((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    []
  );

  const replaceRoutes = useCallback((routes: Route[]) => {
    setMappingState((prev) => (prev ? { ...prev, routes } : prev));
  }, []);

  const addRoute = useCallback(
    (route: Route = { input: "press", intent: "play" }) => {
      setMappingState((prev) =>
        prev ? { ...prev, routes: [...prev.routes, route] } : prev
      );
    },
    []
  );

  const updateRoute = useCallback((index: number, next: Route) => {
    setMappingState((prev) => {
      if (!prev) return prev;
      const routes = [...prev.routes];
      routes[index] = next;
      return { ...prev, routes };
    });
  }, []);

  const removeRoute = useCallback((index: number) => {
    setMappingState((prev) =>
      prev
        ? { ...prev, routes: prev.routes.filter((_, i) => i !== index) }
        : prev
    );
  }, []);

  const moveRoute = useCallback((index: number, dir: -1 | 1) => {
    setMappingState((prev) => {
      if (!prev) return prev;
      const j = index + dir;
      if (j < 0 || j >= prev.routes.length) return prev;
      const next = [...prev.routes];
      [next[index], next[j]] = [next[j], next[index]];
      return { ...prev, routes: next };
    });
  }, []);

  const persistSave = useCallback(async () => {
    if (!mapping) return;
    setSaving(true);
    setSaveError(null);
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
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [mapping, mode, dispatch, onSaved]);

  const handleSave = useCallback(async () => {
    if (!mapping) return;
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
  }, [mapping, mode, state.mappings, persistSave]);

  const handleReloadFromLive = useCallback(() => {
    if (!conflict) return;
    setMappingState(conflict);
    baselineRef.current = deepClone(conflict);
    setConflict(null);
  }, [conflict]);

  const dismissConflict = useCallback(() => setConflict(null), []);

  const handleDelete = useCallback(async () => {
    if (mode.kind !== "edit") return;
    setDeleting(true);
    setDeleteError(null);
    dispatch({ kind: "local_delete_mapping", id: mode.mappingId });
    try {
      await deleteMapping(mode.mappingId);
      onSaved();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }, [mode, dispatch, onSaved]);

  const dirty =
    mapping != null &&
    baselineRef.current != null &&
    !sameMapping(mapping, baselineRef.current);

  return useMemo(
    () => ({
      mapping,
      loadError,
      dirty,
      setMapping,
      updateField,
      addRoute,
      updateRoute,
      removeRoute,
      moveRoute,
      replaceRoutes,
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
    }),
    [
      mapping,
      loadError,
      dirty,
      setMapping,
      updateField,
      addRoute,
      updateRoute,
      removeRoute,
      moveRoute,
      replaceRoutes,
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
    ]
  );
}
