import type { DeviceStateEntry, Mapping } from "./api";

/** Composite device identity. Mapping rows and DeviceStateEntry rows share
 * (edge_id, device_type, device_id) — the triple is what must match. */
export interface DeviceKey {
  edge_id: string;
  device_type: string;
  device_id: string;
}

export function deviceKeyString(k: DeviceKey): string {
  return `${k.edge_id}/${k.device_type}/${k.device_id}`;
}

export function parseDeviceKey(s: string): DeviceKey | null {
  const parts = s.split("/");
  if (parts.length !== 3) return null;
  const [edge_id, device_type, device_id] = parts;
  return { edge_id, device_type, device_id };
}

export interface DeviceSummary extends DeviceKey {
  /** Best-effort nickname. Falls back to the last 8 chars of device_id when
   * no `nickname` property has ever been seen. */
  nickname: string;
  /** Battery percent (0-100) if the edge-agent has ever reported it. */
  battery: number | null;
  /** LED pattern name (e.g., 'play', 'pause', 'vol_mid') if reported, else
   * 'blank'. Feeds into NuimoViz. */
  led: string;
  /** Number of mappings that name this device. */
  connectionsCount: number;
  /** True when any mapping referencing this device has been observed active
   * OR when a deviceState was seen in the current session. */
  connected: boolean;
  /** Timestamp of the most recent state entry for this device, if any. */
  lastSeen: string | null;
}

function readString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "value" in v) {
    const inner = (v as { value: unknown }).value;
    return typeof inner === "string" ? inner : null;
  }
  return null;
}

function readNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "value" in v) {
    const inner = (v as { value: unknown }).value;
    return typeof inner === "number" ? inner : null;
  }
  return null;
}

function readBoolean(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v && typeof v === "object" && "value" in v) {
    const inner = (v as { value: unknown }).value;
    return typeof inner === "boolean" ? inner : null;
  }
  return null;
}

/** Aggregate DeviceStateEntry rows into one DeviceSummary per device. Falls
 * back to extracting devices from the mappings list so that a mapping whose
 * edge is offline still renders a tile.
 *
 * Property name conventions follow the edge-agent's emit contract: they are
 * permissive here so a missing/renamed property degrades gracefully rather
 * than hiding the device. */
export function summarizeDevices(
  deviceStates: DeviceStateEntry[],
  mappings: Mapping[]
): DeviceSummary[] {
  const byKey = new Map<string, DeviceSummary>();

  const ensure = (k: DeviceKey): DeviceSummary => {
    const key = deviceKeyString(k);
    let existing = byKey.get(key);
    if (!existing) {
      existing = {
        edge_id: k.edge_id,
        device_type: k.device_type,
        device_id: k.device_id,
        nickname: k.device_id.slice(-8),
        battery: null,
        led: "blank",
        connectionsCount: 0,
        connected: false,
        lastSeen: null,
      };
      byKey.set(key, existing);
    }
    return existing;
  };

  for (const d of deviceStates) {
    const dev = ensure(d);
    if (!dev.lastSeen || d.updated_at > dev.lastSeen) dev.lastSeen = d.updated_at;

    // Any state entry other than the explicit "connected" property implies
    // the device was reachable when emitting it — used as a fallback for
    // edges that don't publish their own connection state (e.g., Hue
    // bridge devices). The explicit "connected" property below overrides.
    if (d.property !== "connected") {
      dev.connected = true;
    }

    if (d.property === "nickname") {
      const s = readString(d.value);
      if (s) dev.nickname = s;
    } else if (d.property === "battery") {
      const n = readNumber(d.value);
      if (n != null) dev.battery = n;
    } else if (d.property === "led" || d.property === "led_pattern") {
      const s = readString(d.value);
      if (s) dev.led = s;
    }
  }

  // Pass 2: explicit "connected" property is authoritative. iOS BleBridge
  // publishes this on `centralManager(_:didConnect:)` /
  // `didDisconnectPeripheral` so the tile reflects real BLE state.
  for (const d of deviceStates) {
    if (d.property === "connected") {
      const dev = ensure(d);
      const b = readBoolean(d.value);
      if (b != null) dev.connected = b;
    }
  }

  for (const m of mappings) {
    const dev = ensure({
      edge_id: m.edge_id,
      device_type: m.device_type,
      device_id: m.device_id,
    });
    dev.connectionsCount += 1;
  }

  const out = Array.from(byKey.values());
  out.sort((a, b) =>
    a.edge_id !== b.edge_id
      ? a.edge_id.localeCompare(b.edge_id)
      : a.nickname.localeCompare(b.nickname)
  );
  return out;
}

/** Find a DeviceSummary for the given mapping, or null if the mapping's
 * device has neither state nor tile — which can happen briefly during
 * `POST /api/mappings` before the first device_state arrives. */
export function deviceForMapping(
  summaries: DeviceSummary[],
  mapping: Pick<Mapping, "edge_id" | "device_type" | "device_id">
): DeviceSummary | null {
  return (
    summaries.find(
      (d) =>
        d.edge_id === mapping.edge_id &&
        d.device_type === mapping.device_type &&
        d.device_id === mapping.device_id
    ) ?? null
  );
}
