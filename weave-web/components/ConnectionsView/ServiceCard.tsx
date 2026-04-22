"use client";

import clsx from "clsx";
import { Badge } from "@/components/ui/badge";
import { Play, Lightbulb, Volume2 } from "@/components/icon";
import type { ServiceSummary, ServiceTarget } from "@/lib/services";

function ServiceIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  if (type === "roon") return <Play className={className} />;
  if (type === "hue") return <Lightbulb className={className} />;
  return <Volume2 className={className} />;
}

function StatusChip({ target }: { target: ServiceTarget }) {
  if (target.status === "playing")
    return (
      <Badge color="green">
        <Play className="h-2.5 w-2.5" />
        playing
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

function TargetRow({
  target,
  active,
  onClick,
}: {
  target: ServiceTarget;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
        active
          ? "bg-blue-50 dark:bg-blue-500/10"
          : "hover:bg-zinc-50 dark:hover:bg-white/5"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
          {target.label}
        </div>
        {target.track && (
          <div className="truncate font-mono text-[11px] text-zinc-500">
            {target.track}
          </div>
        )}
      </div>
      <StatusChip target={target} />
      {target.linkedCount > 0 && (
        <Badge color="zinc">{target.linkedCount}↔</Badge>
      )}
    </button>
  );
}

interface Props {
  service: ServiceSummary;
  activeTargetId: string | null;
  onPickTarget: (serviceType: string, target: string) => void;
}

export function ServiceCard({ service, activeTargetId, onPickTarget }: Props) {
  return (
    <div className="rounded-xl border border-zinc-950/5 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center gap-2 px-1 pb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
          <ServiceIcon type={service.type} className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 text-base font-semibold text-zinc-950 dark:text-white">
          {service.label}
        </div>
        <Badge color={service.running ? "green" : "zinc"}>
          {service.running ? "running" : "offline"}
        </Badge>
      </div>
      <div className="flex flex-col gap-0.5">
        {service.targets.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-zinc-500 dark:text-zinc-400">
            No targets reported.
          </p>
        ) : (
          service.targets.map((t) => (
            <TargetRow
              key={t.target}
              target={t}
              active={t.target === activeTargetId}
              onClick={() => onPickTarget(service.type, t.target)}
            />
          ))
        )}
      </div>
    </div>
  );
}
