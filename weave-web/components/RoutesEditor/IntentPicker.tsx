"use client";

import { Check, Zap } from "@/components/icon";
import { ChipPopover } from "./ChipPopover";
import {
  GESTURE_KIND,
  INTENT_GROUPS,
  INTENT_KIND,
  INTENT_OBJECT,
  INTENT_VERB,
} from "./vocab";

// Intent chooser surfaced when the user clicks the intent chip. Ports
// `/tmp/anthropic-design-fetch/weave/project/hifi-routes-d2.jsx` lines
// 111-137. The gesture's kind (`continuous` vs `discrete`, looked up via
// `GESTURE_KIND`) drives the filter:
//   - continuous gestures → only continuous intents (volume / brightness /
//     seek). A blue hint banner explains why.
//   - discrete gestures → all intents (the vocabulary pairs them sensibly
//     out of the box; the picker doesn't try to be cleverer than that).

export interface IntentPickerProps {
  selected: string;
  /** The route's gesture — used to filter the list to compatible intents. */
  gesture: string;
  onPick: (intent: string) => void;
  onClose: () => void;
  /** Reserved for future per-service filtering. Currently unused but
   *  accept the prop so the call site doesn't change later. */
  serviceType?: string;
}

export function IntentPicker({
  selected,
  gesture,
  onPick,
  onClose,
  // serviceType reserved for future per-service filtering; intentionally
  // unused right now.
  serviceType: _serviceType,
}: IntentPickerProps) {
  void _serviceType;
  const allowedKind = GESTURE_KIND[gesture];
  const groups = INTENT_GROUPS.map((grp) => ({
    ...grp,
    items: grp.items.filter((i) => {
      if (allowedKind === "continuous") return INTENT_KIND[i] === "continuous";
      // Discrete gestures show all intents; the design intentionally lets
      // the user reach for a continuous intent here even though it won't
      // pair perfectly — feedback comes from the parent's validation step.
      return true;
    }),
  })).filter((g) => g.items.length > 0);

  return (
    <ChipPopover title="do what?" onClose={onClose} width={300}>
      {allowedKind === "continuous" && (
        <div className="mx-1 mb-1 rounded-md bg-blue-50 px-2 py-1.5 text-[11px] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          <Zap aria-hidden className="mr-1 inline h-2.5 w-2.5" />
          Continuous gestures only pair with continuous intents (volume /
          brightness / seek).
        </div>
      )}
      {groups.map((g) => (
        <div key={g.label} className="px-1 pb-1">
          <div className="mb-0.5 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
            {g.label}
          </div>
          {g.items.map((it) => {
            const isSelected = it === selected;
            const verb = INTENT_VERB[it] ?? it;
            const obj = INTENT_OBJECT[it];
            const rowClass = isSelected
              ? "bg-emerald-600 text-white"
              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5";
            return (
              <button
                key={it}
                type="button"
                onClick={() => onPick(it)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition ${rowClass}`}
              >
                <span className="font-medium">{verb}</span>
                {obj && (
                  <span
                    className={isSelected ? "opacity-90" : "text-zinc-400"}
                  >
                    {" "}
                    {obj}
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
