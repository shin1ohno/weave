"use client";

import clsx from "clsx";
import { useMemo } from "react";
import { useUIState, useFiringMappingIds } from "@/lib/ws";
import { summarizeDevices, deviceForMapping } from "@/lib/devices";
import type { Mapping } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { X } from "@/components/icon";
import { NuimoMirror } from "./NuimoMirror";
import { GestureChecklist } from "./GestureChecklist";
import { InputStreamPanel, mappingFilter } from "./InputStreamPanel";

interface Props {
  mapping: Mapping | null;
  open: boolean;
  onClose: () => void;
}

/** Slide-in validation panel. Always mounted — transforms off-screen when
 * closed so the open animation is free. Clicking the backdrop or the X
 * closes. Subscribed to WS frames filtered for the target mapping so its
 * checklist and stream only show what matters. */
export function TryItPanel({ mapping, open, onClose }: Props) {
  const { deviceStates, mappings } = useUIState();
  const firing = useFiringMappingIds();

  const device = useMemo(() => {
    if (!mapping) return null;
    const devices = summarizeDevices(deviceStates, mappings);
    return deviceForMapping(devices, mapping);
  }, [deviceStates, mappings, mapping]);

  const filter = useMemo(() => {
    if (!mapping) return undefined;
    return mappingFilter(
      mapping.edge_id,
      mapping.device_type,
      mapping.device_id
    );
  }, [mapping]);

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close Try it"
          onClick={onClose}
          className="fixed inset-0 z-30 cursor-default bg-zinc-950/30 dark:bg-zinc-950/60"
        />
      )}
      <aside
        aria-hidden={!open}
        className={clsx(
          "fixed right-0 top-0 z-40 flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl ring-1 ring-zinc-950/10 transition-transform duration-200 ease-out dark:bg-zinc-900 dark:ring-white/10",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="flex items-center gap-3 border-b border-zinc-950/5 px-6 py-4 dark:border-white/10">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
              Try it
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Press each gesture on the device to verify the mapping before
              saving.
            </p>
          </div>
          <Button plain onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" />
            Close
          </Button>
        </header>
        <div className="flex min-h-0 flex-1">
          {mapping ? (
            <>
              <NuimoMirror
                device={device}
                firing={firing.has(mapping.mapping_id)}
              />
              <div className="flex min-h-0 flex-1 flex-col">
                <GestureChecklist mapping={mapping} />
                <div className="border-t border-zinc-950/5 dark:border-white/10">
                  <InputStreamPanel filter={filter} variant="inline" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
              No connection selected.
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
