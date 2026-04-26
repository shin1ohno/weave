"use client";

import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { LiveDot } from "@/components/ui/live-dot";

interface TryFooterProps {
  /** Currently-firing gesture (e.g. "rotate", "press") or null when idle. */
  hot: string | null;
  /** Latest input value (e.g. "+5"). Optional — many gestures don't carry
   * a numeric payload. */
  lastValue: string | null;
  /** Display label of the target the firing event resolved to. Only shown
   * while `hot` is non-null; otherwise the trace area renders the prompt. */
  recentTarget: string;
}

/** Bottom strip of the conversation-builder editor: live firing indicator
 * + hardware-trace echo on the left, and ⌘Enter / esc keyboard hints on
 * the right. Visual port of d2 lines 297-307. */
export function TryFooter({ hot, lastValue, recentTarget }: TryFooterProps) {
  return (
    <div className="flex items-center gap-3 border-t border-zinc-950/5 bg-zinc-50/60 px-5 py-3 dark:border-white/10 dark:bg-white/[0.02]">
      {hot ? (
        <Badge color="orange">
          <LiveDot color="orange" firing />
          firing
        </Badge>
      ) : (
        <Badge color="zinc">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          idle
        </Badge>
      )}

      <div className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
        {hot ? (
          <>
            {hot}
            {lastValue ? ` · ${lastValue}` : ""}
            {" → "}
            <span className="text-blue-600 dark:text-blue-400">
              {recentTarget}
            </span>
          </>
        ) : (
          "touch the device to test"
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Kbd>⌘</Kbd>
        <Kbd>Enter</Kbd> save · <Kbd>esc</Kbd> close
      </div>
    </div>
  );
}
