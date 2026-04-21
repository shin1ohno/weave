"use client";

import { useMemo } from "react";
import { useRecentEvents, type RecentEvent } from "@/lib/recent-events";
import { Badge } from "@/components/ui/badge";
import { Subheading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

/** Visible window — internal buffer keeps more (see MAX_EVENTS in recent-events). */
const DISPLAY_LIMIT = 20;

export function RecentEventsPanel() {
  const events = useRecentEvents();
  const visible = useMemo(
    () => events.slice(0, DISPLAY_LIMIT),
    [events]
  );

  return (
    <section className="space-y-2">
      <Subheading level={3}>Recent events</Subheading>
      {visible.length === 0 ? (
        <Text>
          No activity yet. Device inputs and service state updates will appear
          here in real time.
        </Text>
      ) : (
        <div className="space-y-1">
          {visible.map((evt) => (
            <EventRow key={evt.id} event={evt} />
          ))}
        </div>
      )}
    </section>
  );
}

function EventRow({ event }: { event: RecentEvent }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-zinc-950/5 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
        {formatTime(event.ts)}
      </span>
      <Badge color={event.kind === "device_state" ? "blue" : "zinc"}>
        {event.kind === "device_state" ? "in" : "state"}
      </Badge>
      <span className="truncate text-zinc-950 dark:text-white">
        {event.label}
      </span>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
