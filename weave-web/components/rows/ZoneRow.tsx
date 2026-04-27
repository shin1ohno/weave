"use client";

import Link from "next/link";
import { Mapping, ServiceStateEntry } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { useRowSelectionRegistration } from "@/hooks/useRowSelection";

interface Props {
  target: string;
  states: ServiceStateEntry[];
  controllers: Mapping[];
}

type VolumeVal = {
  type?: string;
  min?: number;
  max?: number;
  value?: number;
  is_muted?: boolean;
};

type NowPlayingVal = {
  two_line?: { line1?: string; line2?: string };
};

const PLAYBACK_COLORS: Record<string, "green" | "yellow" | "zinc" | "blue"> = {
  playing: "green",
  paused: "yellow",
  stopped: "zinc",
  loading: "blue",
};

export function ZoneRow({ target, states, controllers }: Props) {
  const playback = states.find((s) => s.property === "playback");
  const nowPlaying = states.find((s) => s.property === "now_playing");
  const volume = states.find((s) => s.property === "volume");
  const zone = states.find((s) => s.property === "zone");

  const displayName =
    (zone?.value as { display_name?: string } | undefined)?.display_name ??
    target;

  const np = nowPlaying?.value as NowPlayingVal | undefined;
  const vol = volume?.value as VolumeVal | undefined;

  const pbValue =
    typeof playback?.value === "string" ? playback.value : "unknown";
  const pbColor = PLAYBACK_COLORS[pbValue] ?? "zinc";

  // Deep-link edit goes to the first active controller if any.
  const primary = controllers.find((m) => m.active) ?? controllers[0];

  const { isSelected } = useRowSelectionRegistration({
    id: `zone:roon:${target}`,
    primaryMappingId: primary?.mapping_id,
  });

  return (
    <div
      data-selected={isSelected ? "true" : undefined}
      className={`rounded-md border bg-white px-4 py-2 text-sm shadow-sm dark:bg-zinc-900 ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500"
          : "border-zinc-950/5 dark:border-white/10"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Badge color={pbColor}>{pbValue}</Badge>
        <span className="min-w-0 truncate font-medium text-zinc-950 dark:text-white">
          {displayName}
        </span>
        {np?.two_line?.line1 && (
          <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">
            · {np.two_line.line1}
            {np.two_line.line2 ? ` — ${np.two_line.line2}` : ""}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {vol && typeof vol.value === "number" && (
            <VolumeIndicator vol={vol} />
          )}
          {primary && (
            <Link
              href={`/mappings/${primary.mapping_id}/edit`}
              className="rounded border border-zinc-200 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-label="Edit mapping"
            >
              edit
            </Link>
          )}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-mono truncate">{target}</span>
        {controllers.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {controllers.map((m) => (
              <span
                key={m.mapping_id}
                className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                ← {m.device_type}
                {m.edge_id ? ` [${m.edge_id}]` : ""}
                {m.target_switch_on ? ` · ${m.target_switch_on}` : ""}
              </span>
            ))}
          </span>
        ) : (
          <span className="italic">no controller</span>
        )}
      </div>
    </div>
  );
}

function VolumeIndicator({ vol }: { vol: VolumeVal }) {
  const v = vol.value ?? 0;
  const showBar =
    vol.type === "number" &&
    typeof vol.min === "number" &&
    typeof vol.max === "number";
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span>
        vol {v}
        {vol.type === "db" ? "dB" : ""}
      </span>
      {showBar && (
        <div className="h-1.5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-1.5 rounded-full bg-blue-500"
            style={{
              width: `${Math.min(
                100,
                Math.max(0, ((v - vol.min!) / (vol.max! - vol.min!)) * 100)
              )}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
