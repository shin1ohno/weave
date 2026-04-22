"use client";

import { useMemo } from "react";
import { useUIState } from "@/lib/ws";
import { Battery } from "@/components/icon";
import type { DeviceSummary } from "@/lib/devices";
import { NuimoViz } from "@/components/ConnectionsView/NuimoViz";

interface Props {
  device: DeviceSummary | null;
  firing: boolean;
}

/** Left rail of the TryItPanel. 160px NuimoViz + LED pattern label + a
 * three-column strip (battery / edge / firing indicator). Latency isn't
 * computed yet — the edge-agent needs to send a timestamped echo before
 * there's a meaningful number to display. */
export function NuimoMirror({ device, firing }: Props) {
  const { deviceStates } = useUIState();

  // Look up the latest LED label for the device. The edge-agent may emit
  // `led`, `led_pattern`, or neither — degrade gracefully.
  const ledLabel = useMemo(() => {
    if (!device) return null;
    const match = deviceStates.find(
      (d) =>
        d.edge_id === device.edge_id &&
        d.device_type === device.device_type &&
        d.device_id === device.device_id &&
        (d.property === "led" || d.property === "led_pattern")
    );
    if (!match) return null;
    return typeof match.value === "string" ? match.value : null;
  }, [deviceStates, device]);

  return (
    <div className="flex w-[240px] flex-none flex-col items-center gap-4 border-r border-zinc-950/5 p-6 dark:border-white/10">
      <NuimoViz
        pattern={device?.led ?? "blank"}
        size={160}
        firing={firing}
      />
      <div className="text-center">
        <div className="text-sm font-semibold text-zinc-950 dark:text-white">
          {device?.nickname ?? "—"}
        </div>
        <div className="font-mono text-[11px] text-zinc-500">
          {ledLabel ?? device?.led ?? "blank"}
        </div>
      </div>
      <div className="grid w-full grid-cols-3 gap-2 pt-4 text-center text-[11px]">
        <div>
          <Battery className="mx-auto mb-0.5 h-3 w-3 text-zinc-500" />
          <div className="font-mono text-zinc-700 dark:text-zinc-300">
            {device?.battery != null ? `${device.battery}%` : "—"}
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-zinc-500">edge</div>
          <div className="truncate font-mono text-zinc-700 dark:text-zinc-300">
            {device?.edge_id || "—"}
          </div>
        </div>
        <div>
          <div className="mb-0.5 text-zinc-500">state</div>
          <div className="font-mono text-zinc-700 dark:text-zinc-300">
            {firing ? "firing" : "idle"}
          </div>
        </div>
      </div>
    </div>
  );
}
