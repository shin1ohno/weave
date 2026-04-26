"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { LiveDot } from "@/components/ui/live-dot";
import { useUIState, useSelectedDevice } from "@/lib/ws";
import { summarizeServices } from "@/lib/services";
import type { EdgeInfo } from "@/lib/api";
import { ServiceCard } from "./ServiceCard";

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const delta = Math.max(0, Date.now() - t);
  if (delta < 10_000) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h`;
  return `${Math.floor(delta / 86_400_000)}d`;
}

function EdgesMiniRow({ edge }: { edge: EdgeInfo }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
      <LiveDot
        color={edge.online ? "green" : "zinc"}
        firing={edge.online}
        aria-label={edge.online ? "online" : "offline"}
      />
      <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
        {edge.edge_id}
      </span>
      <span className="ml-auto flex items-center gap-2 font-mono text-zinc-500 dark:text-zinc-400">
        <span title="Wifi signal">
          {edge.wifi != null ? `${edge.wifi}%` : "—"}
        </span>
        <span title="Round-trip latency">
          {edge.latency_ms != null ? `${edge.latency_ms}ms` : "—"}
        </span>
        <span title={new Date(edge.last_seen).toLocaleString()}>
          {relativeTime(edge.last_seen)}
        </span>
      </span>
    </div>
  );
}

export function ServicesPane() {
  const { serviceStates, mappings, edges } = useUIState();
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
      {edges.length > 0 && (
        <div className="rounded-xl border border-zinc-950/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
          <div className="flex items-center gap-2 border-b border-zinc-950/5 px-3 py-1.5 dark:border-white/10">
            <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Edges
            </h3>
            <Badge color="zinc">{edges.length}</Badge>
          </div>
          <div className="divide-y divide-zinc-950/5 dark:divide-white/10">
            {edges
              .slice()
              .sort((a, b) => a.edge_id.localeCompare(b.edge_id))
              .map((e) => (
                <EdgesMiniRow key={e.edge_id} edge={e} />
              ))}
          </div>
        </div>
      )}
    </aside>
  );
}
