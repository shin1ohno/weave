"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UiFrame, CommandResult, ErrorSeverity } from "@/lib/api";
import { useWsFrames } from "@/lib/ws";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveDot } from "@/components/ui/live-dot";
import {
  Play,
  Pause,
  X,
  Radio,
  Cpu,
  Send,
  AlertCircle,
  Lightbulb,
  Volume2,
  Disc3,
  type LucideIcon,
} from "@/components/icon";

export type StreamKind =
  | "input"
  | "device_state"
  | "service_state"
  | "command"
  | "error";

type CommonFields = { seq: number; at: number; edge_id: string };

export type StreamEntry = CommonFields &
  (
    | { kind: "input"; dev: string; input: string; value: unknown }
    | {
        kind: "device_state";
        dev: string;
        property: string;
        value: unknown;
      }
    | {
        kind: "service_state";
        service_type: string;
        target: string;
        property: string;
        value: unknown;
        output_id?: string;
      }
    | {
        kind: "command";
        service_type: string;
        target: string;
        intent: string;
        params: unknown;
        result: CommandResult;
        latency_ms?: number;
      }
    | {
        kind: "error";
        context: string;
        message: string;
        severity: ErrorSeverity;
      }
  );

/** `Omit<T, K>` on a discriminated union collapses the union; the
 * distributive form preserves each branch. Used for entries still being
 * assembled — `seq` is assigned when pushed into state. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never;
type StreamEntryInput = DistributiveOmit<StreamEntry, "seq">;

interface Props {
  /** Optional filter to narrow the stream. Returns true to keep the entry. */
  filter?: (e: StreamEntry) => boolean;
  /** Max rows to keep. Older rows drop off the top. */
  maxRows?: number;
  /** Controls the table's visual density / chrome. `drawer` fills the
   * parent; `inline` is sized for embedding inside another panel;
   * `compact` strips the chip bar for tight side-pane embeds. */
  variant?: "drawer" | "inline" | "compact";
  /** Optional title override. */
  title?: string;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
    d.getSeconds()
  )}.${pad(d.getMilliseconds(), 3)}`;
}

function devLabel(device_type: string, device_id: string): string {
  return `${device_type}/${device_id.slice(-8)}`;
}

/** Expand a single `UiFrame` into zero or more `StreamEntry` rows.
 * Non-event frames (snapshot, edge_*, mapping_*, glyphs_*) return []. */
function uiFrameToEntries(frame: UiFrame): StreamEntryInput[] {
  const at = Date.now();
  switch (frame.type) {
    case "device_state": {
      const dev = devLabel(frame.device_type, frame.device_id);
      if (frame.property === "input") {
        const v = frame.value;
        let input: string | null = null;
        if (typeof v === "string") input = v;
        else if (v && typeof v === "object") {
          const o = v as { input?: unknown; name?: unknown };
          if (typeof o.input === "string") input = o.input;
          else if (typeof o.name === "string") input = o.name;
        }
        if (!input) return [];
        return [
          {
            kind: "input",
            at,
            edge_id: frame.edge_id,
            dev,
            input,
            value: v,
          },
        ];
      }
      return [
        {
          kind: "device_state",
          at,
          edge_id: frame.edge_id,
          dev,
          property: frame.property,
          value: frame.value,
        },
      ];
    }
    case "service_state":
      return [
        {
          kind: "service_state",
          at,
          edge_id: frame.edge_id,
          service_type: frame.service_type,
          target: frame.target,
          property: frame.property,
          value: frame.value,
          output_id: frame.output_id,
        },
      ];
    case "command":
      return [
        {
          kind: "command",
          at,
          edge_id: frame.edge_id,
          service_type: frame.service_type,
          target: frame.target,
          intent: frame.intent,
          params: frame.params,
          result: frame.result,
          latency_ms: frame.latency_ms,
        },
      ];
    case "error":
      return [
        {
          kind: "error",
          at,
          edge_id: frame.edge_id,
          context: frame.context,
          message: frame.message,
          severity: frame.severity,
        },
      ];
    default:
      return [];
  }
}

interface KindDescriptor {
  label: string;
  icon: LucideIcon;
  /** Tailwind border color for the row's left 2px accent. */
  borderClass: string;
}

const KIND_DESCRIPTORS: Record<StreamKind, KindDescriptor> = {
  input: {
    label: "input",
    icon: Radio,
    borderClass: "border-l-blue-500",
  },
  device_state: {
    label: "device",
    icon: Cpu,
    borderClass: "border-l-slate-400",
  },
  service_state: {
    label: "state",
    icon: Volume2,
    borderClass: "border-l-purple-500",
  },
  command: {
    label: "cmd",
    icon: Send,
    borderClass: "border-l-amber-500",
  },
  error: {
    label: "error",
    icon: AlertCircle,
    borderClass: "border-l-red-500",
  },
};

const KIND_ORDER: StreamKind[] = [
  "input",
  "device_state",
  "service_state",
  "command",
  "error",
];

function iconForEntry(e: StreamEntry): LucideIcon {
  if (e.kind === "service_state") {
    if (e.service_type === "hue") return Lightbulb;
    if (e.service_type === "roon") return Volume2;
  }
  // `dev` is `${device_type}/${id-suffix}` (see devLabel) — peel off the
  // device_type to pick a controller-specific icon for input rows.
  if (e.kind === "input" || e.kind === "device_state") {
    if (e.dev.startsWith("hue_tap_dial/")) return Disc3;
  }
  return KIND_DESCRIPTORS[e.kind].icon;
}

/** Describes what shows in the "target or dev" column. */
function targetOrDev(e: StreamEntry): string {
  if (e.kind === "input" || e.kind === "device_state") return e.dev;
  if (e.kind === "service_state" || e.kind === "command")
    return `${e.service_type}/${e.target}`;
  return e.context;
}

function detailText(e: StreamEntry): string {
  switch (e.kind) {
    case "input":
      return e.input;
    case "device_state":
      return e.property;
    case "service_state":
      return e.property;
    case "command":
      return e.intent;
    case "error":
      return e.severity;
  }
}

function valueText(e: StreamEntry): string {
  switch (e.kind) {
    case "input":
      return formatValue(e.value);
    case "device_state":
    case "service_state":
      return formatValue(e.value);
    case "command": {
      const params = formatValue(e.params);
      const outcome =
        e.result.kind === "ok"
          ? e.latency_ms != null
            ? `ok (${e.latency_ms}ms)`
            : "ok"
          : `err: ${e.result.message}`;
      return params ? `${params} → ${outcome}` : outcome;
    }
    case "error":
      return e.message;
  }
}

function rowAccentClass(e: StreamEntry): string {
  if (e.kind === "command" && e.result.kind === "err") {
    return "border-l-red-500";
  }
  if (e.kind === "error" && e.severity === "warn") {
    return "border-l-amber-500";
  }
  return KIND_DESCRIPTORS[e.kind].borderClass;
}

/** Multi-select chip state, keyed by facet. Missing key ⇒ all observed
 * values in that facet are included. An empty `Set` means "nothing
 * selected" and the panel hides all rows for that facet. */
interface ChipState {
  kinds: Set<StreamKind>;
  edges: Set<string>;
  services: Set<string>;
  targets: Set<string>;
}

function emptyChipState(): ChipState {
  return {
    kinds: new Set<StreamKind>(KIND_ORDER),
    edges: new Set<string>(),
    services: new Set<string>(),
    targets: new Set<string>(),
  };
}

function observedFacets(entries: StreamEntry[]): {
  edges: string[];
  services: string[];
  targets: string[];
} {
  const edges = new Set<string>();
  const services = new Set<string>();
  const targets = new Set<string>();
  for (const e of entries) {
    edges.add(e.edge_id);
    if (
      e.kind === "service_state" ||
      e.kind === "command"
    ) {
      services.add(e.service_type);
      targets.add(`${e.service_type}/${e.target}`);
    }
  }
  return {
    edges: [...edges].sort(),
    services: [...services].sort(),
    targets: [...targets].sort(),
  };
}

function passesChips(e: StreamEntry, chips: ChipState): boolean {
  if (!chips.kinds.has(e.kind)) return false;
  if (chips.edges.size > 0 && !chips.edges.has(e.edge_id)) return false;
  if (e.kind === "service_state" || e.kind === "command") {
    if (chips.services.size > 0 && !chips.services.has(e.service_type)) {
      return false;
    }
    const tgt = `${e.service_type}/${e.target}`;
    if (chips.targets.size > 0 && !chips.targets.has(tgt)) return false;
  } else if (chips.services.size > 0 || chips.targets.size > 0) {
    // If a service/target filter is active, non-service rows are excluded
    // unless the user has explicitly unchecked all service/target chips.
    // Keeping facet-active behavior conservative: exclude.
    if (chips.services.size > 0) return false;
    if (chips.targets.size > 0) return false;
  }
  return true;
}

export function InputStreamPanel({
  filter,
  maxRows = 200,
  variant = "inline",
  title = "Input stream",
}: Props) {
  const [paused, setPaused] = useState(false);
  const [entries, setEntries] = useState<StreamEntry[]>([]);
  const [chips, setChips] = useState<ChipState>(() => emptyChipState());
  const seqRef = useRef(0);

  const push = useCallback(
    (e: StreamEntryInput) => {
      seqRef.current += 1;
      const withSeq = { ...e, seq: seqRef.current } as StreamEntry;
      if (filter && !filter(withSeq)) return;
      setEntries((prev) => {
        const rows = [...prev, withSeq];
        return rows.length > maxRows ? rows.slice(rows.length - maxRows) : rows;
      });
    },
    [filter, maxRows]
  );

  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useWsFrames((frame) => {
    if (pausedRef.current) return;
    for (const entry of uiFrameToEntries(frame)) push(entry);
  });

  const clear = useCallback(() => setEntries([]), []);

  const facets = useMemo(() => observedFacets(entries), [entries]);
  const visible = useMemo(
    () => entries.filter((e) => passesChips(e, chips)),
    [entries, chips]
  );
  const latest = visible[visible.length - 1]?.seq;

  const toggleKind = (k: StreamKind) =>
    setChips((prev) => {
      const next = new Set(prev.kinds);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return { ...prev, kinds: next };
    });
  const toggleFacet = (facet: "edges" | "services" | "targets", v: string) =>
    setChips((prev) => {
      const next = new Set(prev[facet]);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return { ...prev, [facet]: next };
    });

  const isCompact = variant === "compact";

  return (
    <div className={clsx("flex flex-col", variant === "drawer" && "h-full")}>
      <div
        className={clsx(
          "flex items-center gap-2 border-b border-zinc-950/5 dark:border-white/10",
          isCompact ? "px-3 py-1.5" : "px-4 py-3"
        )}
      >
        <LiveDot color="orange" firing />
        <h3
          className={clsx(
            "font-semibold text-zinc-950 dark:text-white",
            isCompact ? "text-xs" : "text-sm"
          )}
        >
          {title}
        </h3>
        <Badge color="zinc">{visible.length}</Badge>
        {!isCompact && (
          <div className="ml-auto flex items-center gap-1">
            <Button
              plain
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Resume stream" : "Pause stream"}
            >
              {paused ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button plain onClick={clear} aria-label="Clear stream">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        )}
      </div>
      {!isCompact && (
        <ChipBar
          facets={facets}
          chips={chips}
          toggleKind={toggleKind}
          toggleFacet={toggleFacet}
        />
      )}
      <div
        className={clsx(
          "overflow-y-auto font-mono text-[11px]",
          variant === "drawer"
            ? "flex-1"
            : isCompact
              ? "max-h-[88px]"
              : "max-h-60"
        )}
      >
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
            {paused
              ? "Stream paused — no new rows will appear."
              : entries.length === 0
                ? "Waiting for activity…"
                : "No rows match the current filter."}
          </p>
        ) : (
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 bg-white/90 backdrop-blur dark:bg-zinc-900/90">
              <tr className="text-left text-zinc-500 dark:text-zinc-400">
                <th className="px-3 py-1 font-normal">time</th>
                <th className="px-1 py-1 font-normal" aria-label="kind" />
                <th className="px-3 py-1 font-normal">edge</th>
                <th className="px-3 py-1 font-normal">target / dev</th>
                <th className="px-3 py-1 font-normal">detail</th>
                <th className="px-3 py-1 font-normal">value</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => {
                const Icon = iconForEntry(e);
                return (
                  <tr
                    key={e.seq}
                    className={clsx(
                      "border-l-2 text-zinc-700 dark:text-zinc-300",
                      rowAccentClass(e),
                      e.seq === latest && "stream-row-new"
                    )}
                  >
                    <td className="px-3 py-0.5 text-zinc-500">
                      {formatTime(e.at)}
                    </td>
                    <td className="px-1 py-0.5">
                      <Icon
                        className="h-3 w-3 text-zinc-500 dark:text-zinc-400"
                        aria-label={KIND_DESCRIPTORS[e.kind].label}
                      />
                    </td>
                    <td className="px-3 py-0.5">{e.edge_id}</td>
                    <td className="px-3 py-0.5">{targetOrDev(e)}</td>
                    <td className="px-3 py-0.5 text-zinc-900 dark:text-zinc-100">
                      {detailText(e)}
                    </td>
                    <td className="px-3 py-0.5 text-zinc-500">
                      {valueText(e)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface ChipBarProps {
  facets: { edges: string[]; services: string[]; targets: string[] };
  chips: ChipState;
  toggleKind: (k: StreamKind) => void;
  toggleFacet: (
    facet: "edges" | "services" | "targets",
    v: string
  ) => void;
}

function ChipBar({ facets, chips, toggleKind, toggleFacet }: ChipBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-950/5 px-3 py-2 text-[11px] dark:border-white/10">
      {KIND_ORDER.map((k) => (
        <Chip
          key={k}
          label={KIND_DESCRIPTORS[k].label}
          active={chips.kinds.has(k)}
          onClick={() => toggleKind(k)}
        />
      ))}
      {(facets.edges.length > 0 ||
        facets.services.length > 0 ||
        facets.targets.length > 0) && (
        <span className="mx-1 h-4 w-px bg-zinc-950/10 dark:bg-white/10" />
      )}
      {facets.edges.map((v) => (
        <Chip
          key={`e:${v}`}
          label={v}
          active={chips.edges.size === 0 || chips.edges.has(v)}
          onClick={() => toggleFacet("edges", v)}
          dimmed={chips.edges.size > 0 && !chips.edges.has(v)}
        />
      ))}
      {facets.services.map((v) => (
        <Chip
          key={`s:${v}`}
          label={v}
          active={chips.services.size === 0 || chips.services.has(v)}
          onClick={() => toggleFacet("services", v)}
          dimmed={chips.services.size > 0 && !chips.services.has(v)}
        />
      ))}
      {facets.targets.map((v) => (
        <Chip
          key={`t:${v}`}
          label={v}
          active={chips.targets.size === 0 || chips.targets.has(v)}
          onClick={() => toggleFacet("targets", v)}
          dimmed={chips.targets.size > 0 && !chips.targets.has(v)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  dimmed = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  dimmed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-full border px-2 py-0.5 font-medium transition-colors",
        active
          ? "border-zinc-950/10 bg-zinc-100 text-zinc-900 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
          : dimmed
            ? "border-transparent bg-transparent text-zinc-400 line-through dark:text-zinc-600"
            : "border-zinc-950/10 bg-transparent text-zinc-500 dark:border-white/10 dark:text-zinc-400"
      )}
    >
      {label}
    </button>
  );
}

function formatValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return "";
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>).filter(
      ([k]) => k !== "input" && k !== "name" && k !== "type"
    );
    if (entries.length === 0) return "";
    return entries
      .map(([k, val]) => `${k}=${JSON.stringify(val)}`)
      .join(" ");
  }
  return String(v);
}

/** Helper for the Try it panel: narrow a stream to one mapping's device
 * inputs plus the service side of the same mapping (commands dispatched to
 * its target, state echoes from the target, and errors that mention it). */
export function mappingFilter(
  edge_id: string,
  device_type: string,
  device_id: string,
  service_type?: string,
  service_target?: string
): (e: StreamEntry) => boolean {
  const dev = devLabel(device_type, device_id);
  return (e) => {
    if (e.edge_id !== edge_id) return false;
    if (e.kind === "input" || e.kind === "device_state") {
      return e.dev === dev;
    }
    if (
      service_type != null &&
      service_target != null &&
      (e.kind === "service_state" || e.kind === "command")
    ) {
      return e.service_type === service_type && e.target === service_target;
    }
    // Without service_target context, the try-it panel still benefits from
    // seeing any command/state for the same edge — the signal is tied to
    // the mapping's live invocation.
    return e.kind === "command" || e.kind === "service_state";
  };
}
