import type { Route } from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface Preset {
  id: string;
  label: string;
  description: string;
  routes: Route[];
}

export async function listPresets(): Promise<Preset[]> {
  const res = await fetch(`${API_BASE}/api/presets`);
  if (!res.ok) throw new Error(`Failed to list presets: ${res.status}`);
  return res.json();
}
