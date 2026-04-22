"use client";

import clsx from "clsx";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Play } from "@/components/icon";
import type { ServiceSummary, ServiceTarget } from "@/lib/services";

function TargetRow({ target }: { target: ServiceTarget }) {
  const chip =
    target.status === "playing" ? (
      <Badge color="green">
        <Play className="h-2.5 w-2.5" />
        playing
      </Badge>
    ) : target.status === "idle" ? (
      <Badge color="zinc">idle</Badge>
    ) : target.status === "on" ? (
      <Badge color="amber">
        on{target.level != null ? ` · ${Math.round(target.level)}%` : ""}
      </Badge>
    ) : target.status === "off" ? (
      <Badge color="zinc">off</Badge>
    ) : null;
  return (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
          {target.label}
        </div>
        {target.track && (
          <div className="truncate font-mono text-[10px] text-zinc-500">
            {target.track}
          </div>
        )}
      </div>
      {chip}
      {target.linkedCount > 0 && (
        <Badge color="zinc">{target.linkedCount}↔</Badge>
      )}
    </div>
  );
}

/** Single-column service card for the Services tab. Mirrors desktop's
 * ServiceCard shape but with tighter padding. Target rows are presentational
 * — target switching happens from the desktop's right-pane flow (creating a
 * new connection pre-fills the service+target via query string). */
export function MobileServiceCard({ service }: { service: ServiceSummary }) {
  return (
    <div className="rounded-xl border border-zinc-950/5 bg-white p-2.5 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center gap-2 px-1 pb-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
          {service.type === "roon" ? (
            <Play className="h-3 w-3" />
          ) : service.type === "hue" ? (
            <Lightbulb className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
        </div>
        <span className="flex-1 text-sm font-semibold text-zinc-950 dark:text-white">
          {service.label}
        </span>
        <Badge color={service.running ? "green" : "zinc"}>
          {service.running ? "running" : "offline"}
        </Badge>
      </div>
      <div className={clsx("flex flex-col gap-0.5")}>
        {service.targets.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-zinc-500 dark:text-zinc-400">
            No targets reported.
          </p>
        ) : (
          service.targets.map((t) => <TargetRow key={t.target} target={t} />)
        )}
      </div>
    </div>
  );
}
