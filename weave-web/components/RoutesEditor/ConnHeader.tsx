"use client";

import { Button } from "@/components/ui/button";
import {
  Check,
  ChevronRight,
  DEVICE_ICON,
  Play,
  SERVICE_ICON,
} from "@/components/icon";
import { NuimoViz } from "@/components/ConnectionsView/NuimoViz";
import type { DeviceSummary } from "@/lib/devices";

interface ConnHeaderProps {
  device: DeviceSummary | null;
  /** Target label (e.g. "Kitchen") — fallback to mapping.service_target id
   * when no live target row has been observed yet. */
  targetLabel: string;
  /** Service type (e.g. "roon", "hue") — used to pick the service icon and
   * the trailing target-kind suffix in the mono caption. */
  serviceType: string;
  /** True when local edits diverge from server-saved state. */
  dirty: boolean;
  /** Disabled while a save is in flight. */
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
}

/** Maps service_type → the noun rendered in the mono caption under the
 * target label. Roon zones, Hue lights, etc. Falls back to "target" when
 * a service has no registered noun yet. */
const SERVICE_TARGET_KIND: Record<string, string> = {
  roon: "zone",
  hue: "light",
  macos: "output",
  ios_media: "now playing",
};

/** Top strip of the conversation-builder editor: a left-to-right summary of
 * the device → service-target wiring, plus the dirty/saved indicator and
 * the Cancel/Save action cluster. Visual port of d2 lines 261-294 — see
 * `/tmp/anthropic-design-fetch/weave/project/hifi-routes-d2.jsx`. */
export function ConnHeader({
  device,
  targetLabel,
  serviceType,
  dirty,
  saving = false,
  onSave,
  onCancel,
}: ConnHeaderProps) {
  // Device caption: `<device_type> · <last5(device_id)>` mirrors the
  // mono microcopy convention used elsewhere in the editor (Identity /
  // Target blocks). Falls back to a placeholder when no device has been
  // wired yet (e.g. mode=new before identity selection).
  const deviceTypeLabel = device?.device_type ?? "device";
  const deviceIdSuffix = device?.device_id.slice(-5) ?? "—";

  // Render Nuimo via the bespoke 8×8 viz; everything else falls back to
  // the registered lucide icon (or a generic Play if the service map has
  // no entry yet) inside a 9×9 chip identical to the target side.
  const isNuimo = device?.device_type === "nuimo";
  const DeviceFallbackIcon = device
    ? DEVICE_ICON[device.device_type] ?? Play
    : Play;

  const ServiceIcon = SERVICE_ICON[serviceType] ?? Play;
  const serviceKind = SERVICE_TARGET_KIND[serviceType] ?? "target";

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-zinc-950/5 bg-zinc-50/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.02] sm:px-5">
      {/* device side */}
      <div className="flex min-w-0 items-center gap-2">
        {isNuimo ? (
          <NuimoViz pattern={device?.led ?? "blank"} size={36} />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-300">
            <DeviceFallbackIcon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold leading-tight">
            {device?.nickname ?? "—"}
          </div>
          <div className="truncate font-mono text-[10px] text-zinc-500">
            {deviceTypeLabel} · {deviceIdSuffix}
          </div>
        </div>
      </div>

      {/* connector: line · chevron · line */}
      <div className="flex items-center text-zinc-400">
        <div className="h-px w-4 bg-zinc-300 dark:bg-zinc-600 sm:w-6" />
        <ChevronRight className="h-3.5 w-3.5" />
        <div className="h-px w-4 bg-zinc-300 dark:bg-zinc-600 sm:w-6" />
      </div>

      {/* target side */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-300">
          <ServiceIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold leading-tight">
            {targetLabel}
          </div>
          <div className="truncate font-mono text-[10px] text-zinc-500">
            {serviceType} · {serviceKind}
          </div>
        </div>
      </div>

      {/* right cluster: dirty/saved indicator + actions */}
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {dirty ? (
          <span className="hidden items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            unsaved
          </span>
        ) : (
          <span className="hidden items-center gap-1.5 text-[11px] text-zinc-500 sm:inline-flex">
            <Check className="h-2.5 w-2.5" />
            saved
          </span>
        )}
        <Button outline onClick={onCancel} className="!px-2 !py-1 !text-xs">
          Cancel
        </Button>
        <Button
          color="blue"
          onClick={onSave}
          disabled={saving}
          className="!px-2 !py-1 !text-xs"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
