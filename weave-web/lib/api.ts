const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

export interface UiSnapshot {
  edges: EdgeInfo[];
  service_states: ServiceStateEntry[];
  device_states: DeviceStateEntry[];
  mappings: Mapping[];
  glyphs: Glyph[];
}

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
  | { type: "glyphs_changed"; glyphs: Glyph[] };

function wsUrl(path: string): string {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}${path}`;
}

export const WS_UI_URL = wsUrl("/ws/ui");

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
    body: JSON.stringify({ ...mapping, mapping_id: crypto.randomUUID() }),
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
