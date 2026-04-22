"use client";

import type { FeedbackRule, Mapping } from "@/lib/api";
import { FeedbackSection } from "@/components/FeedbackSection";

interface Props {
  mapping: Mapping;
  onUpdate: <K extends keyof Mapping>(key: K, value: Mapping[K]) => void;
}

/** Wrapper over the existing FeedbackSection. Also the right place to
 * surface the "edge-agent doesn't evaluate FeedbackRule yet" caveat — the
 * server-side engine only defines and broadcasts these rules; runtime
 * firing is scoped to the edge-agent (see project TODO.md). Until that
 * lands, feedback rules show up in the API but don't drive device LEDs. */
export function FeedbackRail({ mapping, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-300/40 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-600/30 dark:bg-amber-500/5 dark:text-amber-300">
        Heads up: feedback rules are stored and broadcast, but the edge-agent
        runtime evaluator is still pending. Rules won&apos;t drive LED feedback
        on the device until that lands.
      </div>
      <FeedbackSection
        feedback={mapping.feedback}
        onChange={(next: FeedbackRule[]) => onUpdate("feedback", next)}
        serviceType={mapping.service_type}
        serviceTarget={mapping.service_target}
      />
    </div>
  );
}
