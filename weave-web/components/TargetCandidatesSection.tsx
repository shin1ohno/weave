"use client";

import { useMemo } from "react";
import { useUIState } from "@/lib/ws";
import { GlyphPicker } from "./GlyphPicker";
import type { TargetCandidate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Subheading } from "@/components/ui/heading";
import { Text, Code } from "@/components/ui/text";

// Inputs allowed as the selection-mode trigger. These are the snake-case
// serialized names of the Rust `InputType` enum (weave-engine primitives).
// `rotate` and `press` are reserved for in-mode browse/confirm, so we
// deliberately exclude them from the picker.
const SWITCH_INPUTS = [
  "long_press",
  "swipe_up",
  "swipe_down",
  "swipe_left",
  "swipe_right",
  "long_touch_top",
  "long_touch_bottom",
  "long_touch_left",
  "long_touch_right",
];

interface Props {
  candidates: TargetCandidate[];
  switchOn: string | null;
  onCandidatesChange: (next: TargetCandidate[]) => void;
  onSwitchOnChange: (next: string | null) => void;
  serviceType: string;
  serviceTarget: string;
}

export function TargetCandidatesSection({
  candidates,
  switchOn,
  onCandidatesChange,
  onSwitchOnChange,
  serviceType,
  serviceTarget,
}: Props) {
  const state = useUIState();

  // Reuse the same "known targets" heuristic as the mapping form header —
  // filter live service_states by the mapping's service_type + the target-
  // identity property (zone / light / ...).
  const knownTargets = useMemo(() => {
    const metaProperty =
      serviceType === "hue"
        ? "light"
        : serviceType === "roon"
          ? "zone"
          : null;
    if (!metaProperty) return [];
    const seen = new Set<string>();
    const out: { target: string; label: string }[] = [];
    for (const s of state.serviceStates) {
      if (s.service_type !== serviceType) continue;
      if (s.property !== metaProperty) continue;
      if (seen.has(s.target)) continue;
      seen.add(s.target);
      const label =
        (s.value as { display_name?: string } | undefined)?.display_name ??
        s.target;
      out.push({ target: s.target, label });
    }
    return out;
  }, [state.serviceStates, serviceType]);

  const labelFor = (target: string) =>
    knownTargets.find((t) => t.target === target)?.label ?? "";

  const setField = (
    i: number,
    field: keyof TargetCandidate,
    value: string
  ) => {
    const next = [...candidates];
    next[i] = { ...next[i], [field]: value };
    onCandidatesChange(next);
  };
  const setTarget = (i: number, target: string) => {
    const next = [...candidates];
    // Auto-populate label from live state when target changes, unless the
    // user has already customized the label.
    const inferred = labelFor(target);
    const label =
      next[i].label && next[i].label !== labelFor(next[i].target)
        ? next[i].label
        : inferred;
    next[i] = { ...next[i], target, label };
    onCandidatesChange(next);
  };
  const remove = (i: number) =>
    onCandidatesChange(candidates.filter((_, idx) => idx !== i));
  const add = () => {
    // Default to the current service_target as the first pick so the user
    // can quickly add the already-active target to the rotation.
    const target = candidates.length === 0 ? serviceTarget : "";
    const label = target ? labelFor(target) : "";
    onCandidatesChange([...candidates, { target, label, glyph: "" }]);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= candidates.length) return;
    const next = [...candidates];
    [next[i], next[j]] = [next[j], next[i]];
    onCandidatesChange(next);
  };

  return (
    <div className="space-y-3 rounded-lg border border-zinc-950/5 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Subheading level={3}>Target candidates</Subheading>
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">
            switch on
          </label>
          <div className="min-w-36">
            <Select
              value={switchOn ?? ""}
              onChange={(e) =>
                onSwitchOnChange(e.target.value === "" ? null : e.target.value)
              }
            >
              <option value="">— disabled —</option>
              {SWITCH_INPUTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <Button type="button" plain onClick={add}>
            + Add candidate
          </Button>
        </div>
      </div>
      {candidates.length === 0 && (
        <Text>
          No candidates. Add 2+ entries and set <Code>switch on</Code> to let
          the device cycle between targets — e.g. long-press to enter mode,
          rotate to browse, press to confirm.
        </Text>
      )}
      {candidates.map((c, i) => {
        return (
          <div
            key={i}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-950/5 p-3 dark:border-white/10"
          >
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              #{i + 1}
            </span>
            <div className="min-w-40 flex-1">
              <Input
                value={c.target}
                onChange={(e) => setTarget(i, e.target.value)}
                list={
                  knownTargets.length > 0
                    ? `target-candidate-suggest-${i}`
                    : undefined
                }
                placeholder="service_target"
                className="font-mono"
              />
              {knownTargets.length > 0 && (
                <datalist id={`target-candidate-suggest-${i}`}>
                  {knownTargets.map((t) => (
                    <option key={t.target} value={t.target}>
                      {t.label}
                    </option>
                  ))}
                </datalist>
              )}
            </div>
            <div className="min-w-32">
              <Input
                value={c.label}
                onChange={(e) => setField(i, "label", e.target.value)}
                placeholder="label"
              />
            </div>
            <GlyphPicker
              value={c.glyph}
              onChange={(v) => setField(i, "glyph", v)}
              glyphs={state.glyphs}
            />
            <Button
              type="button"
              plain
              onClick={() => move(i, -1)}
              disabled={i === 0}
              title="Move up"
            >
              ↑
            </Button>
            <Button
              type="button"
              plain
              onClick={() => move(i, 1)}
              disabled={i === candidates.length - 1}
              title="Move down"
            >
              ↓
            </Button>
            <Button
              type="button"
              plain
              onClick={() => remove(i)}
              className="!text-red-600"
            >
              ✕
            </Button>
          </div>
        );
      })}
    </div>
  );
}
