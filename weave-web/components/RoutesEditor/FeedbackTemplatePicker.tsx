"use client";

import {
  Volume2,
  Play,
  Lightbulb,
  Zap,
  type LucideIcon,
} from "@/components/icon";
import { ChipPopover } from "./ChipPopover";
import {
  feedbackTemplatesFor,
  SERVICE_DOMAIN,
  type FeedbackTemplate,
} from "./vocab";

// Domain-aware feedback-template chooser surfaced when the user clicks
// the "Add feedback" affordance on a route's feedback rail. Ports the
// design from
// `/tmp/anthropic-design-fetch/weave/project/hifi-routes-d2.jsx`
// (lines 366-394): a 320-wide popover whose card rows show a small
// emerald-tinted glyph square, a bold label (with an "added" badge for
// templates already in use), and a 2-line muted description. The
// footer carries a placeholder link to a custom-rule editor that is
// out-of-scope for this PR — rendered but inert.

const GLYPH_ICON: Record<string, LucideIcon> = {
  vol: Volume2,
  play: Play,
  bulb: Lightbulb,
  zap: Zap,
};

export interface FeedbackTemplatePickerProps {
  serviceType: string;
  /** Set of template ids already added — those rows render disabled with an
   *  "added" badge. */
  used: Set<string>;
  onPick: (template: FeedbackTemplate) => void;
  onClose: () => void;
}

export function FeedbackTemplatePicker({
  serviceType,
  used,
  onPick,
  onClose,
}: FeedbackTemplatePickerProps) {
  const items = feedbackTemplatesFor(serviceType);
  const domain = SERVICE_DOMAIN[serviceType] ?? "generic";
  return (
    <ChipPopover
      title={`Add feedback · ${domain}`}
      onClose={onClose}
      width={320}
    >
      <div className="px-1 pb-1">
        {items.map((it) => {
          const isUsed = used.has(it.id);
          const Icon = GLYPH_ICON[it.glyph] ?? Zap;
          const rowClass = isUsed
            ? "cursor-not-allowed opacity-50"
            : "hover:bg-zinc-100 dark:hover:bg-white/5";
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => {
                if (!isUsed) onPick(it);
              }}
              disabled={isUsed}
              className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition ${rowClass}`}
            >
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Icon aria-hidden className="h-3 w-3" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">
                  {it.label}
                  {isUsed && (
                    <span className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[9px] font-normal text-zinc-500 dark:bg-white/5">
                      added
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {it.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="border-t border-zinc-100 px-2 py-1.5 text-[10px] text-zinc-500 dark:border-white/5">
        Or{" "}
        <button
          type="button"
          aria-disabled
          disabled
          className="cursor-not-allowed text-blue-600 opacity-60 hover:underline dark:text-blue-400"
        >
          build a custom feedback rule →
        </button>
      </div>
    </ChipPopover>
  );
}
