"use client";

import { useMemo } from "react";
import { useUIState } from "@/lib/ws";

/**
 * Return live value suggestions for a (serviceType, target, property) triple.
 * Collects primitive values (string / number / boolean coerced to string)
 * observed in `serviceStates`, deduplicated and sorted.
 *
 * Extracted from `FeedbackSection` so the same suggestion set can be reused
 * elsewhere without duplicating the filtering logic.
 */
export function useSuggestValues(
  serviceType: string,
  target: string,
  property: string
): string[] {
  const state = useUIState();

  return useMemo(() => {
    if (!property) return [];
    const values = new Set<string>();
    for (const s of state.serviceStates) {
      if (
        s.service_type !== serviceType ||
        s.target !== target ||
        s.property !== property
      )
        continue;
      if (typeof s.value === "string") values.add(s.value);
      else if (typeof s.value === "number" || typeof s.value === "boolean")
        values.add(String(s.value));
    }
    return Array.from(values).sort();
  }, [state.serviceStates, serviceType, target, property]);
}
