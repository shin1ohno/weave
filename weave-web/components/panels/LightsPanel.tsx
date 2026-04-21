"use client";

import { useMemo } from "react";
import { useUIState } from "@/lib/ws";
import { LightRow } from "@/components/rows/LightRow";
import { Subheading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import type { Mapping } from "@/lib/api";

export function LightsPanel() {
  const state = useUIState();

  const lights = useMemo(
    () =>
      state.serviceStates
        .filter((s) => s.service_type === "hue" && s.property === "light")
        .sort((a, b) => a.target.localeCompare(b.target)),
    [state.serviceStates]
  );

  const controllersByTarget = useMemo(() => {
    const grouped = new Map<string, Mapping[]>();
    for (const m of state.mappings) {
      if (m.service_type !== "hue") continue;
      const list = grouped.get(m.service_target) ?? [];
      list.push(m);
      grouped.set(m.service_target, list);
    }
    return grouped;
  }, [state.mappings]);

  return (
    <section className="space-y-2">
      <Subheading level={3}>Hue lights</Subheading>
      {lights.length === 0 ? (
        <Text>
          No Hue state yet. An edge-agent with the `hue` adapter (pair it via
          `edge-agent pair-hue`) needs to be connected.
        </Text>
      ) : (
        <div className="space-y-1.5">
          {lights.map((entry) => (
            <LightRow
              key={entry.target}
              target={entry.target}
              entry={entry}
              controllers={controllersByTarget.get(entry.target) ?? []}
            />
          ))}
        </div>
      )}
    </section>
  );
}
