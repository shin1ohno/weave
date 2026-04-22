"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { Check, Circle } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import type { Mapping, Route } from "@/lib/api";
import { useWsFrames } from "@/lib/ws";
import { RoutePill } from "@/components/ConnectionsView/RoutePill";

interface Props {
  mapping: Mapping;
  onAllVerified?: () => void;
}

type Status = "pending" | "ok" | "warn";

interface RouteState {
  status: Status;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lastValue?: any;
  lastAt?: number;
}

export function GestureChecklist({ mapping, onAllVerified }: Props) {
  // Detect a route-list identity change during render — idiomatic React 19
  // way to "reset on props change" without setState-in-effect. The extra
  // useState tracks the identity; when it diverges we reset in the same
  // render pass.
  const [trackedRoutes, setTrackedRoutes] = useState(mapping.routes);
  const [states, setStates] = useState<RouteState[]>(() =>
    mapping.routes.map(() => ({ status: "pending" }))
  );
  if (trackedRoutes !== mapping.routes) {
    setTrackedRoutes(mapping.routes);
    setStates(mapping.routes.map(() => ({ status: "pending" })));
  }

  useWsFrames((frame) => {
    if (frame.type !== "device_state") return;
    if (frame.property !== "input") return;
    if (frame.edge_id !== mapping.edge_id) return;
    if (frame.device_type !== mapping.device_type) return;
    if (frame.device_id !== mapping.device_id) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = frame.value as any;
    const observed: string | null =
      typeof v === "string"
        ? v
        : typeof v?.input === "string"
          ? v.input
          : typeof v?.name === "string"
            ? v.name
            : null;
    if (!observed) return;

    setStates((prev) => {
      const next = [...prev];
      let changed = false;
      for (let i = 0; i < mapping.routes.length; i++) {
        if (mapping.routes[i].input !== observed) continue;
        if (next[i].status === "ok") continue;
        next[i] = { status: "ok", lastValue: v, lastAt: Date.now() };
        changed = true;
      }
      return changed ? next : prev;
    });
  });

  const okCount = states.filter((s) => s.status === "ok").length;
  const total = mapping.routes.length;
  const allOk = total > 0 && okCount === total;

  useEffect(() => {
    if (allOk) onAllVerified?.();
  }, [allOk, onAllVerified]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-950/5 px-4 py-3 dark:border-white/10">
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
          Gesture checklist
        </h3>
        <Badge color={allOk ? "green" : "zinc"}>
          {okCount}/{total} verified
        </Badge>
      </div>
      <div className="relative h-1 bg-zinc-100 dark:bg-zinc-800">
        <div
          className="absolute inset-y-0 left-0 bg-green-500 transition-all"
          style={{ width: `${total === 0 ? 0 : (okCount / total) * 100}%` }}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            This connection has no routes yet. Add some below, then try them on
            the device.
          </p>
        ) : (
          <div className="space-y-2">
            {mapping.routes.map((route, i) => (
              <ChecklistRow
                key={i}
                route={route}
                state={states[i] ?? { status: "pending" }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistRow({
  route,
  state,
}: {
  route: Route;
  state: RouteState;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-zinc-950/5 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-900">
      <span
        className={clsx(
          "flex h-5 w-5 flex-none items-center justify-center rounded-full",
          state.status === "ok"
            ? "bg-green-500 text-white"
            : state.status === "warn"
              ? "bg-amber-500 text-white"
              : "border border-zinc-300 text-zinc-400 dark:border-zinc-700"
        )}
      >
        {state.status === "ok" ? (
          <Check className="h-3 w-3" />
        ) : (
          <Circle className="h-2 w-2" />
        )}
      </span>
      <RoutePill route={route} />
      <div className="ml-auto text-right text-xs">
        {state.status === "ok" ? (
          <span className="text-green-600 dark:text-green-400">
            ✓ verified
          </span>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">
            not tested yet
          </span>
        )}
      </div>
    </div>
  );
}
