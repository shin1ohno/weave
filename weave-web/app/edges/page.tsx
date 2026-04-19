"use client";

import { useUIState } from "@/lib/ws";
import { EdgeCard } from "@/components/EdgeCard";

export default function EdgesList() {
  const state = useUIState();
  const sorted = state.edges.slice().sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.edge_id.localeCompare(b.edge_id);
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Edges</h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No edges have ever connected. An edge-agent pointing at ws://HOST/ws/edge
          will register itself here.
        </p>
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
