"use client";

import { useMemo } from "react";
import { useUIState } from "@/lib/ws";
import { MacRow } from "@/components/rows/MacRow";
import { Subheading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import type { Mapping, ServiceStateEntry } from "@/lib/api";

/**
 * Aggregates `service_type = "macos"` state entries into one row per
 * target (typically one per macos-hub, keyed by its edge_id). Unlike
 * Hue / Roon each target has multiple property entries — volume,
 * output_device, available_outputs, playback_active — that we merge
 * before rendering.
 */
export function MacPanel() {
  const state = useUIState();

  const macosByTarget = useMemo(() => {
    const grouped = new Map<string, Map<string, ServiceStateEntry>>();
    for (const s of state.serviceStates) {
      if (s.service_type !== "macos") continue;
      const byProperty = grouped.get(s.target) ?? new Map();
      byProperty.set(s.property, s);
      grouped.set(s.target, byProperty);
    }
    return grouped;
  }, [state.serviceStates]);

  const controllersByTarget = useMemo(() => {
    const grouped = new Map<string, Mapping[]>();
    for (const m of state.mappings) {
      if (m.service_type !== "macos") continue;
      const list = grouped.get(m.service_target) ?? [];
      list.push(m);
      grouped.set(m.service_target, list);
    }
    return grouped;
  }, [state.mappings]);

  const targets = useMemo(
    () => Array.from(macosByTarget.keys()).sort(),
    [macosByTarget]
  );

  return (
    <section className="space-y-2">
      <Subheading level={3}>macOS audio</Subheading>
      {targets.length === 0 ? (
        <Text>
          No macOS state yet. Run the `macos-hub` binary on a Mac and connect
          it to the mosquitto broker; an edge-agent with the `macos` feature
          enabled must also be connected.
        </Text>
      ) : (
        <div className="space-y-1.5">
          {targets.map((target) => (
            <MacRow
              key={target}
              target={target}
              properties={macosByTarget.get(target)!}
              controllers={controllersByTarget.get(target) ?? []}
            />
          ))}
        </div>
      )}
    </section>
  );
}
