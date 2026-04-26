"use client";

import clsx from "clsx";
import { Battery, DEVICE_ICON, Link2, WifiOff } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import type { DeviceSummary } from "@/lib/devices";
import type { LastInput } from "@/lib/ws";
import { NuimoViz } from "./NuimoViz";

interface Props {
  device: DeviceSummary;
  selected: boolean;
  lastInput: LastInput | null;
  firing: boolean;
  onClick: () => void;
}

/** Pick the visual representation for the tile's leading slot.
 *
 * Nuimo gets its bespoke `NuimoViz` (LED matrix preview keyed off the
 * `led` device-state property). Every other device_type falls back to a
 * lucide icon from `DEVICE_ICON`; if no icon is registered, the slot
 * stays empty rather than showing a misleading Nuimo silhouette. */
function DeviceVisual({
  device,
  firing,
}: {
  device: DeviceSummary;
  firing: boolean;
}) {
  if (device.device_type === "nuimo") {
    return <NuimoViz pattern={device.led} size={56} firing={firing} />;
  }
  const Icon = DEVICE_ICON[device.device_type];
  if (!Icon) return <div className="h-14 w-14" />;
  return (
    <div
      className={clsx(
        "flex h-14 w-14 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
        firing && "ring-2 ring-orange-500"
      )}
    >
      <Icon className="h-8 w-8" />
    </div>
  );
}

function batteryColor(
  battery: number | null
): "green" | "amber" | "red" | "zinc" {
  if (battery == null) return "zinc";
  if (battery < 30) return "red";
  if (battery < 60) return "amber";
  return "green";
}

export function DeviceTile({
  device,
  selected,
  lastInput,
  firing,
  onClick,
}: Props) {
  const battery = device.battery;
  // `firing` is driven by useFiringTicker which rotates lastInputByDevice
  // entries in and out — use it rather than reading Date.now() at render.
  const showLastInput = firing && lastInput != null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "group relative w-full cursor-pointer rounded-xl border bg-white p-4 text-left shadow-sm transition dark:bg-zinc-900",
        selected
          ? "border-blue-500 ring-2 ring-blue-500/30"
          : "border-zinc-950/5 hover:border-zinc-950/10 dark:border-white/10 dark:hover:border-white/15",
        !device.connected && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <DeviceVisual device={device} firing={firing} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-base font-semibold text-zinc-950 dark:text-white">
              {device.nickname}
            </div>
            {firing && (
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-orange-500"
                aria-label="firing"
              />
            )}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {device.device_type} · {device.device_id.slice(-8)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {device.connected ? (
              <Badge color={batteryColor(battery)}>
                <Battery className="h-2.5 w-2.5" />
                {battery != null ? `${battery}%` : "—"}
              </Badge>
            ) : (
              <Badge color="zinc">
                <WifiOff className="h-2.5 w-2.5" />
                offline
              </Badge>
            )}
            <Badge color="zinc">
              <Link2 className="h-2.5 w-2.5" />
              {device.connectionsCount}
            </Badge>
          </div>
          {showLastInput && lastInput && (
            <div className="mt-2 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-500">
              now · {lastInput.input}
              {lastInput.value !== undefined &&
              lastInput.value !== null &&
              typeof lastInput.value !== "object"
                ? ` ${String(lastInput.value)}`
                : ""}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
