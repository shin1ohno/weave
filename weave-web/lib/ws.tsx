"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  EdgeInfo,
  ServiceStateEntry,
  DeviceStateEntry,
  Mapping,
  Glyph,
  UiFrame,
  UiSnapshot,
  wsUrl,
} from "./api";
import { listTemplates, type Template } from "./templates";

export type ConnectionsFilter = "all" | "active" | "firing";

export interface LastInput {
  input: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any;
  /** Epoch ms after which the DeviceTile should stop rendering the input. */
  expiresAt: number;
}

interface UIState {
  connected: boolean;
  edges: EdgeInfo[];
  serviceStates: ServiceStateEntry[];
  deviceStates: DeviceStateEntry[];
  mappings: Mapping[];
  glyphs: Glyph[];
  /**
   * Set of `mapping_id` values with an in-flight optimistic `switchTarget`
   * call. While a mapping is in this set, incoming `mapping_changed`
   * broadcasts for it are ignored — the local optimistic `service_target`
   * is authoritative until the request resolves. Cleared on disconnect
   * because no ACK will arrive.
   */
  pendingSwitches: Set<string>;
  /** Currently selected device in the 3-pane Connections view. Null means
   * "no device selected" → the center pane shows every connection. */
  selectedDeviceId: string | null;
  /** Center-pane filter chip. `all` shows everything, `active` hides
   * soft-disabled mappings, `firing` shows only the connections that are
   * firing right now. AND-combined with `selectedDeviceId`. */
  connectionsFilter: ConnectionsFilter;
  /** Mapping IDs currently firing. Populated by `fire_mapping` and cleared
   * by `unfire_mapping` (driven by a 2s timer in ConnectionsView effect). */
  firingMappingIds: Set<string>;
  /** Last observed input per device (by `device_id`). Used for the
   * DeviceTile "last input" line and the ConnectionCard footer. */
  lastInputByDevice: Record<string, LastInput>;
}

const emptyState: UIState = {
  connected: false,
  edges: [],
  serviceStates: [],
  deviceStates: [],
  mappings: [],
  glyphs: [],
  pendingSwitches: new Set<string>(),
  selectedDeviceId: null,
  connectionsFilter: "all",
  firingMappingIds: new Set<string>(),
  lastInputByDevice: {},
};

type Action =
  | { kind: "connected" }
  | { kind: "disconnected" }
  | { kind: "frame"; frame: UiFrame }
  | { kind: "local_upsert_mapping"; mapping: Mapping }
  | { kind: "local_delete_mapping"; id: string }
  | { kind: "local_upsert_glyph"; glyph: Glyph }
  | { kind: "local_set_mapping_target"; id: string; service_target: string }
  | { kind: "switch_pending_start"; id: string }
  | { kind: "switch_pending_end"; id: string }
  | { kind: "set_selected_device"; deviceId: string | null }
  | { kind: "set_connections_filter"; filter: ConnectionsFilter }
  | {
      kind: "fire_mapping";
      mapping_ids: string[];
      device_id: string;
      input: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value?: any;
      /** 2s firing window by default — caller may pass a shorter value. */
      ttlMs?: number;
    }
  | { kind: "unfire_mapping"; mapping_id: string };

function applySnapshot(
  prev: UIState,
  snapshot: UiSnapshot,
  connected: boolean
): UIState {
  return {
    connected,
    edges: snapshot.edges,
    serviceStates: snapshot.service_states,
    deviceStates: snapshot.device_states,
    mappings: snapshot.mappings,
    glyphs: snapshot.glyphs,
    pendingSwitches: new Set<string>(),
    // Preserve user UI selection across reconnects — the snapshot represents
    // server truth, not user intent.
    selectedDeviceId: prev.selectedDeviceId,
    connectionsFilter: prev.connectionsFilter,
    // Firing / last-input are derived from live events; a fresh snapshot is
    // a clean slate for them.
    firingMappingIds: new Set<string>(),
    lastInputByDevice: {},
  };
}

