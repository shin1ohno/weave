"use client";

import * as Headless from "@headlessui/react";
import clsx from "clsx";
import { forwardRef, type ReactNode } from "react";

interface PopoverProps {
  className?: string;
  children: ReactNode;
}

export function Popover({ className, children }: PopoverProps) {
  return (
    <Headless.Popover className={clsx("relative", className)}>
      {children}
    </Headless.Popover>
  );
}

export const PopoverButton = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Headless.PopoverButton>
>(function PopoverButton(props, ref) {
  return <Headless.PopoverButton ref={ref} {...props} />;
});

type Anchor = "bottom start" | "bottom end" | "top start" | "top end";

interface PopoverPanelProps {
  className?: string;
  anchor?: Anchor;
  children: ReactNode;
}

/** Thin wrapper over Headless.PopoverPanel adding Catalyst-flavoured surface
 * styling (rounded-lg, shadow-lg, zinc border, dark-mode pair). Callers can
 * still override via `className`. */
export function PopoverPanel({
  className,
  anchor = "bottom end",
  children,
}: PopoverPanelProps) {
  return (
    <Headless.PopoverPanel
      anchor={{ to: anchor, gap: 4 }}
      className={clsx(
        "z-20 rounded-lg border border-zinc-950/10 bg-white p-2 shadow-lg ring-1 ring-zinc-950/5 dark:border-white/10 dark:bg-zinc-900 dark:ring-white/5",
        className
      )}
    >
      {children}
    </Headless.PopoverPanel>
  );
}
