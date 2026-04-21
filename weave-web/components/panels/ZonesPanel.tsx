"use client";

import { useMemo } from "react";
import { useUIState } from "@/lib/ws";
import { ZoneRow } from "@/components/rows/ZoneRow";
import { Subheading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import type { Mapping, ServiceStateEntry } from "@/lib/api";

export function ZonesPanel() {
  const state = useUIState();

  const zonesByTarget = useMemo(() => {
    const grouped = new Map<string, ServiceStateEntry[]>();
    for (const s of state.serviceStates) {
      if (s.service_type !== "roon") continue;
      const list = grouped.get(s.target) ?? [];
      list.push(s);
      grouped.set(s.target, list);
    }
    return grouped;
  }, [state.serviceStates]);

  const controllersByTarget = useMemo(() => {
    const grouped = new Map<string, Mapping[]>();
    for (const m of state.mappings) {
      if (m.service_type !== "roon") continue;
      const list = grouped.get(m.service_target) ?? [];
      list.push(m);
      grouped.set(m.service_target, list);
    }
    return grouped;
  }, [state.mappings]);

  const sortedTargets = useMemo(
    () =>
      Array.from(zonesByTarget.entries()).sort(([a], [b]) => a.localeCompare(b)),
    [zonesByTarget]
  );

  return (
    <section className="space-y-2">
      <Subheading level={3}>Audio zones</Subheading>
      {sortedTargets.length === 0 ? (
        <Text>
          No zone state yet. An edge-agent with the `roon` adapter needs to
          connect and pair with a Roon Core.
        </Text>
      ) : (
        <div className="space-y-1.5">
          {sortedTargets.map(([target, states]) => (
            <ZoneRow
              key={target}
              target={target}
              states={states}
              controllers={controllersByTarget.get(target) ?? []}
            />
          ))}
        </div>
      )}
    </section>
  );
}
