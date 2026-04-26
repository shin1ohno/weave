"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { ChevronDown } from "@/components/icon";

// Palette + chevron primitive shared by every interactive token in the D2
// "conversation builder" UI. Ports the design from
// `/tmp/anthropic-design-fetch/weave/project/hifi-routes-d2.jsx` (lines
// 51-69), swapping the bespoke `Glyph` for our lucide `ChevronDown` and
// adding TypeScript types.
//
// `kind === 'word'` renders a plain inline span (used for connective text
// like "When I…", "on…"). All other kinds render a button with optional
// trailing chevron — toggle off via `editable={false}` for read-only chips
// (e.g. summary cards in the rule list).
//
// Visual states layered on top of the palette:
//   - `firing` — bright orange ring + filled background while a route is
//     actively firing on the edge.
//   - `error` — rose tinting for validation issues (duplicate gestures,
//     missing target etc.). Both use Tailwind's `!` important prefix to
//     beat the palette's defaults.

export type ChipKind =
  | "word"
  | "gesture"
  | "intent"
  | "target"
  | "value"
  | "placeholder";

export interface ChipProps {
  kind?: ChipKind;
  children: ReactNode;
  onClick?: () => void;
  firing?: boolean;
  error?: boolean;
  /** When false, hides the trailing chevron. Default true. */
  editable?: boolean;
  className?: string;
}

const PALETTE: Record<Exclude<ChipKind, "word">, string> = {
  gesture:
    "border border-blue-300 bg-blue-50 text-blue-900 hover:border-blue-500 hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-100 dark:hover:bg-blue-500/25",
  intent:
    "border border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25",
  target:
    "border border-purple-300 bg-purple-50 text-purple-900 hover:border-purple-500 hover:bg-purple-100 dark:border-purple-500/40 dark:bg-purple-500/15 dark:text-purple-100 dark:hover:bg-purple-500/25",
  value:
    "border border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100 dark:hover:bg-amber-500/25",
  placeholder:
    "border border-dashed border-zinc-300 bg-white text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900",
};

const FIRING =
  "ring-4 ring-orange-500/50 !border-orange-500 !bg-orange-100 !text-orange-900 dark:!bg-orange-500/30 dark:!text-orange-100";
const ERROR =
  "!border-rose-400 !bg-rose-50 !text-rose-700 dark:!bg-rose-500/15 dark:!text-rose-200";

export function Chip({
  kind = "word",
  children,
  onClick,
  firing = false,
  error = false,
  editable = true,
  className,
}: ChipProps) {
  if (kind === "word") {
    return (
      <span
        className={clsx(
          "text-[15px] leading-7 text-zinc-500 dark:text-zinc-400",
          className
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "group/chip inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[15px] font-medium leading-7 transition",
        PALETTE[kind],
        firing && FIRING,
        error && ERROR,
        className
      )}
    >
      {children}
      {editable && (
        <ChevronDown
          aria-hidden
          className="h-3 w-3 opacity-40 transition group-hover/chip:opacity-80"
        />
      )}
    </button>
  );
}