function reducer(state: UIState, action: Action): UIState {
  switch (action.kind) {
    case "connected":
      return { ...state, connected: true };
    case "disconnected":
      // Clear pending switches on disconnect — no ACK will come, so the
      // optimistic state is stale and the next snapshot should win.
      return {
        ...state,
        connected: false,
        pendingSwitches: new Set<string>(),
      };
    case "local_upsert_mapping": {
      const others = state.mappings.filter(
        (m) => m.mapping_id !== action.mapping.mapping_id
      );
      return { ...state, mappings: [...others, action.mapping] };
    }
    case "local_delete_mapping":
      return {
        ...state,
        mappings: state.mappings.filter((m) => m.mapping_id !== action.id),
      };
    case "local_upsert_glyph": {
      const others = state.glyphs.filter((g) => g.name !== action.glyph.name);
      return { ...state, glyphs: [...others, action.glyph] };
    }
    case "local_set_mapping_target": {
      let changed = false;
      const mappings = state.mappings.map((m) => {
        if (m.mapping_id !== action.id) return m;
        if (m.service_target === action.service_target) return m;
        changed = true;
        return { ...m, service_target: action.service_target };
      });
      if (!changed) return state;
      return { ...state, mappings };
    }
    case "switch_pending_start": {
      if (state.pendingSwitches.has(action.id)) return state;
      const next = new Set(state.pendingSwitches);
      next.add(action.id);
      return { ...state, pendingSwitches: next };
    }
    case "switch_pending_end": {
      if (!state.pendingSwitches.has(action.id)) return state;
      const next = new Set(state.pendingSwitches);
      next.delete(action.id);
      return { ...state, pendingSwitches: next };
    }
    case "set_selected_device":
      if (state.selectedDeviceId === action.deviceId) return state;
      return { ...state, selectedDeviceId: action.deviceId };
    case "set_connections_filter":
      if (state.connectionsFilter === action.filter) return state;
      return { ...state, connectionsFilter: action.filter };
    case "fire_mapping": {
      const ttl = action.ttlMs ?? 2000;
      const expiresAt = Date.now() + ttl;
      const nextFiring = new Set(state.firingMappingIds);
      for (const id of action.mapping_ids) nextFiring.add(id);
      return {
        ...state,
        firingMappingIds: nextFiring,
        lastInputByDevice: {
          ...state.lastInputByDevice,
          [action.device_id]: {
            input: action.input,
            value: action.value,
            expiresAt,
          },
        },
      };
    }
    case "unfire_mapping": {
      if (!state.firingMappingIds.has(action.mapping_id)) return state;
      const next = new Set(state.firingMappingIds);
      next.delete(action.mapping_id);
      return { ...state, firingMappingIds: next };
    }
    case "frame": {
      const frame = action.frame;
      switch (frame.type) {
        case "snapshot":
          return applySnapshot(state, frame.snapshot, state.connected);
        case "edge_online": {
          const others = state.edges.filter(
            (e) => e.edge_id !== frame.edge.edge_id
          );
          return { ...state, edges: [...others, frame.edge] };
        }
        case "edge_offline":
          return {
            ...state,
            edges: state.edges.map((e) =>
              e.edge_id === frame.edge_id ? { ...e, online: false } : e
            ),
          };
        case "service_state": {
          const keyMatch = (s: ServiceStateEntry) =>
            s.edge_id === frame.edge_id &&
            s.service_type === frame.service_type &&
            s.target === frame.target &&
            s.property === frame.property &&
            (s.output_id ?? null) === (frame.output_id ?? null);
          const others = state.serviceStates.filter((s) => !keyMatch(s));
          return {
            ...state,
            serviceStates: [
              ...others,
              {
                edge_id: frame.edge_id,
                service_type: frame.service_type,
                target: frame.target,
                property: frame.property,
                output_id: frame.output_id,
                value: frame.value,
                updated_at: new Date().toISOString(),
              },
            ],
          };
        }
        case "device_state": {
          const keyMatch = (d: DeviceStateEntry) =>
            d.edge_id === frame.edge_id &&
            d.device_type === frame.device_type &&
            d.device_id === frame.device_id &&
            d.property === frame.property;
          const others = state.deviceStates.filter((d) => !keyMatch(d));
          return {
            ...state,
            deviceStates: [
              ...others,
              {
                edge_id: frame.edge_id,
                device_type: frame.device_type,
                device_id: frame.device_id,
                property: frame.property,
                value: frame.value,
                updated_at: new Date().toISOString(),
              },
            ],
          };
        }
        case "mapping_changed": {
          // Race guard: if a local optimistic switch is still in flight for
          // this mapping, ignore the broadcast. The local state is
          // authoritative until the API call resolves (which clears the
          // pending flag), at which point subsequent broadcasts apply.
          if (state.pendingSwitches.has(frame.mapping_id)) {
            return state;
          }
          if (frame.op === "delete" || !frame.mapping) {
            return {
              ...state,
              mappings: state.mappings.filter(
                (m) => m.mapping_id !== frame.mapping_id
              ),
            };
          }
          const others = state.mappings.filter(
            (m) => m.mapping_id !== frame.mapping_id
          );
          return { ...state, mappings: [...others, frame.mapping] };
        }
        case "glyphs_changed":
          return { ...state, glyphs: frame.glyphs };
        case "edge_status": {
          // Patch the matching edge row in place. If the edge isn't in
          // the snapshot yet (race during initial connect), drop the
          // frame — the next snapshot will carry both identity and
          // metrics together.
          let touched = false;
          const edges = state.edges.map((e) => {
            if (e.edge_id !== frame.edge_id) return e;
            touched = true;
            return { ...e, wifi: frame.wifi, latency_ms: frame.latency_ms };
          });
          if (!touched) return state;
          return { ...state, edges };
        }
        default:
          return state;
      }
    }
    default:
      return state;
  }
}

