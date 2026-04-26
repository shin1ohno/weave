"use client";

import { GripVertical, INPUT_ICON, X } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import type { Route } from "@/lib/api";
import { INPUT_TYPES, INTENT_GROUPS, INTENT_TYPES } from "./vocab";

interface Props {
  index: number;
  total: number;
  route: Route;
  onChange: (next: Route) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}

const INPUT_OPTIONS: ComboboxOption[] = INPUT_TYPES.map((t) => ({
  value: t,
  label: t,
  icon: INPUT_ICON[t],
}));

const INTENT_GROUP_OPTIONS = INTENT_GROUPS.map((g) => ({
  label: g.label,
  options: g.items.map((it) => ({ value: it, label: it })),
}));

export function RouteRow({
  index,
  total,
  route,
  onChange,
  onRemove,
  onMove,
}: Props) {
  const isRotate = route.input === "rotate";
  const damping =
    typeof route.params?.damping === "number" ? route.params.damping : 1;

  // Catch-all so server-defined intents outside the curated groups still
  // have a row to render. Computed eagerly because Combobox's `groups`
  // doesn't fall back gracefully if the value points outside any group.
  const groupsWithCatchAll = !INTENT_TYPES.includes(route.intent)
    ? [
        ...INTENT_GROUP_OPTIONS,
        {
          label: "Custom",
          options: [{ value: route.intent, label: route.intent }],
        },
      ]
    : INTENT_GROUP_OPTIONS;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="cursor-grab text-zinc-400 dark:text-zinc-500"
        aria-hidden
        title="Drag to reorder (use ↑ / ↓ buttons)"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-40">
        <Combobox
          aria-label="Input"
          value={route.input}
          onChange={(v) => onChange({ ...route, input: v })}
          options={INPUT_OPTIONS}
          allowCustom
        />
      </div>
      <span className="text-zinc-400">→</span>
      <div className="min-w-44">
        <Combobox
          aria-label="Intent"
          value={route.intent}
          onChange={(v) => onChange({ ...route, intent: v })}
          groups={groupsWithCatchAll}
          allowCustom
        />
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
        aria-label="Remove route"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
