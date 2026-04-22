"use client";

import clsx from "clsx";
import { useState, type ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Lightweight CSS-only tooltip. Uses focus-within + hover on a wrapper span
 * to show a positioned child. No portal, no flip logic — tooltips should be
 * short and positioned above. For anything more complex, reach for Popover. */
export function Tooltip({ content, className, children }: TooltipProps) {
  const [hover, setHover] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      {children}
      <span
        role="tooltip"
        className={clsx(
          "pointer-events-none absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg transition-opacity duration-150 dark:bg-zinc-100 dark:text-zinc-900",
          hover ? "opacity-100" : "opacity-0",
          className
        )}
      >
        {content}
      </span>
    </span>
  );
}
