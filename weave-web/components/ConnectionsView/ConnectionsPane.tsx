"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plus, X } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import {
  useConnectionsFilter,
  useFiringMappingIds,
  useSelectedDevice,
  useUIState,
} from "@/lib/ws";
import { summarizeDevices, deviceForMapping } from "@/lib/devices";
import { summarizeServices } from "@/lib/services";
import { ConnectionCard } from "./ConnectionCard";
import { FilterChips } from "./FilterChips";

export function ConnectionsPane() {
  const { mappings, deviceStates, serviceStates } = useUIState();
  const [selectedDeviceId, setSelectedDevice] = useSelectedDevice();
  const [filter, setFilter] = useConnectionsFilter();
  const firingMappingIds = useFiringMappingIds();

  const devices = useMemo(
    () => summarizeDevices(deviceStates, mappings),
    [deviceStates, mappings]
  );
  const services = useMemo(
    () => summarizeServices(serviceStates, mappings),
    [serviceStates, mappings]
  );

  const selectedDevice = useMemo(
    () =>
      selectedDeviceId
        ? devices.find((d) => d.device_id === selectedDeviceId) ?? null
        : null,
    [devices, selectedDeviceId]
  );

  const filtered = useMemo(() => {
    return mappings
      .filter((m) =>
        selectedDeviceId ? m.device_id === selectedDeviceId : true
      )
      .filter((m) => {
        if (filter === "all") return true;
        if (filter === "active") return m.active;
        if (filter === "firing") return firingMappingIds.has(m.mapping_id);
        return true;
      })
      .sort((a, b) => a.mapping_id.localeCompare(b.mapping_id));
  }, [mappings, selectedDeviceId, filter, firingMappingIds]);

  return (
    <main className="flex min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Connections
          </h2>
          <Badge color="zinc">{filtered.length}</Badge>
          {selectedDevice && (
            <Badge color="blue">
              for {selectedDevice.nickname}
              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                aria-label="Clear device filter"
                className="ml-0.5 opacity-60 hover:opacity-100"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          )}
        </div>
        <FilterChips value={filter} onChange={setFilter} />
      </div>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        {filtered.map((m) => {
          const target =
            services
              .find((s) => s.type === m.service_type)
              ?.targets.find((t) => t.target === m.service_target) ?? null;
          const device = deviceForMapping(devices, m);
          return (
            <ConnectionCard
              key={m.mapping_id}
              mapping={m}
              device={device}
              target={target}
              firing={firingMappingIds.has(m.mapping_id)}
              lastEvent={null}
            />
          );
        })}
        <Link
          href={
            selectedDevice
              ? `/mappings/new?device_id=${encodeURIComponent(selectedDevice.device_id)}&device_type=${encodeURIComponent(selectedDevice.device_type)}&edge_id=${encodeURIComponent(selectedDevice.edge_id)}`
              : "/mappings/new"
          }
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 py-5 text-sm font-medium text-zinc-500 transition hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 dark:border-white/15 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:bg-blue-500/5 dark:hover:text-blue-400"
        >
          <Plus className="h-4 w-4" />
          New connection
          {selectedDevice ? ` from ${selectedDevice.nickname}` : ""}
        </Link>
        {selectedDevice && filtered.length === 0 && (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            No connections for {selectedDevice.nickname} yet.
          </p>
        )}
        {filter === "firing" && filtered.length === 0 && (
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            Nothing firing right now.
          </p>
        )}
      </div>
    </main>
  );
}
