"use client";

import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { ChevronRight, INPUT_ICON, Plus } from "@/components/icon";
import { Text } from "@/components/ui/text";
import type { Route } from "@/lib/api";
import { RouteRow } from "./RouteRow";
import { INPUT_TYPES } from "./vocab";

interface Props {
  routes: Route[];
  onUpdate: (index: number, next: Route) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onAdd: (input?: string) => void;
}

const SUGGESTION_LIMIT = 3;

function UnusedGestureRow({
  input,
  onPick,
}: {
  input: string;
  onPick: () => void;
}) {
  const Icon = INPUT_ICON[input];
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 p-2 text-xs opacity-80 dark:border-white/10">
      <span
        className="text-zinc-300 dark:text-zinc-700"
        aria-hidden
        title="drag to reorder"
      >
        ⋮⋮
      </span>
      <div className="flex items-center gap-1.5 rounded-md border border-zinc-950/5 bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-500 dark:border-white/5 dark:bg-white/5 dark:text-zinc-500">
        {Icon && <Icon className="h-3 w-3" />}
        {input}
      </div>
      <ChevronRight className="h-3 w-3 text-zinc-300 dark:text-zinc-700" />
      <button
        type="button"
        onClick={onPick}
        className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        + assign intent
      </button>
    </div>
  );
}

export function RoutesList({
  routes,
  onUpdate,
  onRemove,
  onMove,
  onAdd,
}: Props) {
  const usedInputs = new Set(routes.map((r) => r.input));
  const unused = INPUT_TYPES.filter((g) => !usedInputs.has(g)).slice(
    0,
    SUGGESTION_LIMIT
  );
  return (
    <div className={clsx("space-y-3")}>
      {routes.length === 0 ? (
        <Text>
          No routes yet. Pick a preset above or add one manually to route a
          device input to an intent.
        </Text>
      ) : (
        routes.map((r, i) => (
          <RouteRow
            key={i}
            index={i}
            total={routes.length}
            route={r}
            onChange={(next) => onUpdate(i, next)}
            onRemove={() => onRemove(i)}
            onMove={(dir) => onMove(i, dir)}
          />
        ))
      )}
      {unused.length > 0 && (
        <div className="space-y-1.5">
          {unused.map((g) => (
            <UnusedGestureRow key={g} input={g} onPick={() => onAdd(g)} />
          ))}
        </div>
      )}
      <div>
        <Button type="button" plain onClick={() => onAdd()}>
          <Plus className="h-3.5 w-3.5" />
          Add route
        </Button>
      </div>
    </div>
  );
}
