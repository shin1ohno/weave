"use client";

import { useUIState } from "@/lib/ws";
import { EdgeCard } from "@/components/EdgeCard";
import { ZoneCard } from "@/components/ZoneCard";
import { LightCard } from "@/components/LightCard";
import { Heading, Subheading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";

export default function Overview() {
  const state = useUIState();

  const roonTargets = new Map<string, typeof state.serviceStates>();
  for (const s of state.serviceStates) {
    if (s.service_type !== "roon") continue;
    const list = roonTargets.get(s.target) ?? [];
    list.push(s);
    roonTargets.set(s.target, list);
  }

  const hueLights = state.serviceStates
    .filter((s) => s.service_type === "hue" && s.property === "light")
    .sort((a, b) => a.target.localeCompare(b.target));

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-center justify-between">
          <Heading>Overview</Heading>
          <Badge color={state.connected ? "green" : "zinc"}>
            <span
              className={`h-2 w-2 rounded-full ${
                state.connected ? "bg-green-500" : "bg-zinc-400"
              }`}
            />
            {state.connected ? "live" : "disconnected"}
          </Badge>
        </div>
      </section>

      <section className="space-y-3">
        <Subheading level={3}>Edges</Subheading>
        {state.edges.length === 0 ? (
          <Text>
            No edges connected yet. Start an edge-agent pointing at
            ws://HOST/ws/edge.
          </Text>
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

      <section className="space-y-3">
        <Subheading level={3}>Roon zones</Subheading>
        {roonTargets.size === 0 ? (
          <Text>
            No zone state yet. An edge-agent with the `roon` adapter needs to
            connect and pair with a Roon Core.
          </Text>
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

      <section className="space-y-3">
        <Subheading level={3}>Hue lights</Subheading>
        {hueLights.length === 0 ? (
          <Text>
            No Hue state yet. An edge-agent with the `hue` adapter (pair it
            via `edge-agent pair-hue`) needs to be connected.
          </Text>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hueLights.map((entry) => (
              <LightCard
                key={entry.target}
                target={entry.target}
                entry={entry}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
