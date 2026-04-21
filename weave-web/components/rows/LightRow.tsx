"use client";

import Link from "next/link";
import { Mapping, ServiceStateEntry } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { SwitchTargetPopover } from "@/components/SwitchTargetPopover";
import { useKnownTargets } from "@/hooks/useKnownTargets";
import { useRowSelectionRegistration } from "@/hooks/useRowSelection";

interface Props {
  target: string;
  entry: ServiceStateEntry;
  controllers: Mapping[];
}

type LightValue = {
  display_name?: string;
  on?: boolean;
  brightness?: number | null;
};

export function LightRow({ target, entry, controllers }: Props) {
  const value = entry.value as LightValue | undefined;
  const name = value?.display_name || target;
  const on = value?.on ?? false;
  const brightness =
    typeof value?.brightness === "number" ? value.brightness : null;

  const primary = controllers.find((m) => m.active) ?? controllers[0];

  const { isSelected } = useRowSelectionRegistration({
    id: `light:hue:${target}`,
    primaryMappingId: primary?.mapping_id,
  });

  const knownTargets = useKnownTargets(primary?.service_type ?? "");
  const canSwitch =
    !!primary &&
    ((primary.target_candidates?.length ?? 0) > 0 ||
      knownTargets.length > 1 ||
      (knownTargets.length === 1 &&
        knownTargets[0].target !== primary.service_target));

  return (
    <div
      data-selected={isSelected ? "true" : undefined}
      className={`rounded-md border bg-white px-4 py-2 text-sm shadow-sm dark:bg-zinc-900 ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500"
          : "border-zinc-950/5 dark:border-white/10"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Badge color={on ? "amber" : "zinc"}>{on ? "on" : "off"}</Badge>
        <span className="min-w-0 truncate font-medium text-zinc-950 dark:text-white">
          {name}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {brightness !== null && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{Math.round(brightness)}%</span>
              <div className="h-1.5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className={`h-1.5 rounded-full ${
                    on ? "bg-amber-400" : "bg-zinc-400"
                  }`}
                  style={{
                    width: `${Math.max(0, Math.min(100, brightness))}%`,
                  }}
                />
              </div>
            </div>
          )}
          {primary && canSwitch && <SwitchTargetPopover mapping={primary} />}
          {primary && (
            <Link
              href={`/mappings/${primary.mapping_id}/edit`}
              className="rounded border border-zinc-200 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-label="Edit mapping"
            >
              edit
            </Link>
          )}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-mono truncate">{target}</span>
        {controllers.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {controllers.map((m) => (
              <span
                key={m.mapping_id}
                className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                ← {m.device_type}
                {m.edge_id ? ` [${m.edge_id}]` : ""}
              </span>
            ))}
          </span>
        ) : (
          <span className="italic">no controller</span>
        )}
      </div>
    </div>
  );
}
