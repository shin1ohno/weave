"use client";

import { GripVertical, X } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Route } from "@/lib/api";
import {
  INPUT_TYPES,
  INTENT_GROUPS,
  INTENT_TYPES,
} from "./vocab";

interface Props {
  index: number;
  total: number;
  route: Route;
  onChange: (next: Route) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}

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
        aria-label="Remove route"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
