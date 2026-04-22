"use client";

import clsx from "clsx";
import type { ConnectionsFilter } from "@/lib/ws";

const OPTIONS: ConnectionsFilter[] = ["all", "active", "firing"];

export function FilterChips({
  value,
  onChange,
}: {
  value: ConnectionsFilter;
  onChange: (v: ConnectionsFilter) => void;
}) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-1 rounded-lg border border-zinc-950/10 bg-white p-0.5 text-xs dark:border-white/10 dark:bg-zinc-900"
    >
      {OPTIONS.map((o) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={value === o}
          onClick={() => onChange(o)}
          className={clsx(
            "rounded px-2 py-0.5 font-medium capitalize transition",
            value === o
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