interface UIStateContextValue {
  state: UIState;
  dispatch: (action: Action) => void;
}

const UIStateContext = createContext<UIStateContextValue | null>(null);

/**
 * Fan-out registry for raw WS frames. Listeners are stored in a ref owned by
 * `UIStateProvider` and invoked inside `ws.onmessage` *after* the reducer
 * dispatch. This lets `RecentEventsProvider` (and future subscribers)
 * consume every incoming frame without being colocated with the reducer
 * state — keeping them out of `useUIState`'s re-render graph.
 */
type FrameListener = (frame: UiFrame) => void;

const WsListenersContext = createContext<{
  add: (fn: FrameListener) => () => void;
} | null>(null);

// Templates live in their own context rather than the WS reducer because
// they are loaded via REST (not part of the `UiSnapshot` frame) and their
// shape is owned by the editor UI, not the live-state pipeline. Components
// that mutate templates (create / update / delete) call the API directly
// and then `setTemplates(next)` to refresh the in-memory list — no WS
// round-trip required. Keeping this separate also avoids growing the
// `UIState` reducer with unrelated CRUD plumbing.
interface TemplatesContextValue {
  templates: Template[];
  setTemplates: (next: Template[]) => void;
}

const TemplatesContext = createContext<TemplatesContextValue | null>(null);

function TemplatesProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplatesState] = useState<Template[]>([]);

  useEffect(() => {
    let cancelled = false;
    listTemplates()
      .then((next) => {
        if (!cancelled) setTemplatesState(next);
      })
      .catch((err) => {
        // Templates are nice-to-have onboarding sugar; if the endpoint is
        // missing in dev or returns an error, leave the list empty and
        // surface the failure in the console rather than blocking the rest
        // of the UI from rendering.
        console.warn("listTemplates failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTemplates = useCallback((next: Template[]) => {
    setTemplatesState(next);
  }, []);

  const value = useMemo(
    () => ({ templates, setTemplates }),
    [templates, setTemplates]
  );

  return (
    <TemplatesContext.Provider value={value}>
      {children}
    </TemplatesContext.Provider>
  );
}

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, emptyState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef<number>(1000);
  const listenersRef = useRef<Set<FrameListener>>(new Set());

  useEffect(() => {
    let cancelled = false;

    function open() {
      if (cancelled) return;
      const ws = new WebSocket(wsUrl("/ws/ui"));
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelay.current = 1000;
        dispatch({ kind: "connected" });
      };
      ws.onmessage = (ev) => {
        try {
          const frame = JSON.parse(ev.data) as UiFrame;
          dispatch({ kind: "frame", frame });
          for (const fn of listenersRef.current) {
            try {
              fn(frame);
            } catch (err) {
              console.warn("ws frame listener threw", err);
            }
          }
        } catch (e) {
          console.warn("bad ws payload", e);
        }
      };
      ws.onclose = () => {
        dispatch({ kind: "disconnected" });
        if (cancelled) return;
        const delay = Math.min(reconnectDelay.current, 15000);
        reconnectDelay.current *= 2;
        setTimeout(open, delay);
      };
      ws.onerror = () => {
        ws.close();
      };
    }

    open();
    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, []);

  const listenersApi = useMemo(
    () => ({
      add: (fn: FrameListener) => {
        listenersRef.current.add(fn);
        return () => {
          listenersRef.current.delete(fn);
        };
      },
    }),
    []
  );

  return (
    <UIStateContext.Provider value={{ state, dispatch }}>
      <WsListenersContext.Provider value={listenersApi}>
        <TemplatesProvider>{children}</TemplatesProvider>
      </WsListenersContext.Provider>
    </UIStateContext.Provider>
  );
}

export function useUIState(): UIState {
  const ctx = useContext(UIStateContext);
  if (!ctx) throw new Error("useUIState must be used inside UIStateProvider");
  return ctx.state;
}

export function useUIDispatch(): (action: Action) => void {
  const ctx = useContext(UIStateContext);
  if (!ctx)
    throw new Error("useUIDispatch must be used inside UIStateProvider");
  return ctx.dispatch;
}

/** Convenience accessor for the in-flight switch-target mapping IDs. */
export function usePendingSwitches(): Set<string> {
  const ctx = useContext(UIStateContext);
  if (!ctx)
    throw new Error(
      "usePendingSwitches must be used inside UIStateProvider"
    );
  return ctx.state.pendingSwitches;
}

/** Currently selected device for the Connections pane filter, plus setter.
 * Returns `null` when nothing is selected (center pane unfiltered). */
export function useSelectedDevice(): [
  string | null,
  (deviceId: string | null) => void,
] {
  const ctx = useContext(UIStateContext);
  if (!ctx)
    throw new Error("useSelectedDevice must be used inside UIStateProvider");
  return [
    ctx.state.selectedDeviceId,
    (deviceId) => ctx.dispatch({ kind: "set_selected_device", deviceId }),
  ];
}

/** Center-pane filter chip (`all` / `active` / `firing`) with setter. */
export function useConnectionsFilter(): [
  ConnectionsFilter,
  (filter: ConnectionsFilter) => void,
] {
  const ctx = useContext(UIStateContext);
  if (!ctx)
    throw new Error(
      "useConnectionsFilter must be used inside UIStateProvider"
    );
  return [
    ctx.state.connectionsFilter,
    (filter) => ctx.dispatch({ kind: "set_connections_filter", filter }),
  ];
}

/** Set of currently firing mapping IDs. Re-rendered whenever a new
 * `fire_mapping` / `unfire_mapping` is dispatched. */
export function useFiringMappingIds(): Set<string> {
  const ctx = useContext(UIStateContext);
  if (!ctx)
    throw new Error(
      "useFiringMappingIds must be used inside UIStateProvider"
    );
  return ctx.state.firingMappingIds;
}

/** Last observed input per device. Indexed by `device_id`. */
export function useLastInputByDevice(): Record<string, LastInput> {
  const ctx = useContext(UIStateContext);
  if (!ctx)
    throw new Error(
      "useLastInputByDevice must be used inside UIStateProvider"
    );
  return ctx.state.lastInputByDevice;
}

/**
 * Read the current template library. Returns the in-memory list fetched on
 * mount via `listTemplates()`. Components that mutate (create / delete /
 * update) should pair this with `useDispatchTemplates` to push the new
 * list back into the context.
 */
export function useTemplates(): Template[] {
  const ctx = useContext(TemplatesContext);
  if (!ctx)
    throw new Error("useTemplates must be used inside UIStateProvider");
  return ctx.templates;
}

/**
 * Setter for the in-memory template list. Components that create / update /
 * delete via the REST helpers in `lib/templates.ts` call this with the
 * updated array (typically computed from the previous result) so the rest
 * of the UI reflects the change without a refetch round-trip.
 */
export function useDispatchTemplates(): (next: Template[]) => void {
  const ctx = useContext(TemplatesContext);
  if (!ctx)
    throw new Error(
      "useDispatchTemplates must be used inside UIStateProvider"
    );
  return ctx.setTemplates;
}

/**
 * Subscribe to every incoming WS frame. The listener is registered once per
 * mount and unsubscribed on cleanup. Safe to call from any descendant of
 * `UIStateProvider`. Unlike `useUIState`, this does NOT cause the caller to
 * re-render when state changes — it's a pure side-channel.
 */
export function useWsFrames(listener: FrameListener): void {
  const ctx = useContext(WsListenersContext);
  if (!ctx)
    throw new Error("useWsFrames must be used inside UIStateProvider");
  const ref = useRef(listener);
  useEffect(() => {
    ref.current = listener;
  }, [listener]);
  useEffect(() => {
    return ctx.add((frame) => ref.current(frame));
  }, [ctx]);
}
