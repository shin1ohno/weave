"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  Circle,
  INPUT_ICON,
  Settings,
  X,
  Zap,
} from "@/components/icon";
import type { Route } from "@/lib/api";
import { Chip } from "./Chip";
import { GesturePicker } from "./GesturePicker";
import { IntentPicker } from "./IntentPicker";
import {
  GESTURE_LABEL,
  INTENT_KIND,
  INTENT_OBJECT,
  INTENT_VERB,
} from "./vocab";

// Sentence-form view of a single route. Ports
// `/tmp/anthropic-design-fetch/weave/project/hifi-routes-d2.jsx` lines
// 140-208. Renders:
//
//   When I [gesture chip], [intent chip] [· smoothness 80%]?  [+5 live]?  .
//                                                              [duplicate?] [×]
//   [smoothness drawer when expanded]
//
// State ownership:
//   - `openPicker` lives in the parent so only one picker can be open at
//     a time across the whole rule list.
//   - `showParams` (the smoothness drawer toggle) is local — it's purely
//     a per-row UI affordance.
//
// The "smoothness" affordance is rendered as a bespoke <button> rather
// than a <Chip kind="value">. The d2 design uses chip-shaped amber
// styling but the chip primitive always renders a chevron at the end,
// which would clash with the gear icon. We hand-roll the same palette
// inline.

export interface RuleSentenceProps {
  route: Route & { id: string };
  /** Currently-firing gesture from the parent's live trace. */
  hot: string | null;
  /** Latest input value (e.g. "+5") for the live badge. Only displayed
   *  when `hot === route.input`. */
  lastValue: string | null;
  /** Currently-open picker's id, e.g. `g-r1` or `i-r2`. */
  openPicker: string | null;
  setOpenPicker: (next: string | null) => void;
  onUpdate: (next: Route & { id: string }) => void;
  onRemove: () => void;
  onParamChange?: (damping: number) => void;
  /** True when this gesture is also used by another route — paint the
   *  row rose. */
  duplicate?: boolean;
  /** Mapping's device_type — drives gesture-picker filtering so a Hue
   *  Tap Dial sees its numbered buttons and a Nuimo sees rotate / press /
   *  swipe / touch. Optional so callers without device context degrade
   *  to the union picker. */
  deviceType?: string;
}

export function RuleSentence({
  route,
  hot,
  lastValue,
  openPicker,
  setOpenPicker,
  onUpdate,
  onRemove,
  onParamChange,
  duplicate = false,
  deviceType,
}: RuleSentenceProps) {
  const r = route;
  const firing = hot === r.input;
  const verb = INTENT_VERB[r.intent] ?? r.intent;
  const obj = INTENT_OBJECT[r.intent];
  const continuous = INTENT_KIND[r.intent] === "continuous";
  const damping = r.params?.damping ?? 80;
  const [showParams, setShowParams] = useState(false);

  const GestureIcon = INPUT_ICON[r.input] ?? Circle;
  const gestureLabel = GESTURE_LABEL[r.input] ?? r.input;

  // Strip leading articles from the object so the inline rendering reads
  // naturally beside the verb. d2 uses `obj.replace(/^(the |a )/, "")`.
  const objInline = obj ? obj.replace(/^(the |a )/, "") : null;

  const containerClass = clsx(
    "group relative flex flex-wrap items-center gap-1 rounded-xl border bg-white px-4 py-3 transition dark:bg-zinc-900",
    firing
      ? "border-orange-500 ring-2 ring-orange-500/30 dark:bg-orange-500/5"
      : duplicate
        ? "border-rose-300 dark:border-rose-500/40"
        : "border-zinc-950/10 dark:border-white/10"
  );

  const gesturePickerOpen = openPicker === `g-${r.id}`;
  const intentPickerOpen = openPicker === `i-${r.id}`;

  return (
    <div className={containerClass}>
      {/* Live indicator on left edge when firing */}
      {firing && (
        <div className="absolute left-0 top-3 h-[calc(100%-1.5rem)] w-1 rounded-full bg-orange-500" />
      )}

      <Chip kind="word">When I</Chip>
      <div className="relative">
        <Chip
          kind="gesture"
          firing={firing}
          error={duplicate}
          onClick={() =>
            setOpenPicker(gesturePickerOpen ? null : `g-${r.id}`)
          }
        >
          <GestureIcon aria-hidden className="h-2.5 w-2.5" />
          {gestureLabel}
        </Chip>
        {gesturePickerOpen && (
          <GesturePicker
            selected={r.input}
            onPick={(g) => {
              onUpdate({ ...r, input: g });
              setOpenPicker(null);
            }}
            onClose={() => setOpenPicker(null)}
            used={new Set()}
            deviceType={deviceType}
          />
        )}
      </div>
      <Chip kind="word">,</Chip>
      <div className="relative">
        <Chip
          kind="intent"
          onClick={() =>
            setOpenPicker(intentPickerOpen ? null : `i-${r.id}`)
          }
        >
          {verb}
          {objInline && (
            <span className="ml-0.5 opacity-70"> {objInline}</span>
          )}
        </Chip>
        {intentPickerOpen && (
          <IntentPicker
            selected={r.intent}
            gesture={r.input}
            onPick={(i) => {
              onUpdate({ ...r, intent: i });
              setOpenPicker(null);
            }}
            onClose={() => setOpenPicker(null)}
          />
        )}
      </div>

      {/* params */}
      {continuous && (
        <>
          <Chip kind="word">·</Chip>
          <button
            type="button"
            onClick={() => setShowParams(!showParams)}
            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[13px] font-medium leading-7 text-amber-900 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100"
          >
            <Settings aria-hidden className="h-2.5 w-2.5" />
            smoothness {damping}%
          </button>
        </>
      )}

      {/* live firing value */}
      {firing && lastValue && (
        <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 font-mono text-[12px] font-semibold text-orange-700 dark:bg-orange-500/25 dark:text-orange-100">
          <Zap aria-hidden className="h-2.5 w-2.5" />
          {lastValue}
        </span>
      )}

      <Chip kind="word">.</Chip>

      {/* meta + remove */}
      <div className="ml-auto flex items-center gap-2">
        {duplicate && (
          <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400">
            <Zap aria-hidden className="h-2.5 w-2.5" />
            duplicate gesture
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove rule"
          title="Remove rule"
          className="rounded p-1 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* params drawer */}
      {showParams && continuous && (
        <div className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Smoothness · damping
            </span>
            <span className="font-mono text-[12px] font-semibold text-amber-900 dark:text-amber-100">
              {damping}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={damping}
            onChange={(e) => onParamChange?.(Number(e.target.value))}
            className="w-full accent-amber-600"
            aria-label="Smoothness damping"
          />
          <div className="mt-1 flex justify-between text-[10px] text-amber-700/70 dark:text-amber-200/60">
            <span>0% · raw / jumpy</span>
            <span>100% · very smooth</span>
          </div>
        </div>
      )}
    </div>
  );
}
