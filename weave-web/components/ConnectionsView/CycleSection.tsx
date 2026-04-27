"use client";

import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";
import {
  deleteDeviceCycle,
  putDeviceCycle,
  switchActiveConnection,
  type Mapping,
} from "@/lib/api";
import { useDeviceCycle, useUIState } from "@/lib/ws";
import { GESTURE_LABEL } from "@/components/RoutesEditor/vocab";
import { INPUT_ICON, SERVICE_ICON } from "@/components/icon";

interface Props {
  deviceType: string;
  deviceId: string;
}

const DEFAULT_GESTURE = "swipe_up";

/**
 * Per-device cycle controls on the DeviceTile. Shows the ordered cycle
 * with the active mapping highlighted; clicking a non-active chip
 * switches active. When no cycle exists and the device has ≥2 mappings,
 * surfaces a "Cycle these connections" CTA that wraps them into a fresh
 * cycle bound to `swipe_up` (a sane default — gesture editing TBD).
 *
 * Cross-service is implicit: a cycle that contains both a Roon mapping
 * and a Hue mapping is exactly the cross-service feature, no special
 * `service_type` override required at the candidate level.
 */
export function CycleSection({ deviceType, deviceId }: Props) {
  const cycle = useDeviceCycle(deviceType, deviceId);
  const { mappings: allMappings, serviceStates } = useUIState();
  const mappings = useMemo(
    () =>
      allMappings.filter(
        (m) => m.device_type === deviceType && m.device_id === deviceId
      ),
    [allMappings, deviceType, deviceId]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelFor = useCallback(
    (mapping: Mapping): string => {
      const fromState = serviceStates.find(
        (s) =>
          s.service_type === mapping.service_type &&
          s.target === mapping.service_target &&
          (s.value as { display_name?: string } | undefined)?.display_name
      );
      const display = fromState
        ? ((fromState.value as { display_name?: string }).display_name as
            | string
            | undefined)
        : undefined;
      return display ?? mapping.service_target ?? mapping.service_type;
    },
    [serviceStates]
  );

  const onWrap = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      setBusy(true);
      setError(null);
      try {
        await putDeviceCycle(deviceType, deviceId, {
          mapping_ids: mappings.map((m) => m.mapping_id),
          active_mapping_id: mappings[0]?.mapping_id ?? null,
          cycle_gesture: DEFAULT_GESTURE,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [deviceType, deviceId, mappings]
  );

  const onSwitchActive = useCallback(
    async (
      e: React.MouseEvent<HTMLButtonElement>,
      activeMappingId: string
    ) => {
      e.stopPropagation();
      if (cycle?.active_mapping_id === activeMappingId) return;
      setBusy(true);
      setError(null);
      try {
        await switchActiveConnection(deviceType, deviceId, activeMappingId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [deviceType, deviceId, cycle?.active_mapping_id]
  );

  const onDeleteCycle = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      setBusy(true);
      setError(null);
      try {
        await deleteDeviceCycle(deviceType, deviceId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [deviceType, deviceId]
  );

  // No cycle + < 2 mappings: nothing to surface — devices with one
  // connection don't need a cycle, and the section would only add noise.
  if (!cycle && mappings.length < 2) return null;

  if (!cycle) {
    return (
      <div
        className="mt-3 border-t border-zinc-950/5 pt-3 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Cycle
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onWrap}
          className="rounded-md border border-dashed border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-blue-500/10"
        >
          + Cycle {mappings.length} connections (swipe_up)
        </button>
        {error && (
          <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}
      </div>
    );
  }

  const orderedMappings: (Mapping | null)[] = cycle.mapping_ids.map(
    (id) => mappings.find((m) => m.mapping_id === id) ?? null
  );

  const GestureIcon = cycle.cycle_gesture
    ? INPUT_ICON[cycle.cycle_gesture]
    : null;

  return (
    <div
      className="mt-3 border-t border-zinc-950/5 pt-3 dark:border-white/10"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Cycle
        </div>
        <div className="flex items-center gap-1.5">
          {cycle.cycle_gesture && (
            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {GestureIcon && <GestureIcon className="h-2.5 w-2.5" />}
              {GESTURE_LABEL[cycle.cycle_gesture] ?? cycle.cycle_gesture}
            </span>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onDeleteCycle}
            className="text-[10px] text-zinc-400 hover:text-rose-500 dark:text-zinc-500"
            title="Remove cycle (mappings revert to all-fire)"
          >
            unlink
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {orderedMappings.map((m, idx) => {
          if (!m) {
            // mapping_id refers to a mapping that no longer exists — soft
            // inconsistency. Render a placeholder so the cycle position
            // is still visible.
            return (
              <span
                key={`gap-${idx}`}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-rose-300 px-1.5 py-0.5 text-[11px] text-rose-500 dark:border-rose-700 dark:text-rose-400"
              >
                missing
              </span>
            );
          }
          const isActive = cycle.active_mapping_id === m.mapping_id;
          const Icon = SERVICE_ICON[m.service_type];
          return (
            <button
              key={m.mapping_id}
              type="button"
              disabled={busy || isActive}
              onClick={(e) => onSwitchActive(e, m.mapping_id)}
              title={
                isActive
                  ? "Active connection"
                  : "Click to make active"
              }
              className={clsx(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-blue-50 hover:text-blue-700 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-blue-500/10"
              )}
            >
              {Icon && <Icon className="h-2.5 w-2.5" />}
              <span className="truncate max-w-[120px]">{labelFor(m)}</span>
              {isActive && (
                <span className="ml-0.5 text-[9px] uppercase tracking-wide">
                  active
                </span>
              )}
            </button>
          );
        })}
      </div>
      {error && (
        <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}
    </div>
  );
}
