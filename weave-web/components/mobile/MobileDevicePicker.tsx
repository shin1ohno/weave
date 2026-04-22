"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { Battery, Plus } from "@/components/icon";
import { NuimoViz } from "@/components/ConnectionsView/NuimoViz";
import type { DeviceSummary } from "@/lib/devices";

interface ChipProps {
  device: DeviceSummary;
  selected: boolean;
  firing: boolean;
  onClick: () => void;
}

function DeviceChip({ device, selected, firing, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "flex min-w-[148px] flex-shrink-0 snap-start items-center gap-2 rounded-xl border p-2 text-left transition",
        selected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:bg-blue-500/10"
          : "border-zinc-950/5 bg-white dark:border-white/10 dark:bg-zinc-900",
        !device.connected && "opacity-60"
      )}
    >
      <NuimoViz pattern={device.led} size={36} firing={firing} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
            {device.nickname}
          </span>
          {firing && (
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500"
              aria-hidden
            />
          )}
        </div>
        <div className="truncate font-mono text-[10px] text-zinc-500">
          {device.connected ? (
            <>
              <Battery className="inline h-2.5 w-2.5" />
              {device.battery != null ? `${device.battery}%` : "—"} ·{" "}
              {device.connectionsCount}↔
            </>
          ) : (
            "offline"
          )}
        </div>
      </div>
    </button>
  );
}

interface Props {
  devices: DeviceSummary[];
  firingDeviceIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function MobileDevicePicker({
  devices,
  firingDeviceIds,
  selectedId,
  onSelect,
}: Props) {
  const router = useRouter();
  return (
    <div className="border-b border-zinc-950/5 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-950">
      <div
        className="flex gap-1.5 overflow-x-auto snap-x"
        style={{ scrollbarWidth: "none" }}
      >
        {devices.map((d) => (
          <DeviceChip
            key={d.device_id}
            device={d}
            selected={d.device_id === selectedId}
            firing={firingDeviceIds.has(d.device_id)}
            onClick={() =>
              onSelect(d.device_id === selectedId ? null : d.device_id)
            }
          />
        ))}
        <button
          type="button"
          onClick={() => router.push("/mappings/new")}
          className="flex min-w-[60px] flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-zinc-300 p-2 text-zinc-500 dark:border-white/15 dark:text-zinc-400"
          aria-label="Pair new device"
        >
          <Plus className="h-4 w-4" />
          <span className="text-[9px] font-medium">Pair</span>
        </button>
      </div>
    </div>
  );
}
