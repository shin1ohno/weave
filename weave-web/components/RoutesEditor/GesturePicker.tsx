"use client";

import { Check, INPUT_ICON, Circle } from "@/components/icon";
import { ChipPopover } from "./ChipPopover";
import { GESTURE_LABEL } from "./vocab";

// Gesture chooser surfaced when the user clicks the gesture chip in a
// `RuleSentence`. Ports the design from
// `/tmp/anthropic-design-fetch/weave/project/hifi-routes-d2.jsx` (lines
// 84-108): four labelled groups (Continuous / Buttons / Swipes / Touch
// zones), with the currently-selected row in the gesture-chip blue and
// any gesture already taken by *another* route disabled with a "used"
// hint on the right. The gesture currently picked by THIS route stays
// selectable so the user can re-confirm without first clearing it.

interface GroupDef {
  label: string;
  items: string[];
}

// Per-device-type gesture filters. Each device only emits the gestures
// listed in its bucket; surfacing irrelevant ones (e.g. swipe_up on a
// Hue Tap Dial that has only 4 buttons + rotation) just clutters the
// picker. Devices not in this map fall back to `DEFAULT_GROUPS` which
// shows everything — keeps the editor usable for novel device types
// before we know their capability profile.
const NUIMO_GROUPS: GroupDef[] = [
  { label: "Continuous", items: ["rotate", "slide"] },
  { label: "Buttons", items: ["press", "long_press", "release"] },
  {
    label: "Swipes",
    items: ["swipe_up", "swipe_down", "swipe_left", "swipe_right"],
  },
  {
    label: "Touch zones",
    items: ["touch_top", "touch_bottom", "touch_left", "touch_right"],
  },
];

const HUE_TAP_DIAL_GROUPS: GroupDef[] = [
  { label: "Continuous", items: ["rotate"] },
  {
    label: "Numbered buttons",
    items: ["button_1", "button_2", "button_3", "button_4"],
  },
];

const DEFAULT_GROUPS: GroupDef[] = [
  { label: "Continuous", items: ["rotate", "slide"] },
  { label: "Buttons", items: ["press", "long_press", "release"] },
  {
    label: "Numbered buttons",
    items: ["button_1", "button_2", "button_3", "button_4"],
  },
  {
    label: "Swipes",
    items: ["swipe_up", "swipe_down", "swipe_left", "swipe_right"],
  },
  {
    label: "Touch zones",
    items: ["touch_top", "touch_bottom", "touch_left", "touch_right"],
  },
];

const GROUPS_BY_DEVICE_TYPE: Record<string, GroupDef[]> = {
  nuimo: NUIMO_GROUPS,
  hue_tap_dial: HUE_TAP_DIAL_GROUPS,
};

function groupsFor(deviceType: string | undefined): GroupDef[] {
  if (deviceType && GROUPS_BY_DEVICE_TYPE[deviceType]) {
    return GROUPS_BY_DEVICE_TYPE[deviceType];
  }
  return DEFAULT_GROUPS;
}

export interface GesturePickerProps {
  selected: string;
  onPick: (gesture: string) => void;
  onClose: () => void;
  /** Gestures already used by other routes (for disabling). The `selected`
   *  gesture is allowed even if "used" by its own route. */
  used?: Set<string>;
  /** When provided, the picker filters its groups to the input set the
   *  device is known to emit (Nuimo press/swipe/touch vs Hue Tap Dial
   *  numbered buttons). Unknown / undefined falls back to the union of
   *  every supported gesture so editor still works for novel devices. */
  deviceType?: string;
}

export function GesturePicker({
  selected,
  onPick,
  onClose,
  used = new Set(),
  deviceType,
}: GesturePickerProps) {
  const groups = groupsFor(deviceType);
  return (
    <ChipPopover title="When I…" onClose={onClose}>
      {groups.map((g) => (
        <div key={g.label} className="px-1 pb-1">
          <div className="mb-0.5 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
            {g.label}
          </div>
          {g.items.map((it) => {
            const isSelected = it === selected;
            const isUsed = used.has(it) && !isSelected;
            const Icon = INPUT_ICON[it] ?? Circle;
            const rowClass = isSelected
              ? "bg-blue-600 text-white"
              : isUsed
                ? "cursor-not-allowed text-zinc-300 dark:text-zinc-600"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5";
            return (
              <button
                key={it}
                type="button"
                onClick={() => onPick(it)}
                disabled={isUsed}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition ${rowClass}`}
              >
                <Icon aria-hidden className="h-3 w-3" />
                <span className="font-medium">{GESTURE_LABEL[it] ?? it}</span>
                {isUsed && (
                  <span className="ml-auto text-[10px] text-zinc-400">
                    used
                  </span>
                )}
                {isSelected && (
                  <Check aria-hidden className="ml-auto h-3 w-3" />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </ChipPopover>
  );
}
