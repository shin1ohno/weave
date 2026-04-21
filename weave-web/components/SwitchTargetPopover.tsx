"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Headless from "@headlessui/react";
import type { Mapping, TargetCandidate } from "@/lib/api";
import { switchTarget } from "@/lib/api";
import { useUIState, useUIDispatch } from "@/lib/ws";
import { useKnownTargets } from "@/hooks/useKnownTargets";
import { useRowSelection } from "@/hooks/useRowSelection";
import { GlyphPreview } from "./GlyphPreview";

interface Props {
  mapping: Mapping;
}

interface Choice {
  target: string;
  label: string;
  glyph?: string;
}

/**
 * Inline popover that switches a mapping's `service_target` in one click.
 *
 * - Candidate source: if the mapping has explicit `target_candidates`, those
 *   are shown (preserving author-defined glyphs / order). Otherwise falls
 *   back to the live `useKnownTargets(service_type)` list.
 * - Optimistic update: on pick we (1) flip `service_target` locally,
 *   (2) add the mapping to `pendingSwitches` (so incoming broadcasts don't
 *   race-overwrite the local state), (3) fire `switchTarget`. On success we
 *   drop the pending flag so the next broadcast applies. On failure we roll
 *   back.
 * - AbortController dedupe: a rapid second click aborts the previous
 *   in-flight call. We still always issue a fresh request — the server-side
 *   state is what wins.
 * - Disconnected guard: if the WS is down, the popover renders a warning
 *   and disables choice buttons — the broadcast ACK won't arrive and
 *   blind-firing would desync.
 */
export function SwitchTargetPopover({ mapping }: Props) {
  const state = useUIState();
  const dispatch = useUIDispatch();
  const knownTargets = useKnownTargets(mapping.service_type);
  const abortRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const announceRef = useRef<HTMLSpanElement | null>(null);

  // Observe the RowSelection `requestedAction` channel for a matching
  // open request (fired by `s` keybind or command palette's "Switch target"
  // entry). When the ids align we imperatively click the PopoverButton —
  // there is no declarative `open` prop on Headless `Popover`, so the click
  // is the one supported path to programmatic open. The announce text is
  // written to the DOM directly (external-system update) to stay out of
  // React state and keep the effect free of `setState`-in-effect violations.
  const { requestedAction, consumeAction } = useRowSelection();
  useEffect(() => {
    if (!requestedAction) return;
    if (requestedAction.kind !== "switch") return;
    if (requestedAction.mappingId !== mapping.mapping_id) return;
    buttonRef.current?.click();
    if (announceRef.current) {
      // Clear then set — assistive tech announces only on text change.
      announceRef.current.textContent = "";
      announceRef.current.textContent = "Switch target opened";
    }
    consumeAction();
  }, [requestedAction, mapping.mapping_id, consumeAction]);

  const choices: Choice[] = useMemo(() => {
    const explicit: TargetCandidate[] = mapping.target_candidates ?? [];
    if (explicit.length > 0) {
      return explicit
        .filter((c) => c.target)
        .map((c) => ({
          target: c.target,
          label: c.label || c.target,
          glyph: c.glyph || undefined,
        }));
    }
    return knownTargets.map((t) => ({
      target: t.target,
      label: t.label,
      glyph: undefined,
    }));
  }, [mapping.target_candidates, knownTargets]);

  const glyphByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of state.glyphs) m.set(g.name, g.pattern);
    return m;
  }, [state.glyphs]);

  const pick = async (next: string, close: () => void) => {
    if (next === mapping.service_target) {
      close();
      return;
    }
    const previous = mapping.service_target;

    // Abort any earlier in-flight call — rapid clicks shouldn't stack.
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    dispatch({
      kind: "local_set_mapping_target",
      id: mapping.mapping_id,
      service_target: next,
    });
    dispatch({ kind: "switch_pending_start", id: mapping.mapping_id });
    setError(null);
    close();

    try {
      await switchTarget(mapping.mapping_id, next);
      // Success: drop the pending flag so the next broadcast can apply the
      // server's canonical state (which should already match our optimistic
      // update).
      if (!ac.signal.aborted) {
        dispatch({ kind: "switch_pending_end", id: mapping.mapping_id });
      }
    } catch (e) {
      if (ac.signal.aborted) return;
      // Rollback local state + clear pending so broadcasts resume applying.
      dispatch({
        kind: "local_set_mapping_target",
        id: mapping.mapping_id,
        service_target: previous,
      });
      dispatch({ kind: "switch_pending_end", id: mapping.mapping_id });
      setError(e instanceof Error ? e.message : "switch failed");
    }
  };

  if (choices.length === 0) return null;

  return (
    <Headless.Popover className="relative">
      <Headless.PopoverButton
        ref={buttonRef}
        className="rounded border border-zinc-200 px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-50 focus:outline-none data-focus:ring-2 data-focus:ring-blue-500 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-label="Switch target"
      >
        switch
      </Headless.PopoverButton>
      <span
        ref={announceRef}
        role="status"
        aria-live="polite"
        className="sr-only"
      />
      <Headless.PopoverPanel
        anchor="bottom end"
        transition
        className="z-20 mt-1 min-w-56 rounded-md border border-zinc-950/10 bg-white p-1 shadow-lg ring-1 ring-zinc-950/5 transition duration-100 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in dark:border-white/10 dark:bg-zinc-900"
      >
        {({ close }) => (
          <div className="flex flex-col">
            {!state.connected && (
              <div className="px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
                disconnected — switch will not apply
              </div>
            )}
            {error && (
              <div className="px-2 py-1 text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            {choices.map((c) => {
              const active = c.target === mapping.service_target;
              const pattern = c.glyph ? glyphByName.get(c.glyph) : undefined;
              return (
                <button
                  key={c.target}
                  type="button"
                  disabled={!state.connected || active}
                  onClick={() => pick(c.target, close)}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {pattern !== undefined ? (
                    <GlyphPreview pattern={pattern} size={20} />
                  ) : (
                    <span
                      className="inline-block shrink-0 rounded bg-zinc-200 dark:bg-zinc-700"
                      style={{ width: 20, height: 20 }}
                      aria-hidden
                    />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {c.label}
                    </span>
                    <span className="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                      {c.target}
                    </span>
                  </span>
                  {active && (
                    <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                      current
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Headless.PopoverPanel>
    </Headless.Popover>
  );
}
