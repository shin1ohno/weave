// Template CRUD helpers. A Template bundles a preset name + description +
// glyph + a domain hint + a default `routes` and `feedback` payload, so the
// "conversation builder" UI can offer one-tap onboarding for common
// device-to-service pairings (Music / Lights / Single button etc.).
//
// Mirrors the fetch + error-handling style of `lib/api.ts`. Uses the same
// `NEXT_PUBLIC_API_URL` env var so a single `.env.local` configures every
// REST call uniformly.

import type { FeedbackRule, Route } from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface Template {
  id: string;
  label: string;
  description: string;
  icon: string;
  builtin: boolean;
  domain: "playback" | "light" | "generic";
  routes: Route[];
  feedback: FeedbackRule[];
  created_at: string;
}

export async function listTemplates(): Promise<Template[]> {
  const res = await fetch(`${API_BASE}/api/templates`);
  if (!res.ok) throw new Error(`Failed to list templates: ${res.status}`);
  return res.json();
}

export async function createTemplate(
  template: Omit<Template, "id" | "created_at" | "builtin">
): Promise<Template> {
  const res = await fetch(`${API_BASE}/api/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(template),
  });
  if (!res.ok) throw new Error(`Failed to create template: ${res.status}`);
  return res.json();
}

export async function updateTemplate(template: Template): Promise<Template> {
  const res = await fetch(
    `${API_BASE}/api/templates/${encodeURIComponent(template.id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template),
    }
  );
  if (!res.ok) throw new Error(`Failed to update template: ${res.status}`);
  return res.json();
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/templates/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(`Failed to delete template: ${res.status}`);
}
