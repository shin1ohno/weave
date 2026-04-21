"use client";

import { useMemo } from "react";
import { useUIState } from "@/lib/ws";
import { MappingRow } from "@/components/rows/MappingRow";
import { Button } from "@/components/ui/button";
import { Subheading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

export function MappingsPanel() {
  const state = useUIState();

  const targetLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of state.serviceStates) {
      if (s.property !== "zone" && s.property !== "light") continue;
      const label = (s.value as { display_name?: string } | undefined)
        ?.display_name;
      if (label) m.set(`${s.service_type}:${s.target}`, label);
    }
    return m;
  }, [state.serviceStates]);

  const sorted = useMemo(
    () =>
      state.mappings.slice().sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        const ea = a.edge_id || "";
        const eb = b.edge_id || "";
        if (ea !== eb) return ea.localeCompare(eb);
        return a.device_id.localeCompare(b.device_id);
      }),
    [state.mappings]
  );

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <Subheading level={3}>Mappings</Subheading>
        <Button href="/mappings/new" color="blue">
          New mapping
        </Button>
      </div>
      {sorted.length === 0 ? (
        <Text>
          No mappings configured. Create one to route device inputs to services.
        </Text>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((m) => (
            <MappingRow
              key={m.mapping_id}
              mapping={m}
              targetLabel={targetLabels.get(
                `${m.service_type}:${m.service_target}`
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
