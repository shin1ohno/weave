// API base URL. Empty string means "same origin" (useful when weave-web is
// proxied by Next.js rewrites to weave-server). Set NEXT_PUBLIC_API_URL for
// standalone dev (e.g. npm run dev without the proxy).
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface Route {
  input: string;
  intent: string;
  params?: { damping?: number };
}

export interface FeedbackRule {
  state: string;
  feedback_type: string;
  mapping: unknown;
}

export interface TargetCandidate {
  target: string;
  label: string;
  glyph: string;
  /**
   * Optional: override the parent mapping's `service_type` when this
   * candidate is the active target. Lets one mapping cycle between, e.g.,
   * a Roon zone and a Hue light. When undefined, inherits the mapping's
   * service_type.
   */
  service_type?: string;
  /**
   * Optional: override the parent mapping's `routes` when this candidate
   * is active. In practice mandatory when `service_type` differs because
   * intents are service-specific (Roon `volume_change` vs Hue
   * `brightness_change`). When undefined, inherits the mapping's routes.
   */
  routes?: Route[];
}

export interface Mapping {
  mapping_id: string;
  edge_id: string;
  device_type: string;
  device_id: string;
  service_type: string;
  service_target: string;
  routes: Route[];
  feedback: FeedbackRule[];
  active: boolean;
  target_candidates: TargetCandidate[];
  target_switch_on: string | null;
}

export interface Glyph {
  name: string;
  pattern: string;
  builtin: boolean;
}

export interface EdgeInfo {
  edge_id: string;
  online: boolean;
  version: string;
  capabilities: string[];
  last_seen: string;
  /** Wifi signal strength as 0-100 percent. `null` until edge-agent reports it. */
  wifi: number | null;
  /** Round-trip ms between server and edge. `null` until edge-agent reports it. */
  latency_ms: number | null;
  /** True when the edge has finished its `Hello` handshake on the current ws. */
  connected: boolean;
}

export interface ServiceStateEntry {
  edge_id: string;
  service_type: string;
  target: string;
  property: string;
  output_id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  updated_at: string;
}

export interface DeviceStateEntry {
  edge_id: string;
  device_type: string;
  device_id: string;
  property: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  updated_at: string;
}

export interface DeviceCycle {
  device_type: string;
  device_id: string;
  /** Mapping IDs in cycle order. */
  mapping_ids: string[];
  /** Currently active mapping (one of `mapping_ids`). `null` when the cycle
   * is empty. */
  active_mapping_id: string | null;
  /** Snake-case input name (e.g. `"swipe_up"`) that advances active.
   * `null` = cycle exists but has no on-device gesture binding. */
  cycle_gesture: string | null;
}

export interface UiSnapshot {
  edges: EdgeInfo[];
  service_states: ServiceStateEntry[];
  device_states: DeviceStateEntry[];
  mappings: Mapping[];
  glyphs: Glyph[];
  /** Device-level Connection cycles. When a cycle exists for a (device_type,
   * device_id), only the active mapping fires — see weave-engine
   * `RoutingEngine::route` for the filter. */
  device_cycles: DeviceCycle[];
}

/** Per-command outcome carried by `UiFrame::Command`. `kind` matches the
 * Rust-side `CommandResult` tag. */
export type CommandResult =
  | { kind: "ok" }
  | { kind: "err"; message: string };

export type ErrorSeverity = "warn" | "error" | "fatal";

export type UiFrame =
  | { type: "snapshot"; snapshot: UiSnapshot }
  | { type: "edge_online"; edge: EdgeInfo }
  | { type: "edge_offline"; edge_id: string }
  | {
      type: "service_state";
      edge_id: string;
      service_type: string;
      target: string;
      property: string;
      output_id?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: any;
    }
  | {
      type: "device_state";
      edge_id: string;
      device_type: string;
      device_id: string;
      property: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: any;
    }
  | {
      type: "mapping_changed";
      mapping_id: string;
      op: "upsert" | "delete";
      mapping: Mapping | null;
    }
  | { type: "glyphs_changed"; glyphs: Glyph[] }
  | {
      type: "command";
      edge_id: string;
      service_type: string;
      target: string;
      intent: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params: any;
      result: CommandResult;
      latency_ms?: number;
      output_id?: string;
      at: string;
    }
  | {
      type: "error";
      edge_id: string;
      context: string;
      message: string;
      severity: ErrorSeverity;
      at: string;
    }
  | {
      type: "edge_status";
      edge_id: string;
      wifi: number | null;
      latency_ms: number | null;
    }
  | {
      type: "device_cycle_changed";
      device_type: string;
      device_id: string;
      op: "upsert" | "delete";
      cycle: DeviceCycle | null;
    };

/** Compute absolute WebSocket URL. Called lazily from client code so that
 * `window.location.origin` is available when API_BASE is empty (proxied
 * deployment). */
export function wsUrl(path: string): string {
  if (API_BASE) {
    return API_BASE.replace(/^http/, "ws") + path;
  }
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/^http/, "ws") + path;
  }
  return `ws://localhost${path}`;
}

// --- Mappings ---

