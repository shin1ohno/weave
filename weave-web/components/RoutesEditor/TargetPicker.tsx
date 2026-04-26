"use client";

import clsx from "clsx";
import { useMemo } from "react";
import { ChipPopover } from "@/components/RoutesEditor/ChipPopover";
import { Check } from "@/components/icon";
import { summarizeServices, type ServiceTarget } from "@/lib/services";
import { useUIState } from "@/lib/ws";

// Multi-select picker for "cycle through these targets" — ports the
// `TargetPicker` component from
// `/tmp/anthropic-design-fetch/weave/project/hifi-routes-d2.jsx` (lines
// 310-340) of the D2 conversation-builder redesign.
//
// The mapping's primary `service_target` (passed as `currentTarget`) is
// always part of the cycle and rendered locked-on with a "current" badge.
// Other targets are toggleable; the parent owns the `selected` array.
//
// Live targets are read via `summarizeServices(serviceStates, mappings)`
// rather than re-implementing the per-service meta-property filter
// (zone / light / now_playing / output_device) — `lib/services.ts` is the
// canonical owner of that mapping (see `META_PROPERTY_BY_SERVICE`). This
// keeps TargetPicker decoupled from new service types as they're added
// server-side.

export interface TargetPickerProps {
  serviceType: string;
  /** Mapping's primary service_target — always part of the cycle, can't
   * be unselected. */
  currentTarget: string;
  /** Currently-selected cycle targets (their `target` strings). */
  selected: string[];
  onToggle: (target: string) => void;
  onClose: () => void;
}

export function TargetPicker({
  serviceType,
  currentTarget,
  selected,
  onToggle,
  onClose,
}: TargetPickerProps) {
  const { serviceStates, mappings } = useUIState();

  const targets: ServiceTarget[] = useMemo(() => {
    const services = summarizeServices(serviceStates, mappings);
    const svc = services.find((s) => s.type === serviceType);
    return svc?.targets ?? [];
  }, [serviceStates, mappings, serviceType]);

  return (
    <ChipPopover
      title="Cycle through these targets"
      onClose={onClose}
      width={280}
      anchor="left"
    >
      <div className="px-1 pb-1">
        {targets.map((t) => {
          const isCurrent = t.target === currentTarget;
          const isSelected = selected.includes(t.target);
          return (
            <button
              key={t.target}
              type="button"
              onClick={() => onToggle(t.target)}
              disabled={isCurrent}
              className={clsx(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition",
                isCurrent
                  ? "cursor-not-allowed bg-purple-50 text-purple-900 dark:bg-purple-500/10 dark:text-purple-200"
                  : isSelected
                    ? "bg-purple-100 text-purple-900 dark:bg-purple-500/20 dark:text-purple-100"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5"
              )}
            >
              <div
                className={clsx(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  isCurrent || isSelected
                    ? "border-purple-500 bg-purple-500 text-white"
                    : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                )}
              >
                {(isCurrent || isSelected) && (
                  <Check aria-hidden className="h-2.5 w-2.5" />
                )}
              </div>
              <span className="font-medium">{t.label}</span>
              {isCurrent && (
                <span className="ml-auto text-[10px] text-purple-600 dark:text-purple-300">
                  current
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="border-t border-zinc-100 px-2 py-1.5 text-[10px] text-zinc-500 dark:border-white/5">
        Order = cycle order. Drag chips below to reorder.
      </div>
    </ChipPopover>
  );
}
