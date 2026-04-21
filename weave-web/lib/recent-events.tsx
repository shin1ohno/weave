"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { UiFrame } from "./api";
import { formatFrame } from "./events";
import { useUIState, useWsFrames } from "./ws";

/**
 * Ring-buffered live activity log.
 *
 * Runs in its own Context so every incoming WS frame doesn't invalidate
 * `useUIState` consumers. `UIStateProvider` keeps the snapshot/reducer state
 * stable; this provider subscribes to the same frames via `useWsFrames` and
 * maintains a separate state slice used only by `RecentEventsPanel`.
 */
export interface RecentEvent {
  id: string;
  ts: number;
  kind: "device_state" | "service_state";
  label: string;
  raw: UiFrame;
}

/** Internal cap — UI slices its own window on top of this. */
const MAX_EVENTS = 50;

const RecentEventsContext = createContext<RecentEvent[] | null>(null);

export function RecentEventsProvider({ children }: { children: ReactNode }) {
  const { mappings } = useUIState();
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const counterRef = useRef(0);

  // Keep mappings in a ref so we can resolve intent labels at the moment
  // a frame arrives without forcing the listener to re-subscribe on every
  // mappings update.
  const mappingsRef = useRef(mappings);
  useEffect(() => {
    mappingsRef.current = mappings;
  }, [mappings]);

  const handleFrame = useCallback((frame: UiFrame) => {
    const formatted = formatFrame(frame, mappingsRef.current);
    if (!formatted) return;
    counterRef.current += 1;
    const event: RecentEvent = {
      id: `evt-${counterRef.current}`,
      ts: Date.now(),
      kind: formatted.kind,
      label: formatted.label,
      raw: frame,
    };
    setEvents((prev) => {
      const next = [event, ...prev];
      if (next.length > MAX_EVENTS) next.length = MAX_EVENTS;
      return next;
    });
  }, []);

  useWsFrames(handleFrame);

  return (
    <RecentEventsContext.Provider value={events}>
      {children}
    </RecentEventsContext.Provider>
  );
}

export function useRecentEvents(): RecentEvent[] {
  const ctx = useContext(RecentEventsContext);
  if (!ctx)
    throw new Error(
      "useRecentEvents must be used inside RecentEventsProvider"
    );
  return ctx;
}
