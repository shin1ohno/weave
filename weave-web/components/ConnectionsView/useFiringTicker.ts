"use client";

import { useEffect } from "react";
import {
  useFiringMappingIds,
  useLastInputByDevice,
  useUIDispatch,
  useUIState,
  useWsFrames,
} from "@/lib/ws";
import type { DeviceCycle, Mapping } from "@/lib/api";

/** Drives firing state from incoming WS frames. Two responsibilities:
 *
 * 1. When a `device_state` frame with `property === "input"` arrives,
 *    always update `lastInputByDevice` (so the device tile lights up
 *    even when no mapping exists yet — pressing an unmapped Nuimo
 *    should still confirm the device is alive). Additionally find every
 *    mapping attached to that device and add their IDs to
 *    `firingMappingIds` so the rule sentence + connection card highlight.
 *    Both flow through a single `fire_mapping` dispatch — matching is
 *    allowed to return zero mappings.
 * 2. Periodically GC expired entries — `unfire_mapping` for any mapping
 *    whose recorded device input is past its `expiresAt`, and
 *    `clear_input` for the device entry itself so the tile firing
 *    indicator drops. Runs every 500ms while anything is live.
 *
 * The property-name choice (`input`) is a best-effort guess at the
 * edge-agent's emit convention. If the contract turns out to use a
 * different property name, edit the filter below without touching state
 * shape. */
export function useFiringTicker() {
  const dispatch = useUIDispatch();
  const { mappings, deviceCycles } = useUIState();
  const firing = useFiringMappingIds();
  const lastInputByDevice = useLastInputByDevice();

  useWsFrames((frame) => {
    if (frame.type !== "device_state") return;
    if (frame.property !== "input") return;

    const input = extractInputName(frame.value);
    if (!input) return;

    // Match on (device_type, device_id) — the same physical device may
    // be reported by multiple edges (Hue Tap Dial visible to every edge
    // with `hue` capability), and the mapping's edge_id is just the one
    // we picked to handle routing.
    let matching: Mapping[] = mappings.filter(
      (m) =>
        m.device_type === frame.device_type &&
        m.device_id === frame.device_id &&
        m.routes.some((r) => r.input === input)
    );

    // Cycle-aware filter: when the device has a DeviceCycle, only the
    // active mapping actually fires (per server + edge engine). Other
    // cycle members and non-cycle mappings on this device sit dormant —
    // highlighting them as firing would be a UX lie. For devices
    // without a cycle, all matching mappings fire (legacy behavior
    // preserved).
    const cycle = lookupCycle(deviceCycles, frame.device_type, frame.device_id);
    if (cycle && cycle.active_mapping_id) {
      const activeId = cycle.active_mapping_id;
      matching = matching.filter((m) => m.mapping_id === activeId);
    }

    // Always dispatch — `mapping_ids` may be empty for an unmapped
    // device or a cycle with no active; the reducer still updates
    // `lastInputByDevice` so the tile shows the press visually.
    dispatch({
      kind: "fire_mapping",
      mapping_ids: matching.map((m) => m.mapping_id),
      device_id: frame.device_id,
      input,
      value: frame.value,
    });
  });

  useEffect(() => {
    const hasFiring = firing.size > 0;
    const hasInput = Object.keys(lastInputByDevice).length > 0;
    if (!hasFiring && !hasInput) return;
    const id = setInterval(() => {
      const now = Date.now();
      for (const [device_id, entry] of Object.entries(lastInputByDevice)) {
        if (entry.expiresAt > now) continue;
        // Drop any rule sentence highlights tied to this device.
        const expiredMappings = mappings.filter(
          (m) => m.device_id === device_id && firing.has(m.mapping_id)
        );
        for (const m of expiredMappings) {
          dispatch({ kind: "unfire_mapping", mapping_id: m.mapping_id });
        }
        // Drop the device-tile firing entry too. Without this, an
        // unmapped device tile would stay visually firing forever.
        dispatch({ kind: "clear_input", device_id });
      }
    }, 500);
    return () => clearInterval(id);
  }, [firing, lastInputByDevice, mappings, dispatch]);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractInputName(value: any): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    if (typeof value.input === "string") return value.input;
    if (typeof value.name === "string") return value.name;
  }
  return null;
}

function lookupCycle(
  cycles: Record<string, DeviceCycle>,
  deviceType: string,
  deviceId: string
): DeviceCycle | null {
  return cycles[`${deviceType}/${deviceId}`] ?? null;
}
