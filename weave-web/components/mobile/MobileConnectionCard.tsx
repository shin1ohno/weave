"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Lightbulb, Pencil, Play } from "@/components/icon";
import { NuimoViz } from "@/components/ConnectionsView/NuimoViz";
import { RoutePill } from "@/components/ConnectionsView/RoutePill";
import type { Mapping } from "@/lib/api";
import type { DeviceSummary } from "@/lib/devices";
import type { ServiceSummary } from "@/lib/services";
import { targetLabel } from "@/lib/services";

interface Props {
  mapping: Mapping;
  device: DeviceSummary | null;
  services: ServiceSummary[];
  firing: boolean;
  lastEvent: string | null;
}

function ServiceIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  if (type === "roon") return <Play className={className} />;
  if (type === "hue") return <Lightbulb className={className} />;
  return <Play className={className} />;
}

/** Single-column, large-hit-target mapping card for mobile. Tap navigates
 * to the full-page editor — inline expansion would cramp the Routes list
 * on portrait widths. The chevron + pencil glyphs make the affordance
 * explicit. */
export function MobileConnectionCard({
  mapping: m,
  device,
  services,
  firing,
  lastEvent,
}: Props) {
  const router = useRouter();
  const target = targetLabel(services, m.service_type, m.service_target);
  const deviceName = device?.nickname ?? m.device_id.slice(-8);
  return (
    <button
      type="button"
      onClick={() => router.push(`/mappings/${m.mapping_id}/edit`)}
      className={clsx(
        "relative w-full cursor-pointer rounded-xl border p-3 text-left transition active:scale-[0.99]",
        firing
          ? "border-orange-500/60 bg-white ring-2 ring-orange-500/30 dark:bg-zinc-900"
          : m.active
            ? "border-zinc-950/5 bg-white dark:border-white/10 dark:bg-zinc-900"
            : "border-dashed border-zinc-950/10 bg-zinc-50/40 dark:border-white/10 dark:bg-zinc-950/60"
      )}
    >
      {firing && (
        <div className="absolute -top-2 right-2.5">
          <Badge color="orange">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500"
              aria-hidden
            />
            firing
          </Badge>
        </div>
      )}
      <div className="flex items-center gap-2">
        <NuimoViz pattern={device?.led ?? "blank"} size={32} firing={firing} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-zinc-950 dark:text-white">
            {deviceName}
          </div>
          <div className="truncate font-mono text-[10px] text-zinc-500">
            {m.routes.length} route{m.routes.length === 1 ? "" : "s"}
          </div>
        </div>
        <ChevronRight className="h-3 w-3 text-zinc-400" />
        <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-zinc-100 px-2 py-1 dark:bg-white/5">
          <ServiceIcon
            type={m.service_type}
            className="h-3 w-3 shrink-0 text-zinc-600 dark:text-zinc-300"
          />
          <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
            {target}
          </span>
        </div>
      </div>

      {m.routes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {m.routes.slice(0, 3).map((r, i) => (
            <RoutePill key={i} route={r} mini />
          ))}
          {m.routes.length > 3 && (
            <span className="self-center text-[10px] text-zinc-400">
              +{m.routes.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2 text-[10px] dark:border-white/5">
        <span
          className={clsx(
            "font-mono",
            firing
              ? "text-orange-600 dark:text-orange-400"
              : "text-zinc-400"
          )}
        >
          {lastEvent ?? (m.active ? "idle" : "inactive")}
        </span>
        <Pencil className="h-2.5 w-2.5 text-zinc-400" />
      </div>
    </button>
  );
}
