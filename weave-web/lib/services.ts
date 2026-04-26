import type { Mapping, ServiceStateEntry } from "./api";

/** The `meta` property on ServiceStateEntry that yields the
 * canonical "one row per target" view. Keyed by service_type.
 *
 * macos uses `output_device` because every macos-hub publishes it on
 * startup (retained), so a target row is created as soon as an
 * adapter_macos connects. `volume` and `playback_active` are overlayed
 * in the secondary pass. */
const META_PROPERTY_BY_SERVICE: Record<string, string> = {
  roon: "zone",
  hue: "light",
  macos: "output_device",
  ios_media: "now_playing",
};

export interface ServiceTarget {
  target: string;
  label: string;
  /** `playing` / `idle` for Roon, `on` / `off` for Hue, `null` when the
   * edge-agent hasn't pushed a derived status yet. */
  status: "playing" | "idle" | "on" | "off" | null;
  /** Volume (Roon) or brightness (Hue), 0-100, if known. */
  level: number | null;
  /** Currently-playing track string, if known (Roon only). */
  track: string | null;
  /** Count of mappings that target this (service_type, target). */
  linkedCount: number;
}

export interface ServiceSummary {
  type: string;
  label: string;
  running: boolean;
  targets: ServiceTarget[];
}

function extractLabel(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "display_name" in value) {
    const v = (value as { display_name: unknown }).display_name;
    if (typeof v === "string") return v;
  }
  return fallback;
}

function extractStatus(
  serviceType: string,
  value: unknown
): ServiceTarget["status"] {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (serviceType === "roon") {
    if (v.playback === "playing") return "playing";
    if (v.playback === "idle") return "idle";
    return null;
  }
  if (serviceType === "hue") {
    if (v.on === true) return "on";
    if (v.on === false) return "off";
    return null;
  }
  if (serviceType === "macos") {
    // playback_active payload is `{"active": bool | null}`. In the MVP
    // macos-hub always publishes null, so status typically stays null
    // and only the volume level is surfaced.
    if (v.active === true) return "playing";
    if (v.active === false) return "idle";
    return null;
  }
  if (serviceType === "ios_media") {
    // now_playing payload is `{ state: "playing" | "paused" | "stopped",
    // title, artist, ... }` (see weave-ios-core::adapter_ios_media).
    if (v.state === "playing") return "playing";
    if (v.state === "paused" || v.state === "stopped") return "idle";
    return null;
  }
  return null;
}

function extractLevel(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const candidates = [v.volume, v.brightness, v.level];
  for (const c of candidates) {
    if (typeof c === "number") return c;
  }
  return null;
}

function extractTrack(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const direct = v.track ?? v.now_playing;
  if (typeof direct === "string") return direct;
  // ios_media publishes a structured `now_playing` { title, artist, ... }
  // payload rather than a single string. Render it as "Title — Artist"
  // when both are present, falling back to whichever is non-null.
  const title = typeof v.title === "string" ? v.title : null;
  const artist = typeof v.artist === "string" ? v.artist : null;
  if (title && artist) return `${title} — ${artist}`;
  return title ?? artist;
}

const DEFAULT_LABELS: Record<string, string> = {
  roon: "Roon",
  hue: "Hue",
  macos: "macOS",
  ios_media: "Apple Music",
};

export function summarizeServices(
  serviceStates: ServiceStateEntry[],
  mappings: Mapping[]
): ServiceSummary[] {
  const byService = new Map<string, ServiceSummary>();

  const ensure = (type: string): ServiceSummary => {
    let s = byService.get(type);
    if (!s) {
      s = {
        type,
        label: DEFAULT_LABELS[type] ?? type,
        running: false,
        targets: [],
      };
      byService.set(type, s);
    }
    return s;
  };

  const targetIndex = new Map<string, ServiceTarget>();
  const targetKey = (type: string, target: string) => `${type}/${target}`;

  for (const entry of serviceStates) {
    const meta = META_PROPERTY_BY_SERVICE[entry.service_type];
    if (!meta) continue;
    if (entry.property !== meta) continue;
    const svc = ensure(entry.service_type);
    svc.running = true;
    const key = targetKey(entry.service_type, entry.target);
    let t = targetIndex.get(key);
    if (!t) {
      t = {
        target: entry.target,
        label: extractLabel(entry.value, entry.target),
        status: null,
        level: null,
        track: null,
        linkedCount: 0,
      };
      targetIndex.set(key, t);
      svc.targets.push(t);
    } else {
      t.label = extractLabel(entry.value, t.label);
    }
  }

  // Secondary pass: overlay playback / brightness / volume / track values
  // onto the already-created target rows.
  for (const entry of serviceStates) {
    const svc = byService.get(entry.service_type);
    if (!svc) continue;
    const t = targetIndex.get(targetKey(entry.service_type, entry.target));
    if (!t) continue;
    const maybeStatus = extractStatus(entry.service_type, entry.value);
    if (maybeStatus !== null) t.status = maybeStatus;
    const maybeLevel = extractLevel(entry.value);
    if (maybeLevel !== null) t.level = maybeLevel;
    const maybeTrack = extractTrack(entry.value);
    if (maybeTrack !== null) t.track = maybeTrack;
  }

  for (const m of mappings) {
    const t = targetIndex.get(targetKey(m.service_type, m.service_target));
    if (t) t.linkedCount += 1;
  }

  // Surface services that appear in mappings but have no state yet.
  for (const m of mappings) {
    if (!byService.has(m.service_type)) ensure(m.service_type);
  }

  const list = Array.from(byService.values());
  list.sort((a, b) => a.type.localeCompare(b.type));
  for (const svc of list) {
    svc.targets.sort((a, b) => a.label.localeCompare(b.label));
  }
  return list;
}

/** Resolve a (service_type, target) to a friendly label by peeking at the
 * aggregated services list. Returns the raw target when no label has been
 * seen yet. */
export function targetLabel(
  services: ServiceSummary[],
  service_type: string,
  target: string
): string {
  const svc = services.find((s) => s.type === service_type);
  if (!svc) return target;
  const t = svc.targets.find((x) => x.target === target);
  return t?.label ?? target;
}
