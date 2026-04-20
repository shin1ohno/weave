"use client";

import { useUIState } from "@/lib/ws";
import { EdgeCard } from "@/components/EdgeCard";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

export default function EdgesList() {
  const state = useUIState();
  const sorted = state.edges.slice().sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.edge_id.localeCompare(b.edge_id);
  });

  return (
    <div className="space-y-6">
      <Heading>Edges</Heading>
      {sorted.length === 0 ? (
        <Text>
          No edges have ever connected. An edge-agent pointing at
          ws://HOST/ws/edge will register itself here.
        </Text>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((e) => (
            <EdgeCard key={e.edge_id} edge={e} />
          ))}
        </div>
      )}
    </div>
  );
}
