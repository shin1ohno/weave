"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useUIState, useSelectedDevice } from "@/lib/ws";
import { summarizeServices } from "@/lib/services";
import { ServiceCard } from "./ServiceCard";

export function ServicesPane() {
  const { serviceStates, mappings } = useUIState();
  const [selectedDeviceId] = useSelectedDevice();
  const router = useRouter();

  const services = useMemo(
    () => summarizeServices(serviceStates, mappings),
    [serviceStates, mappings]
  );

  // Highlight the target that the currently-selected device is connected to
  // (first match; a device rarely has multiple mappings to one service).
  const activeTargetId = useMemo(() => {
    if (!selectedDeviceId) return null;
    const m = mappings.find((x) => x.device_id === selectedDeviceId);
    return m?.service_target ?? null;
  }, [mappings, selectedDeviceId]);

  const handlePick = (serviceType: string, target: string) => {
    const qs = new URLSearchParams({
      service_type: serviceType,
      service_target: target,
    });
    if (selectedDeviceId) {
      const source = mappings.find(
        (m) =>
          m.device_id === selectedDeviceId ||
          m.service_target === target // fallback if no selection
      );
      if (source) {
        qs.set("device_id", source.device_id);
        qs.set("device_type", source.device_type);
        qs.set("edge_id", source.edge_id);
      }
    }
    router.push(`/mappings/new?${qs.toString()}`);
  };

  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Services
          </h2>
          <Badge color="zinc">{services.length}</Badge>
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        {services.length === 0 ? (
          <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
            No services reporting. Once an edge-agent pushes zone / light
            state, services will appear here.
          </p>
        ) : (
          services.map((s) => (
            <ServiceCard
              key={s.type}
              service={s}
              activeTargetId={activeTargetId}
              onPickTarget={handlePick}
            />
          ))
        )}
      </div>
    </aside>
  );
}
