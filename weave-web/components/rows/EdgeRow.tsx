"use client";

import { EdgeInfo } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { LiveDot } from "@/components/ui/live-dot";
import { useRowSelectionRegistration } from "@/hooks/useRowSelection";

interface Props {
  edge: EdgeInfo;
  deviceCount?: number;
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const delta = Math.max(0, Date.now() - t);
  if (delta < 10_000) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

export function EdgeRow({ edge, deviceCount }: Props) {
  // Edges have no primary mapping — Enter does nothing for them (by design).
  const { isSelected } = useRowSelectionRegistration({
    id: `edge:${edge.edge_id}`,
  });

  return (
    <div
      data-selected={isSelected ? "true" : undefined}
      className={`flex flex-wrap items-center gap-3 rounded-md border bg-white px-4 py-2 text-sm shadow-sm dark:bg-zinc-900 ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500"
          : "border-zinc-950/5 dark:border-white/10"
      }`}
    >
      <LiveDot
        color={edge.online ? "green" : "zinc"}
        firing={edge.online}
        aria-label={edge.online ? "online" : "offline"}
      />
      <span className="font-medium text-zinc-950 dark:text-white">
        {edge.edge_id}
      </span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        v{edge.version}
      </span>
      <div className="flex flex-wrap gap-1">
        {edge.capabilities.map((c) => (
          <Badge key={c} color="blue">
            {c}
          </Badge>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        {typeof deviceCount === "number" && (
          <span>
            {deviceCount} device{deviceCount === 1 ? "" : "s"}
          </span>
        )}
        <span title={new Date(edge.last_seen).toLocaleString()}>
          {edge.online ? relativeTime(edge.last_seen) : `offline · last ${relativeTime(edge.last_seen)}`}
        </span>
      </div>
    </div>
  );
}
