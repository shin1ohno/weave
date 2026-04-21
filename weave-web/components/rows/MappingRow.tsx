"use client";

import Link from "next/link";
import { deleteMapping, type Mapping } from "@/lib/api";
import { useUIDispatch } from "@/lib/ws";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  mapping: Mapping;
  /** Optional display name of the resolved service target (zone/light name). */
  targetLabel?: string;
}

export function MappingRow({ mapping, targetLabel }: Props) {
  const dispatch = useUIDispatch();

  const handleDelete = async () => {
    if (!confirm("Delete this mapping?")) return;
    dispatch({ kind: "local_delete_mapping", id: mapping.mapping_id });
    try {
      await deleteMapping(mapping.mapping_id);
    } catch (e) {
      alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  const routesSummary = mapping.routes
    .map((r) => `${r.input}→${r.intent}`)
    .join(", ");

  return (
    <div className="rounded-md border border-zinc-950/5 bg-white px-4 py-2 text-sm shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={mapping.active ? "green" : "zinc"}>
          {mapping.active ? "active" : "inactive"}
        </Badge>
        {mapping.edge_id && <Badge color="zinc">{mapping.edge_id}</Badge>}
        <span className="font-medium text-zinc-950 dark:text-white">
          {mapping.device_type}/{shorten(mapping.device_id)}
        </span>
        <span className="text-zinc-400">→</span>
        <span className="font-medium text-zinc-950 dark:text-white">
          {mapping.service_type}/{targetLabel || shorten(mapping.service_target)}
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <Link
            href={`/mappings/${mapping.mapping_id}/edit`}
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            edit
          </Link>
          <Button plain onClick={handleDelete} className="!text-red-600 !px-0">
            delete
          </Button>
        </div>
      </div>
      {mapping.routes.length > 0 && (
        <div className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
          {mapping.routes.length} route{mapping.routes.length === 1 ? "" : "s"}:{" "}
          {routesSummary}
        </div>
      )}
    </div>
  );
}

function shorten(s: string): string {
  return s.length > 20 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s;
}
