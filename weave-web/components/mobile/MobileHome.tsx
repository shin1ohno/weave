"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "@/components/icon";
import {
  useFiringMappingIds,
  useLastInputByDevice,
  useSelectedDevice,
  useUIState,
} from "@/lib/ws";
import { summarizeDevices, deviceForMapping } from "@/lib/devices";
import { summarizeServices } from "@/lib/services";
import { useFiringTicker } from "@/components/ConnectionsView/useFiringTicker";
import { MobileTopBar } from "./MobileTopBar";
import { MobileDevicePicker } from "./MobileDevicePicker";
import { MobileConnectionCard } from "./MobileConnectionCard";
import { MobileServiceCard } from "./MobileServiceCard";
import { MobileDeviceRow } from "./MobileDeviceRow";
import { MobileBottomTabs, type MobileTab } from "./MobileBottomTabs";

/** Mobile-portrait root. Replaces the 3-pane desktop view with:
 *   TopBar → DevicePicker (horizontal scroll) → tab content → BottomTabs.
 *
 * Shares state with the desktop via `useSelectedDevice()` so switching
 * viewports preserves selection. Subscribes to the same WS frame ticker
 * that drives the desktop firing rings. */
export function MobileHome() {
  useFiringTicker();
  const {
    mappings,
    deviceStates,
    serviceStates,
  } = useUIState();
  const [selectedDevice, setSelectedDevice] = useSelectedDevice();
  const firingMappingIds = useFiringMappingIds();
  const lastInputByDevice = useLastInputByDevice();
  const [tab, setTab] = useState<MobileTab>("connections");

  const devices = useMemo(
    () => summarizeDevices(deviceStates, mappings),
    [deviceStates, mappings]
  );
  const services = useMemo(
    () => summarizeServices(serviceStates, mappings),
    [serviceStates, mappings]
  );

  const firingDeviceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of mappings) {
      if (!firingMappingIds.has(m.mapping_id)) continue;
      const dev = deviceForMapping(devices, m);
      if (dev) ids.add(dev.device_id);
    }
    return ids;
  }, [mappings, firingMappingIds, devices]);

  const selectedDeviceName = useMemo(
    () =>
      selectedDevice
        ? devices.find((d) => d.device_id === selectedDevice)?.nickname ?? null
        : null,
    [devices, selectedDevice]
  );

  const filteredConnections = useMemo(() => {
    const filtered = selectedDevice
      ? mappings.filter((m) => m.device_id === selectedDevice)
      : mappings;
    return filtered
      .slice()
      .sort((a, b) => a.mapping_id.localeCompare(b.mapping_id));
  }, [mappings, selectedDevice]);

  return (
    <div className="flex h-screen w-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <MobileTopBar firingCount={firingMappingIds.size} />

      {tab !== "devices" && devices.length > 0 && (
        <MobileDevicePicker
          devices={devices}
          firingDeviceIds={firingDeviceIds}
          selectedId={selectedDevice}
          onSelect={setSelectedDevice}
        />
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === "connections" && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Links
              </h2>
              <Badge color="zinc">{filteredConnections.length}</Badge>
              {selectedDeviceName && (
                <Badge color="blue">
                  {selectedDeviceName}
                  <button
                    type="button"
                    onClick={() => setSelectedDevice(null)}
                    aria-label="Clear device filter"
                    className="ml-0.5 opacity-60 hover:opacity-100"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </Badge>
              )}
            </div>
            {filteredConnections.map((m) => {
              const device = deviceForMapping(devices, m);
              const firing = firingMappingIds.has(m.mapping_id);
              const input = lastInputByDevice[m.device_id];
              const lastEvent = firing && input ? `${input.input} · now` : null;
              return (
                <MobileConnectionCard
                  key={m.mapping_id}
                  mapping={m}
                  device={device}
                  services={services}
                  firing={firing}
                  lastEvent={lastEvent}
                />
              );
            })}
            <Link
              href={
                selectedDevice
                  ? `/mappings/new?device_id=${encodeURIComponent(selectedDevice)}`
                  : "/mappings/new"
              }
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 py-3.5 text-sm font-medium text-zinc-500 dark:border-white/15 dark:text-zinc-400"
            >
              <Plus className="h-4 w-4" />
              New link
              {selectedDeviceName ? ` from ${selectedDeviceName}` : ""}
            </Link>
            {selectedDevice && filteredConnections.length === 0 && (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                No links for {selectedDeviceName} yet.
              </p>
            )}
          </div>
        )}

        {tab === "services" && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Services
              </h2>
              <Badge color="zinc">{services.length}</Badge>
            </div>
            {services.length === 0 ? (
              <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
                No services reporting yet.
              </p>
            ) : (
              services.map((s) => <MobileServiceCard key={s.type} service={s} />)
            )}
          </div>
        )}

        {tab === "devices" && (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Devices
              </h2>
              <Badge color="zinc">{devices.length}</Badge>
            </div>
            {devices.length === 0 ? (
              <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
                No devices have reported in yet.
              </p>
            ) : (
              devices.map((d) => (
                <MobileDeviceRow
                  key={`${d.edge_id}/${d.device_type}/${d.device_id}`}
                  device={d}
                  firing={firingDeviceIds.has(d.device_id)}
                />
              ))
            )}
          </div>
        )}
      </div>

      <MobileBottomTabs value={tab} onChange={setTab} />
    </div>
  );
}