export async function listMappings(): Promise<Mapping[]> {
  const res = await fetch(`${API_BASE}/api/mappings`);
  if (!res.ok) throw new Error(`Failed to list mappings: ${res.status}`);
  return res.json();
}

export async function getMapping(id: string): Promise<Mapping> {
  const res = await fetch(`${API_BASE}/api/mappings/${id}`);
  if (!res.ok) throw new Error(`Failed to get mapping: ${res.status}`);
  return res.json();
}

export async function createMapping(
  mapping: Omit<Mapping, "mapping_id">
): Promise<Mapping> {
  const res = await fetch(`${API_BASE}/api/mappings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapping),
  });
  if (!res.ok) throw new Error(`Failed to create mapping: ${res.status}`);
  return res.json();
}

export async function updateMapping(
  id: string,
  mapping: Partial<Mapping>
): Promise<Mapping> {
  const res = await fetch(`${API_BASE}/api/mappings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapping),
  });
  if (!res.ok) throw new Error(`Failed to update mapping: ${res.status}`);
  return res.json();
}

export async function deleteMapping(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/mappings/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete mapping: ${res.status}`);
}

export async function switchTarget(
  id: string,
  serviceTarget: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/mappings/${id}/target`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service_target: serviceTarget }),
  });
  if (!res.ok) throw new Error(`Failed to switch target: ${res.status}`);
}

// --- Device cycles ---

export async function getDeviceCycle(
  deviceType: string,
  deviceId: string
): Promise<DeviceCycle | null> {
  const res = await fetch(
    `${API_BASE}/api/devices/${encodeURIComponent(deviceType)}/${encodeURIComponent(deviceId)}/cycle`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get cycle: ${res.status}`);
  return res.json();
}

export async function putDeviceCycle(
  deviceType: string,
  deviceId: string,
  body: {
    mapping_ids: string[];
    active_mapping_id?: string | null;
    cycle_gesture?: string | null;
  }
): Promise<DeviceCycle> {
  const res = await fetch(
    `${API_BASE}/api/devices/${encodeURIComponent(deviceType)}/${encodeURIComponent(deviceId)}/cycle`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`Failed to put cycle: ${res.status}`);
  return res.json();
}

export async function deleteDeviceCycle(
  deviceType: string,
  deviceId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/devices/${encodeURIComponent(deviceType)}/${encodeURIComponent(deviceId)}/cycle`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== 404)
    throw new Error(`Failed to delete cycle: ${res.status}`);
}

export async function switchActiveConnection(
  deviceType: string,
  deviceId: string,
  activeMappingId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/devices/${encodeURIComponent(deviceType)}/${encodeURIComponent(deviceId)}/cycle/switch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active_mapping_id: activeMappingId }),
    }
  );
  if (!res.ok)
    throw new Error(`Failed to switch active connection: ${res.status}`);
}

// --- Glyphs ---

export async function listGlyphs(): Promise<Glyph[]> {
  const res = await fetch(`${API_BASE}/api/glyphs`);
  if (!res.ok) throw new Error(`Failed to list glyphs: ${res.status}`);
  return res.json();
}

export async function getGlyph(name: string): Promise<Glyph> {
  const res = await fetch(`${API_BASE}/api/glyphs/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Failed to get glyph: ${res.status}`);
  return res.json();
}

export async function putGlyph(glyph: Glyph): Promise<Glyph> {
  const res = await fetch(
    `${API_BASE}/api/glyphs/${encodeURIComponent(glyph.name)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(glyph),
    }
  );
  if (!res.ok) throw new Error(`Failed to put glyph: ${res.status}`);
  return res.json();
}

export async function deleteGlyph(name: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/glyphs/${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(`Failed to delete glyph: ${res.status}`);
}

// --- Device control ---
//
// Each helper POSTs an empty body to a path containing the device triple
// `(edge_id, device_type, device_id)`. The server pushes a `ServerToEdge`
// frame to the named edge and returns 202 Accepted; we don't wait for an
// edge-side ack. 404 surfaces as a thrown Error — typically meaning the
// edge isn't currently connected.

async function postDeviceCommand(
  action: "connect" | "disconnect" | "test-glyph",
  edgeId: string,
  deviceType: string,
  deviceId: string
): Promise<void> {
  const url =
    `${API_BASE}/api/devices/${encodeURIComponent(edgeId)}` +
    `/${encodeURIComponent(deviceType)}/${encodeURIComponent(deviceId)}/${action}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Edge ${edgeId} is not currently connected`);
    }
    throw new Error(`Failed to ${action} device: ${res.status}`);
  }
}

export async function connectDevice(
  edgeId: string,
  deviceType: string,
  deviceId: string
): Promise<void> {
  return postDeviceCommand("connect", edgeId, deviceType, deviceId);
}

export async function disconnectDevice(
  edgeId: string,
  deviceType: string,
  deviceId: string
): Promise<void> {
  return postDeviceCommand("disconnect", edgeId, deviceType, deviceId);
}

export async function testGlyphADevice(
  edgeId: string,
  deviceType: string,
  deviceId: string
): Promise<void> {
  return postDeviceCommand("test-glyph", edgeId, deviceType, deviceId);
}
