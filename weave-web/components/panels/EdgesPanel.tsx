"use client";

import { useMemo } from "react";
import { useUIState } from "@/lib/ws";
import { EdgeRow } from "@/components/rows/EdgeRow";
import { Subheading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

export function EdgesPanel() {
  const state = useUIState();

  const deviceCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of state.deviceStates) {
      m.set(d.edge_id, (m.get(d.edge_id) ?? 0) + 1);
    }
    return m;
  }, [state.deviceStates]);

  const sorted = useMemo(
    () =>
      state.edges.slice().sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return a.edge_id.localeCompare(b.edge_id);
      }),
    [state.edges]
  );

  return (
    <section className="space-y-2">
      <Subheading level={3}>Edges</Subheading>
      {sorted.length === 0 ? (
        <Text>
          No edges have ever connected. An edge-agent pointing at ws://HOST/ws/edge
          will register itself here.
        </Text>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((e) => (
            <EdgeRow
              key={e.edge_id}
              edge={e}
              deviceCount={deviceCounts.get(e.edge_id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
