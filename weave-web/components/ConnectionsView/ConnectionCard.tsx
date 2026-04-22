"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import type { Mapping } from "@/lib/api";
import type { DeviceSummary } from "@/lib/devices";
import type { ServiceTarget } from "@/lib/services";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Pencil,
  Play,
  Lightbulb,
  Volume2,
  ChevronDown,
} from "@/components/icon";
import { RoutesEditor } from "@/components/RoutesEditor";
import { SwitchTargetPopover } from "@/components/SwitchTargetPopover";
import { NuimoViz } from "./NuimoViz";
import { RoutePill } from "./RoutePill";

interface Props {
  mapping: Mapping;
  device: DeviceSummary | null;
  target: ServiceTarget | null;
  firing: boolean;
  lastEvent: string | null;
}

function ServiceIcon({ type, className }: { type: string; className?: string }) {
  if (type === "roon") return <Play className={className} />;
  if (type === "hue") return <Lightbulb className={className} />;
  return <Volume2 className={className} />;
}

function StatusChip({ target }: { target: ServiceTarget | null }) {
  if (!target) return null;
  if (target.status === "playing")
    return (
      <Badge color="green">
        <Play className="h-2.5 w-2.5" />
        playing
        {target.level != null ? ` · ${Math.round(target.level)}%` : ""}
      </Badge>
    );
  if (target.status === "idle") return <Badge color="zinc">idle</Badge>;
  if (target.status === "on")
    return (
      <Badge color="amber">
        on
        {target.level != null ? ` · ${Math.round(target.level)}%` : ""}
      </Badge>
    );
  if (target.status === "off") return <Badge color="zinc">off</Badge>;
  return null;
}

export function ConnectionCard({
  mapping,
  device,
  target,
  firing,
  lastEvent,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const variant = firing
    ? "firing"
    : mapping.active
      ? "default"
      : "inactive";

  const deviceName =
    device?.nickname ?? mapping.device_id.slice(-8) ?? mapping.device_id;
  const targetName = target?.label ?? mapping.service_target;

  const feedbackStates = useMemo(
    () => (mapping.feedback ?? []).map((f) => f.state).join(", "),
    [mapping.feedback]
  );

  return (
    <Card variant={variant} className="group">
      {firing && (
        <div className="absolute -top-2.5 right-3">
          <Badge color="orange">
            <span
              className="h-2 w-2 animate-pulse rounded-full bg-orange-500"
              aria-hidden
            />
            firing · just now
          </Badge>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* device side */}
        <div className="flex min-w-0 items-center gap-2">
          <NuimoViz pattern={device?.led ?? "blank"} size={40} firing={firing} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
              {deviceName}
            </div>
            <div className="font-mono text-[10px] text-zinc-400">
              {mapping.device_type}
            </div>
          </div>
        </div>

        {/* connector */}
        <div className="mt-4 flex flex-1 items-center gap-2">
          <div
            className={clsx(
              "h-0.5 flex-1",
              firing
                ? "bg-orange-400"
                : mapping.active
                  ? "bg-zinc-300 dark:bg-zinc-700"
                  : "border-t border-dashed border-zinc-300 bg-transparent dark:border-zinc-700"
            )}
          />
          <span
            className={clsx(
              "text-xs",
              firing ? "text-orange-500" : "text-zinc-400"
            )}
            aria-hidden
          >
            →
          </span>
          <div
            className={clsx(
              "h-0.5 flex-1",
              firing
                ? "bg-orange-400"
                : mapping.active
                  ? "bg-zinc-300 dark:bg-zinc-700"
                  : "border-t border-dashed border-zinc-300 bg-transparent dark:border-zinc-700"
            )}
          />
        </div>

        {/* service side */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-white/5 dark:text-zinc-300">
            <ServiceIcon type={mapping.service_type} className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
              {targetName}
            </div>
            <div className="font-mono text-[10px] text-zinc-400">
              {mapping.service_type}
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <StatusChip target={target} />
          <SwitchTargetPopover mapping={mapping} />
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Collapse editor" : "Edit connection"}
            aria-expanded={expanded}
            className={clsx(
              "flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-white/5",
              expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <Pencil className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex w-full flex-wrap items-center gap-1.5 text-left"
        aria-label={expanded ? "Collapse routes editor" : "Expand routes editor"}
      >
        {mapping.routes.map((r, i) => (
          <RoutePill key={i} route={r} />
        ))}
        {mapping.routes.length === 0 && (
          <span className="text-xs italic text-zinc-400">no routes yet</span>
        )}
      </button>

      {(feedbackStates || mapping.target_switch_on || !mapping.active || lastEvent) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-white/5">
          {feedbackStates && (
            <span>
              Feedback: <span className="font-mono">{feedbackStates}</span>
            </span>
          )}
          {mapping.target_switch_on && (
            <span>
              Switch on{" "}
              <span className="font-mono">{mapping.target_switch_on}</span>{" "}
              ({mapping.target_candidates.length} options)
            </span>
          )}
          {!mapping.active && <Badge color="zinc">inactive</Badge>}
          {lastEvent && (
            <span className="ml-auto font-mono text-[11px]">{lastEvent}</span>
          )}
        </div>
      )}

      {expanded && (
        <div className="mt-4">
          <Separator />
          <div className="mt-4">
            <RoutesEditor
              mode={{ kind: "edit", mappingId: mapping.mapping_id }}
              onSaved={() => setExpanded(false)}
              onCancel={() => setExpanded(false)}
              variant="inline"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
