"use client";

import clsx from "clsx";
import { useCallback, useRef, useState } from "react";
import { Battery, DEVICE_ICON, Link2, WifiOff } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveDot } from "@/components/ui/live-dot";
import {
  connectDevice,
  disconnectDevice,
  testGlyphADevice,
} from "@/lib/api";
import type { DeviceSummary } from "@/lib/devices";
import type { LastInput } from "@/lib/ws";
import { NuimoViz } from "./NuimoViz";

interface Props {
  device: DeviceSummary;
  selected: boolean;
  lastInput: LastInput | null;
  firing: boolean;
  onClick: () => void;
}

/** Pick the visual representation for the tile's leading slot.
 *
 * Nuimo gets its bespoke `NuimoViz` (LED matrix preview keyed off the
 * `led` device-state property). Every other device_type falls back to a
 * lucide icon from `DEVICE_ICON`; if no icon is registered, the slot
 * stays empty rather than showing a misleading Nuimo silhouette. */
function DeviceVisual({
  device,
  firing,
}: {
  device: DeviceSummary;
  firing: boolean;
}) {
  if (device.device_type === "nuimo") {
    return <NuimoViz pattern={device.led} size={56} firing={firing} />;
  }
  const Icon = DEVICE_ICON[device.device_type];
  if (!Icon) return <div className="h-14 w-14" />;
  return (
    <div
      className={clsx(
        "flex h-14 w-14 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
        firing && "ring-2 ring-orange-500"
      )}
    >
      <Icon className="h-8 w-8" />
    </div>
  );
}

function batteryColor(
  battery: number | null
): "green" | "amber" | "red" | "zinc" {
  if (battery == null) return "zinc";
  if (battery < 30) return "red";
  if (battery < 60) return "amber";
  return "green";
}

export function DeviceTile({
  device,
  selected,
  lastInput,
  firing,
  onClick,
}: Props) {
  const battery = device.battery;
  // `lastInput` lingers in the store after the firing fade-out, so the
  // tile keeps showing the most recent gesture as a tail trace. The
  // orange ping above is what signals "right now" — the footer line is
  // the historical record.
  const showLastInput = lastInput != null;

  // Device-control button row state. `pending` debounces double-clicks;
  // `error` surfaces a transient failure message that auto-clears after
  // five seconds so it never sticks around forever.
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashError = useCallback((message: string) => {
    setError(message);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => setError(null), 5000);
  }, []);

  const runDeviceAction = useCallback(
    async (
      e: React.MouseEvent<HTMLElement>,
      action: (
        edgeId: string,
        deviceType: string,
        deviceId: string
      ) => Promise<void>
    ) => {
      e.stopPropagation();
      setPending(true);
      setError(null);
      try {
        await action(device.edge_id, device.device_type, device.device_id);
      } catch (err) {
        flashError(err instanceof Error ? err.message : String(err));
      } finally {
        setPending(false);
      }
    },
    [device.edge_id, device.device_type, device.device_id, flashError]
  );

  const onConnect = useCallback(
    (e: React.MouseEvent<HTMLElement>) => runDeviceAction(e, connectDevice),
    [runDeviceAction]
  );
  const onDisconnect = useCallback(
    (e: React.MouseEvent<HTMLElement>) => runDeviceAction(e, disconnectDevice),
    [runDeviceAction]
  );
  const onTestGlyph = useCallback(
    (e: React.MouseEvent<HTMLElement>) => runDeviceAction(e, testGlyphADevice),
    [runDeviceAction]
  );

  // The tile itself acts as a button (selecting the device), but its
  // body now contains real <button> children (Connect / Disconnect /
  // Test LED). HTML forbids nested buttons, and React + browsers split
  // their interpretation of click bubbling on nested actionable elements.
  // Render the wrapper as `role="button"` on a <div> with explicit
  // keyboard activation (Enter / Space) so semantics match a native
  // toggle and child buttons stay valid.
  const onWrapperKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onWrapperKeyDown}
      aria-pressed={selected}
      className={clsx(
        "group relative w-full cursor-pointer rounded-xl border bg-white p-4 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-zinc-900",
        selected
          ? "border-blue-500 ring-2 ring-blue-500/30"
          : "border-zinc-950/5 hover:border-zinc-950/10 dark:border-white/10 dark:hover:border-white/15",
        !device.connected && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <DeviceVisual device={device} firing={firing} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-base font-semibold text-zinc-950 dark:text-white">
              {device.nickname}
            </div>
            {firing && <LiveDot color="orange" firing aria-label="firing" />}
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {device.device_type} · {device.device_id.slice(-8)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {device.connected ? (
              <Badge color={batteryColor(battery)}>
                <Battery className="h-2.5 w-2.5" />
                {battery != null ? `${battery}%` : "—"}
              </Badge>
            ) : (
              <Badge color="zinc">
                <WifiOff className="h-2.5 w-2.5" />
                offline
              </Badge>
            )}
            <Badge color="zinc">
              <Link2 className="h-2.5 w-2.5" />
              {device.connectionsCount}
            </Badge>
          </div>
          {/* Device-control row. Gated on `device_type === "nuimo"`
           * because only Nuimo peripherals support BLE pair / unpair /
           * LED display via the edge-agent. Hue Tap Dial and similar
           * non-BLE-pair devices have nothing meaningful behind these
           * buttons — `DeviceControlBridge.swift` already short-circuits
           * non-nuimo types — so hide the row entirely.
           *
           * `stopPropagation` keeps clicks on these buttons from
           * bubbling up to the wrapper (which would toggle device
           * selection). The wrapper is a div with `role="button"`, but
           * click bubbling still reaches it. */}
          {device.device_type === "nuimo" && (
            <div
              className="mt-2 flex flex-wrap items-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                plain
                disabled={device.connected || pending}
                onClick={onConnect}
                className="!px-2 !py-0.5 !text-[11px]"
              >
                Connect
              </Button>
              <Button
                plain
                disabled={!device.connected || pending}
                onClick={onDisconnect}
                className="!px-2 !py-0.5 !text-[11px]"
              >
                Disconnect
              </Button>
              <Button
                plain
                disabled={!device.connected || pending}
                onClick={onTestGlyph}
                className="!px-2 !py-0.5 !text-[11px]"
              >
                Test LED · A
              </Button>
            </div>
          )}
          {error && (
            <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}
          {showLastInput && lastInput && (
            <div
              className={clsx(
                "mt-2 truncate font-mono text-[11px]",
                firing
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-zinc-500 dark:text-zinc-500"
              )}
            >
              {firing ? "now" : "last"} · {lastInput.input}
              {lastInput.value !== undefined &&
              lastInput.value !== null &&
              typeof lastInput.value !== "object"
                ? ` ${String(lastInput.value)}`
                : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
