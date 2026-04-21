import type { Mapping, UiFrame } from "./api";

/**
 * Pure helpers for rendering live WS frames as compact activity rows.
 *
 * `formatFrame` returns `null` for frames that aren't live activity
 * (snapshot, edge transitions, mapping/glyph config changes) — the recent
 * events panel only reflects actual device input and service state.
 */
export interface FormattedFrame {
  label: string;
  kind: "device_state" | "service_state";
}

export function formatFrame(
  frame: UiFrame,
  mappings: Mapping[]
): FormattedFrame | null {
  switch (frame.type) {
    case "device_state":
      return {
        kind: "device_state",
        label: formatDeviceState(frame, mappings),
      };
    case "service_state":
      return {
        kind: "service_state",
        label: formatServiceState(frame),
      };
    default:
      return null;
  }
}

function formatDeviceState(
  frame: Extract<UiFrame, { type: "device_state" }>,
  mappings: Mapping[]
): string {
  const devicePart = `${frame.device_type}[${frame.device_id}]`;
  const valueStr = compactValue(frame.value);
  const primitive = frame.property;
  const intent = resolveIntent(frame, mappings);
  const base = intent
    ? `${devicePart} ${primitive} → ${intent}`
    : `${devicePart} ${primitive}`;
  return valueStr ? `${base} (${valueStr})` : base;
}

function resolveIntent(
  frame: Extract<UiFrame, { type: "device_state" }>,
  mappings: Mapping[]
): string | null {
  const match = mappings.find(
    (m) =>
      m.edge_id === frame.edge_id &&
      m.device_type === frame.device_type &&
      m.device_id === frame.device_id
  );
  if (!match) return null;
  const route = match.routes.find((r) => r.input === frame.property);
  return route ? route.intent : null;
}

function formatServiceState(
  frame: Extract<UiFrame, { type: "service_state" }>
): string {
  const label = resolveServiceLabel(frame);
  const valueStr = compactValue(frame.value);
  const head = `${label} · ${frame.property}`;
  return valueStr ? `${head}=${valueStr}` : head;
}

function resolveServiceLabel(
  frame: Extract<UiFrame, { type: "service_state" }>
): string {
  const v = frame.value as { display_name?: string } | undefined;
  if (v && typeof v.display_name === "string" && v.display_name.length > 0) {
    return v.display_name;
  }
  return shorten(frame.target);
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return shorten(value, 40);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    // Prefer common single-field shapes before falling back to JSON.
    const obj = value as Record<string, unknown>;
    if ("playback" in obj) return String(obj.playback);
    if ("state" in obj) return String(obj.state);
    if ("brightness" in obj) return String(obj.brightness);
    if ("on" in obj) return obj.on ? "on" : "off";
    if ("value" in obj) return compactValue(obj.value);
    if ("display_name" in obj && typeof obj.display_name === "string") {
      return obj.display_name;
    }
    try {
      const json = JSON.stringify(obj);
      return shorten(json, 40);
    } catch {
      return "";
    }
  }
  return "";
}

function shorten(s: string, max = 24): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
