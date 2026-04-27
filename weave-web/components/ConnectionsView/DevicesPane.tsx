"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "@/components/icon";
import {
  useLastInputByDevice,
  useSelectedDevice,
  useUIState,
} from "@/lib/ws";
import { deviceKeyString, summarizeDevices } from "@/lib/devices";
import { InputStreamPanel } from "@/components/InputStreamPanel";
import { DeviceTile } from "./DeviceTile";

export function DevicesPane() {
  const { deviceStates, mappings } = useUIState();
  const lastInputByDevice = useLastInputByDevice();
  const [selectedDeviceId, setSelected] = useSelectedDevice();

  const devices = useMemo(
    () => summarizeDevices(deviceStates, mappings),
    [deviceStates, mappings]
  );

  // A device tile is "firing" iff `lastInputByDevice` has an entry for
  // its device_id. Driven directly by input frames in `useFiringTicker`
  // — works for unmapped devices too (pressing a brand-new Nuimo should
  // confirm the device is alive even before the user has wired up a
  // Connection). `useFiringTicker`'s 500ms GC tick dispatches
  // `clear_input` for entries past their `expiresAt`, which removes the
  // entry from the slice and re-runs this memo so the tile drops the
  // firing indicator. Avoids reading the wall clock here, which the
  // `react-hooks/purity` lint rejects.
  const firingDeviceKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const d of devices) {
      if (lastInputByDevice[d.device_id]) {
        keys.add(deviceKeyString(d));
      }
    }
    return keys;
  }, [devices, lastInputByDevice]);

  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Devices
          </h2>
          <Badge color="zinc">{devices.length}</Badge>
        </div>
        <Button
          plain
          disabled
          aria-label="Pair a new device (coming soon)"
          title="Pair a new device (coming soon)"
        >
          <Plus className="h-3.5 w-3.5" />
          Pair
        </Button>
      </div>
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
        {devices.length === 0 ? (
          <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
            No devices have reported in yet. Point an edge-agent at{" "}
            <code className="font-mono text-xs">ws://HOST/ws/edge</code>.
          </p>
        ) : (
          devices.map((d) => {
            const key = deviceKeyString(d);
            const lastInput = lastInputByDevice[d.device_id] ?? null;
            return (
              <DeviceTile
                key={key}
                device={d}
                selected={selectedDeviceId === d.device_id}
                lastInput={lastInput}
                firing={firingDeviceKeys.has(key)}
                onClick={() =>
                  setSelected(
                    selectedDeviceId === d.device_id ? null : d.device_id
                  )
                }
              />
            );
          })
        )}
      </div>
      {devices.length > 0 && (
        <div className="rounded-xl border border-zinc-950/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <InputStreamPanel
            variant="compact"
            maxRows={3}
            title="Recent input"
          />
        </div>
      )}
    </aside>
  );
}
