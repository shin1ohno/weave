"use client";

import { useEffect } from "react";
import {
  useFiringMappingIds,
  useLastInputByDevice,
  useUIDispatch,
  useUIState,
  useWsFrames,
} from "@/lib/ws";
import type { Mapping } from "@/lib/api";

/** Drives firing state from incoming WS frames. Two responsibilities:
 *
 * 1. When a `device_state` frame with `property === "input"` arrives, find
 *    every mapping attached to that device and dispatch `fire_mapping` for
 *    them (TTL defaults to 2s).
 * 2. Periodically GC expired entries — firing mapping IDs whose
 *    lastInputByDevice slot is past its `expiresAt` get cleared via
 *    `unfire_mapping`. Runs every 500ms while anything is firing.
 *
 * The property-name choice (`input`) is a best-effort guess at the
 * edge-agent's emit convention. If the contract turns out to use a
 * different property name, edit the filter below without touching state
 * shape. */
export function useFiringTicker() {
  const dispatch = useUIDispatch();
  const { mappings } = useUIState();
  const firing = useFiringMappingIds();
  const lastInputByDevice = useLastInputByDevice();

  useWsFrames((frame) => {
    if (frame.type !== "device_state") return;
    if (frame.property !== "input") return;

    const input = extractInputName(frame.value);
    if (!input) {
      // Surfaces malformed `input` payloads that slip past the property
      // filter — useful when the edge sends a shape useFiringTicker doesn't
      // recognise (and which therefore never lights the device tile).
      console.warn("[firing] input name extraction failed", {
        value: frame.value,
        frame,
      });
      return;
    }

    const matching: Mapping[] = mappings.filter(
      (m) =>
        m.edge_id === frame.edge_id &&
        m.device_type === frame.device_type &&
        m.device_id === frame.device_id &&
        m.routes.some((r) => r.input === input)
    );
    if (matching.length === 0) {
      // Helps diagnose "Stream shows the rotation but the icon stays idle":
      // typically the device emits with a different edge_id/device_id (e.g.
      // an iPad-side bridge tagging events differently) or no Connection
      // exists for this device yet. Logged with both sides so the mismatch
      // is visible without instrumenting the server.
      console.warn("[firing] no matching mapping for input frame", {
        incoming: {
          edge_id: frame.edge_id,
          device_type: frame.device_type,
          device_id: frame.device_id,
          input,
        },
        candidates: mappings.map((m) => ({
          mapping_id: m.mapping_id,
          edge_id: m.edge_id,
          device_type: m.device_type,
          device_id: m.device_id,
          route_inputs: m.routes.map((r) => r.input),
        })),
      });
      return;
    }

    dispatch({
      kind: "fire_mapping",
      mapping_ids: matching.map((m) => m.mapping_id),
      device_id: frame.device_id,
      input,
      value: frame.value,
    });
  });

  useEffect(() => {
    if (firing.size === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      for (const [device_id, entry] of Object.entries(lastInputByDevice)) {
        if (entry.expiresAt > now) continue;
        const expiredMappings = mappings.filter(
          (m) => m.device_id === device_id && firing.has(m.mapping_id)
        );
        for (const m of expiredMappings) {
          dispatch({ kind: "unfire_mapping", mapping_id: m.mapping_id });
        }
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
