"use client";

import { useMemo } from "react";
import { useUIState } from "@/lib/ws";

export interface KnownTarget {
  target: string;
  label: string;
  glyph?: string;
}

/**
 * Return the set of live "known targets" for a given service type, derived
 * from `serviceStates` by filtering on the target-identity meta-property
 * (`hue → light`, `roon → zone`). Deduplicated by target; label prefers
 * `value.display_name` when present.
 *
 * Extracted from `TargetCandidatesSection` so the same heuristic can power
 * the inline `SwitchTargetPopover` without duplicating logic.
 */
export function useKnownTargets(serviceType: string): KnownTarget[] {
  const state = useUIState();

  return useMemo(() => {
    const metaProperty =
      serviceType === "hue"
        ? "light"
        : serviceType === "roon"
          ? "zone"
          : null;
    if (!metaProperty) return [];
    const seen = new Set<string>();
    const out: KnownTarget[] = [];
    for (const s of state.serviceStates) {
      if (s.service_type !== serviceType) continue;
      if (s.property !== metaProperty) continue;
      if (seen.has(s.target)) continue;
      seen.add(s.target);
      const label =
        (s.value as { display_name?: string } | undefined)?.display_name ??
        s.target;
      out.push({ target: s.target, label });
    }
    return out;
  }, [state.serviceStates, serviceType]);
}
