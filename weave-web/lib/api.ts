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
  device_type: string;
  device_id: string;
  service_type: string;
  service_target: string;
  routes: Route[];
  feedback: FeedbackRule[];
  active: boolean;
}

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

export async function createMapping(mapping: Omit<Mapping, "mapping_id">): Promise<Mapping> {
  const res = await fetch(`${API_BASE}/api/mappings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...mapping, mapping_id: crypto.randomUUID() }),
  });
  if (!res.ok) throw new Error(`Failed to create mapping: ${res.status}`);
  return res.json();
}

export async function updateMapping(id: string, mapping: Partial<Mapping>): Promise<Mapping> {
  const res = await fetch(`${API_BASE}/api/mappings/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mapping),
  });
  if (!res.ok) throw new Error(`Failed to update mapping: ${res.status}`);
  return res.json();
}

export async function deleteMapping(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/mappings/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete mapping: ${res.status}`);
}

export async function switchTarget(id: string, serviceTarget: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/mappings/${id}/target`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ service_target: serviceTarget }),
  });
  if (!res.ok) throw new Error(`Failed to switch target: ${res.status}`);
}
