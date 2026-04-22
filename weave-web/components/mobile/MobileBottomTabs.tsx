"use client";

import clsx from "clsx";
import { Command, Link2, Play, type LucideIcon } from "@/components/icon";

export type MobileTab = "connections" | "services" | "devices";

const TABS: Array<{ id: MobileTab; label: string; Icon: LucideIcon }> = [
  { id: "connections", label: "Links", Icon: Link2 },
  { id: "services", label: "Services", Icon: Play },
  { id: "devices", label: "Devices", Icon: Command },
];

interface Props {
  value: MobileTab;
  onChange: (tab: MobileTab) => void;
}

/** iOS-style bottom tab bar. Pads `env(safe-area-inset-bottom)` so the
 * Home Indicator never overlaps. Three tabs matches the three panes from
 * the desktop view — Links (Connections) takes the left slot because it's
 * the primary surface. */
export function MobileBottomTabs({ value, onChange }: Props) {
  return (
    <nav
      role="tablist"
      className="grid grid-cols-3 border-t border-zinc-950/5 bg-white dark:border-white/10 dark:bg-zinc-950"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          onClick={() => onChange(id)}
          aria-selected={value === id}
          className={clsx(
            "flex flex-col items-center gap-0.5 py-2 transition",
            value === id
              ? "text-blue-600 dark:text-blue-400"
              : "text-zinc-500 dark:text-zinc-400"
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="text-[10px] font-medium">{label}</span>
        </button>
      ))}
    </nav>
  );
}
