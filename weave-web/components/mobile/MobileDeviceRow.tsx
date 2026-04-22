"use client";

import clsx from "clsx";
import { Badge } from "@/components/ui/badge";
import {
  Battery,
  ChevronRight,
  Link2,
  WifiOff,
} from "@/components/icon";
import { NuimoViz } from "@/components/ConnectionsView/NuimoViz";
import type { DeviceSummary } from "@/lib/devices";

function batteryColor(
  battery: number | null
): "green" | "amber" | "red" | "zinc" {
  if (battery == null) return "zinc";
  if (battery < 30) return "red";
  if (battery < 60) return "amber";
  return "green";
}

interface Props {
  device: DeviceSummary;
  firing: boolean;
}

/** One row per device in the Devices tab. More verbose than the
 * DevicePicker chip — shows the last 8 of the MAC, battery with color, and
 * a chevron affordance. No onClick for now; device detail is out of scope. */
export function MobileDeviceRow({ device: d, firing }: Props) {
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-xl border border-zinc-950/5 bg-white p-3 dark:border-white/10 dark:bg-zinc-900",
        !d.connected && "opacity-60"
      )}
    >
      <NuimoViz pattern={d.led} size={48} firing={firing} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
            {d.nickname}
          </div>
          {firing && (
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500"
              aria-hidden
            />
          )}
        </div>
        <div className="font-mono text-[10px] text-zinc-500">
          {d.device_id.slice(-8)}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {d.connected ? (
            <Badge color={batteryColor(d.battery)}>
              <Battery className="h-2 w-2" />
              {d.battery != null ? `${d.battery}%` : "—"}
            </Badge>
          ) : (
            <Badge color="zinc">
              <WifiOff className="h-2 w-2" />
              offline
            </Badge>
          )}
          <Badge color="zinc">
            <Link2 className="h-2 w-2" />
            {d.connectionsCount}
          </Badge>
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
    </div>
  );
}
