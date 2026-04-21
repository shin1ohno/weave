"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
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
}

const emptyState: UIState = {
  connected: false,
  edges: [],
  serviceStates: [],
  deviceStates: [],
  mappings: [],
  glyphs: [],
  pendingSwitches: new Set<string>(),
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
  | { kind: "switch_pending_end"; id: string };

function applySnapshot(snapshot: UiSnapshot, connected: boolean): UIState {
  return {
    connected,
    edges: snapshot.edges,
    serviceStates: snapshot.service_states,
    deviceStates: snapshot.device_states,
    mappings: snapshot.mappings,
    glyphs: snapshot.glyphs,
    pendingSwitches: new Set<string>(),
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
    case "frame": {
      const frame = action.frame;
      switch (frame.type) {
        case "snapshot":
          return applySnapshot(frame.snapshot, state.connected);
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
        {children}
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
