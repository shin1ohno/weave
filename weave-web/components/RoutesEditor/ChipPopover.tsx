"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { X } from "@/components/icon";

// Anchored popover for chip-driven pickers. Ports the absolute-positioned
// pattern from `/tmp/anthropic-design-fetch/weave/project/hifi-routes-d2.jsx`
// (lines 72-81): the parent owns open/close state and conditionally
// renders <ChipPopover>. Keeps the same visuals (rounded-xl, shadow-xl,
// optional uppercase title row + close button) and ports the bespoke
// `Glyph name="close"` to lucide's `X`.
//
// Anchoring: the parent wraps the trigger chip + this popover in a
// `relative` container; we render `absolute top-full mt-1.5` and align
// to `left-0` / `right-0` based on `anchor`. No portal — keeping it
// inside the chip's flow avoids the focus-management cost of a real
// floating UI library for this short-lived UI.

export interface ChipPopoverProps {
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  anchor?: "left" | "right";
  /** Width in px. Default 280 to mirror the design. */
  width?: number;
  className?: string;
}

export function ChipPopover({
  title,
  children,
  onClose,
  anchor = "left",
  width = 280,
  className,
}: ChipPopoverProps) {
  return (
    <div
      className={clsx(
        "absolute top-full z-30 mt-1.5 rounded-xl border border-zinc-950/10 bg-white p-2 shadow-xl shadow-zinc-900/10 dark:border-white/15 dark:bg-zinc-900 dark:shadow-black/40",
        anchor === "right" ? "right-0" : "left-0",
        className
      )}
      style={{ width }}
    >
      {title && (
        <div className="mb-1 flex items-center justify-between px-2 pt-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {title}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5"
              aria-label="Close"
            >
              <X aria-hidden className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
