"use client";

import { useState } from "react";
import { useUIState } from "@/lib/ws";
import { useKnownTargets, type KnownTarget } from "@/hooks/useKnownTargets";
import { GlyphPicker } from "./GlyphPicker";
import type { Glyph, TargetCandidate } from "@/lib/api";
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
  // Shared "known targets" heuristic (see useKnownTargets) — same shape the
  // inline SwitchTargetPopover consumes.
  const knownTargets = useKnownTargets(serviceType);

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
      {candidates.map((c, i) => (
        <CandidateRow
          key={i}
          index={i}
          candidate={c}
          total={candidates.length}
          knownTargets={knownTargets}
          glyphs={state.glyphs}
          onTargetChange={(target) => setTarget(i, target)}
          onLabelChange={(label) => setField(i, "label", label)}
          onGlyphChange={(glyph) => setField(i, "glyph", glyph)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, 1)}
          onRemove={() => remove(i)}
        />
      ))}
    </div>
  );
}

function CandidateRow({
  index,
  candidate,
  total,
  knownTargets,
  glyphs,
  onTargetChange,
  onLabelChange,
  onGlyphChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  candidate: TargetCandidate;
  total: number;
  knownTargets: KnownTarget[];
  glyphs: Glyph[];
  onTargetChange: (target: string) => void;
  onLabelChange: (label: string) => void;
  onGlyphChange: (glyph: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  // Match the Target section's UX: Select of known targets is the default,
  // with an opt-in "use raw value" escape hatch. Preference is per-row so
  // mixing pick-from-list and raw candidates within one mapping is fine.
  const isKnown = knownTargets.some((t) => t.target === candidate.target);
  const [userPrefersRaw, setUserPrefersRaw] = useState<boolean | null>(null);
  const mustUseRaw =
    knownTargets.length === 0 ||
    (candidate.target !== "" && !isKnown);
  const useRaw = userPrefersRaw ?? mustUseRaw;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-950/5 p-3 dark:border-white/10">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        #{index + 1}
      </span>
      <div className="min-w-40 flex-1">
        {!useRaw && knownTargets.length > 0 ? (
          <Select
            value={candidate.target}
            onChange={(e) => onTargetChange(e.target.value)}
          >
            <option value="">— pick —</option>
            {knownTargets.map((t) => (
              <option key={t.target} value={t.target}>
                {t.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={candidate.target}
            onChange={(e) => onTargetChange(e.target.value)}
            placeholder="service_target"
            className="font-mono"
          />
        )}
        <div className="mt-1 text-xs">
          {knownTargets.length > 0 ? (
            <button
              type="button"
              onClick={() => setUserPrefersRaw(!useRaw)}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {useRaw ? "← pick from list" : "use raw value"}
            </button>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">
              No live targets — enter a raw value.
            </span>
          )}
        </div>
      </div>
      <div className="min-w-32">
        <Input
          value={candidate.label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="label"
        />
      </div>
      <GlyphPicker
        value={candidate.glyph}
        onChange={onGlyphChange}
        glyphs={glyphs}
      />
      <Button
        type="button"
        plain
        onClick={onMoveUp}
        disabled={index === 0}
        title="Move up"
      >
        ↑
      </Button>
      <Button
        type="button"
        plain
        onClick={onMoveDown}
        disabled={index === total - 1}
        title="Move down"
      >
        ↓
      </Button>
      <Button
        type="button"
        plain
        onClick={onRemove}
        className="!text-red-600"
      >
        ✕
      </Button>
    </div>
  );
}
