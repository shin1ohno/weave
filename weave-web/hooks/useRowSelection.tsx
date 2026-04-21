"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Row selection context — shared across every Row component in the Live
 * Console. `selectedId` is a string keyed per row type (e.g. `edge:air`,
 * `zone:roon:16017ec9...`, `light:hue:0001`, `mapping:<uuid>`). Rows register
 * themselves on mount so that j/k navigation follows visual/insertion order.
 *
 * Per-row metadata (e.g. `primaryMappingId`) is stored so keyboard handlers
 * can run default actions (Enter, `e`) without the row component owning
 * those bindings itself.
 */

export interface RowMeta {
  /** Optional default mapping id for Enter / `e` actions. */
  primaryMappingId?: string;
  /** Optional navigation hint for Enter when no mapping is primary. */
  defaultHref?: string;
}

interface RegisteredRow extends RowMeta {
  id: string;
  /** Monotonic tick captured on registration to preserve insertion order. */
  order: number;
}

interface RowSelectionContextValue {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  registerRow: (id: string, meta: RowMeta) => void;
  unregisterRow: (id: string) => void;
  moveNext: () => void;
  movePrev: () => void;
  /** Look up the registered meta for the selected row. */
  getSelectedMeta: () => RegisteredRow | null;
}

const RowSelectionContext = createContext<RowSelectionContextValue | null>(
  null
);

export function RowSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedIdState] = useState<string | null>(null);

  // Refs so registration does not cause re-renders. The ordered list is
  // rebuilt whenever rows mount/unmount; state downstream is minimal
  // (selectedId only).
  const rowsRef = useRef<Map<string, RegisteredRow>>(new Map());
  const orderCounter = useRef(0);

  const registerRow = useCallback((id: string, meta: RowMeta) => {
    const rows = rowsRef.current;
    const existing = rows.get(id);
    const order = existing ? existing.order : orderCounter.current++;
    rows.set(id, { id, order, ...meta });
  }, []);

  const unregisterRow = useCallback((id: string) => {
    rowsRef.current.delete(id);
  }, []);

  const setSelectedId = useCallback((id: string | null) => {
    setSelectedIdState(id);
  }, []);

  const moveNext = useCallback(() => {
    const ids = Array.from(rowsRef.current.values())
      .sort((a, b) => a.order - b.order)
      .map((r) => r.id);
    if (ids.length === 0) return;
    setSelectedIdState((cur) => {
      if (cur === null) return ids[0];
      const idx = ids.indexOf(cur);
      if (idx === -1) return ids[0];
      return ids[Math.min(ids.length - 1, idx + 1)];
    });
  }, []);

  const movePrev = useCallback(() => {
    const ids = Array.from(rowsRef.current.values())
      .sort((a, b) => a.order - b.order)
      .map((r) => r.id);
    if (ids.length === 0) return;
    setSelectedIdState((cur) => {
      if (cur === null) return ids[ids.length - 1];
      const idx = ids.indexOf(cur);
      if (idx === -1) return ids[ids.length - 1];
      return ids[Math.max(0, idx - 1)];
    });
  }, []);

  // `selectedId` is mirrored into a ref via useEffect so getSelectedMeta is
  // a stable callback that does not need `selectedId` in its deps. This
  // keeps React's "no refs during render" lint rule happy while preserving
  // up-to-date lookups from KeyboardBindings' Enter / `e` handlers.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const getSelectedMeta = useCallback((): RegisteredRow | null => {
    const id = selectedIdRef.current;
    if (!id) return null;
    return rowsRef.current.get(id) ?? null;
  }, []);

  const value = useMemo<RowSelectionContextValue>(
    () => ({
      selectedId,
      setSelectedId,
      registerRow,
      unregisterRow,
      moveNext,
      movePrev,
      getSelectedMeta,
    }),
    [
      selectedId,
      setSelectedId,
      registerRow,
      unregisterRow,
      moveNext,
      movePrev,
      getSelectedMeta,
    ]
  );

  return (
    <RowSelectionContext.Provider value={value}>
      {children}
    </RowSelectionContext.Provider>
  );
}

export function useRowSelection(): RowSelectionContextValue {
  const ctx = useContext(RowSelectionContext);
  if (!ctx)
    throw new Error(
      "useRowSelection must be used inside <RowSelectionProvider>"
    );
  return ctx;
}

/**
 * Row components call this on mount to register themselves with the selection
 * context. Returns `isSelected` so the row can apply a visual focus ring.
 *
 * Meta is re-registered when `primaryMappingId` / `defaultHref` changes so
 * keyboard handlers see the latest defaults.
 */
export function useRowSelectionRegistration(params: {
  id: string;
  primaryMappingId?: string;
  defaultHref?: string;
}): { isSelected: boolean } {
  const { id, primaryMappingId, defaultHref } = params;
  const { selectedId, registerRow, unregisterRow } = useRowSelection();

  useEffect(() => {
    registerRow(id, { primaryMappingId, defaultHref });
    return () => unregisterRow(id);
  }, [id, primaryMappingId, defaultHref, registerRow, unregisterRow]);

  return { isSelected: selectedId === id };
}
