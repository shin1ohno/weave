"use client";

import Link from "next/link";
import { Mapping, ServiceStateEntry } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { useRowSelectionRegistration } from "@/hooks/useRowSelection";

interface Props {
  target: string;
  /** All `service_type = "macos"` state entries for this target, keyed by
   * `property` (e.g. "volume", "output_device", "playback_active"). */
  properties: Map<string, ServiceStateEntry>;
  controllers: Mapping[];
}

interface VolumeValue {
  level?: number;
}

interface OutputDeviceValue {
  name?: string;
  uid?: string;
  is_airplay?: boolean;
}

interface PlaybackActiveValue {
  active?: boolean | null;
}

export function MacRow({ target, properties, controllers }: Props) {
  const volumeEntry = properties.get("volume");
  const outputEntry = properties.get("output_device");
  const playbackEntry = properties.get("playback_active");

  const volumeValue = volumeEntry?.value as VolumeValue | undefined;
  const volume =
    typeof volumeValue?.level === "number" ? volumeValue.level : null;

  const outputValue = outputEntry?.value as OutputDeviceValue | undefined;
  const outputName = outputValue?.name ?? null;
  const outputIsAirPlay = outputValue?.is_airplay === true;

  const playbackValue = playbackEntry?.value as PlaybackActiveValue | undefined;
  const playback =
    playbackValue?.active === true
      ? ("playing" as const)
      : playbackValue?.active === false
        ? ("paused" as const)
        : null;

  const primary = controllers.find((m) => m.active) ?? controllers[0];

  const { isSelected } = useRowSelectionRegistration({
    id: `mac:macos:${target}`,
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
        {playback && (
          <Badge color={playback === "playing" ? "emerald" : "zinc"}>
            {playback}
          </Badge>
        )}
        <span className="min-w-0 truncate font-medium text-zinc-950 dark:text-white">
          {target}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {outputName && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
              {outputIsAirPlay && <Badge color="sky">AirPlay</Badge>}
              <span className="truncate max-w-[14rem]">→ {outputName}</span>
            </span>
          )}
          {volume !== null && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{Math.round(volume)}%</span>
              <div className="h-1.5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-1.5 rounded-full bg-emerald-400"
                  style={{
                    width: `${Math.max(0, Math.min(100, volume))}%`,
                  }}
                />
              </div>
            </div>
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
        <span className="font-mono truncate">macos:{target}</span>
        {controllers.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {controllers.map((m) => (
              <span
                key={m.mapping_id}
                className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                ← {m.device_type}
                {m.edge_id ? ` [${m.edge_id}]` : ""}
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
