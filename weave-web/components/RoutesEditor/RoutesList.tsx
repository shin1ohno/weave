"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "@/components/icon";
import { Text } from "@/components/ui/text";
import type { Route } from "@/lib/api";
import { RouteRow } from "./RouteRow";

interface Props {
  routes: Route[];
  onUpdate: (index: number, next: Route) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onAdd: () => void;
}

export function RoutesList({
  routes,
  onUpdate,
  onRemove,
  onMove,
  onAdd,
}: Props) {
  return (
    <div className="space-y-3">
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
      <div>
        <Button type="button" plain onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add route
        </Button>
      </div>
    </div>
  );
}
