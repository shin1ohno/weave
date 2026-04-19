"use client";

import { useUIState } from "@/lib/ws";
import { EdgeCard } from "@/components/EdgeCard";
import { ZoneCard } from "@/components/ZoneCard";

export default function Overview() {
  const state = useUIState();

  const roonTargets = new Map<string, typeof state.serviceStates>();
  for (const s of state.serviceStates) {
    if (s.service_type !== "roon") continue;
    const list = roonTargets.get(s.target) ?? [];
    list.push(s);
    roonTargets.set(s.target, list);
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Overview</h2>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
              state.connected
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                state.connected ? "bg-green-500" : "bg-zinc-400"
              }`}
            />
            {state.connected ? "live" : "disconnected"}
          </span>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Edges</h3>
        {state.edges.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No edges connected yet. Start an edge-agent pointing at
            ws://HOST/ws/edge.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {state.edges
              .slice()
              .sort((a, b) => a.edge_id.localeCompare(b.edge_id))
              .map((e) => (
                <EdgeCard key={e.edge_id} edge={e} />
              ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">Roon zones</h3>
        {roonTargets.size === 0 ? (
          <p className="text-sm text-zinc-500">
            No zone state yet. An edge-agent with the `roon` adapter needs to
            connect and pair with a Roon Core.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from(roonTargets.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([target, states]) => (
                <ZoneCard key={target} target={target} states={states} />
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
