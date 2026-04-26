"use client";

import { useUIState } from "@/lib/ws";
import { useKnownTargets } from "@/hooks/useKnownTargets";
import { GlyphPicker } from "./GlyphPicker";
import type { Glyph, Route, TargetCandidate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Subheading } from "@/components/ui/heading";
import { Text, Code } from "@/components/ui/text";
import { INPUT_ICON, Lightbulb, Play, SERVICE_ICON, Volume2 } from "@/components/icon";
import { INPUT_TYPES, INTENT_TYPES } from "./RoutesEditor/vocab";

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

// Same canonical list as MappingEditForm's SERVICE_TYPES. Duplicated
// intentionally to avoid pulling non-Type imports across the component
// boundary; update both when adding a service.
const SERVICE_TYPES = ["roon", "hue"];

const SWITCH_INPUT_OPTIONS: ComboboxOption[] = SWITCH_INPUTS.map((t) => ({
  value: t,
  label: t,
  icon: INPUT_ICON[t],
}));

const INPUT_OPTIONS: ComboboxOption[] = INPUT_TYPES.map((t) => ({
  value: t,
  label: t,
  icon: INPUT_ICON[t],
}));

function serviceIconFor(type: string) {
  return (
    SERVICE_ICON[type] ??
    (type === "roon" ? Play : type === "hue" ? Lightbulb : Volume2)
  );
}

interface Props {
  candidates: TargetCandidate[];
  switchOn: string | null;
  onCandidatesChange: (next: TargetCandidate[]) => void;
  onSwitchOnChange: (next: string | null) => void;
  /** The parent mapping's service_type. Candidates without an override
   *  inherit this; candidates with an override can target a different
   *  service entirely (cross-service switching). */
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

  const setField = (
    i: number,
    field: keyof TargetCandidate,
    value: TargetCandidate[keyof TargetCandidate]
  ) => {
    const next = [...candidates];
    next[i] = { ...next[i], [field]: value };
    onCandidatesChange(next);
  };
  const remove = (i: number) =>
    onCandidatesChange(candidates.filter((_, idx) => idx !== i));
  const add = () => {
    // Default the first candidate to the current service_target so the
    // user can quickly include the already-active target in the rotation.
    const target = candidates.length === 0 ? serviceTarget : "";
    onCandidatesChange([...candidates, { target, label: "", glyph: "" }]);
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
            <Combobox
              aria-label="Switch trigger input"
              value={switchOn ?? ""}
              onChange={(v) => onSwitchOnChange(v === "" ? null : v)}
              options={[
                { value: "", label: "— disabled —" },
                ...SWITCH_INPUT_OPTIONS,
              ]}
            />
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
          rotate to browse, press to confirm. Candidates can point to a
          different service than the mapping default (Roon zone ↔ Hue light)
          by picking a Service Type override.
        </Text>
      )}
      {candidates.map((c, i) => (
        <CandidateRow
          key={i}
          index={i}
          candidate={c}
          total={candidates.length}
          mappingServiceType={serviceType}
          glyphs={state.glyphs}
          onCandidateChange={(next) => {
            const all = [...candidates];
            all[i] = next;
            onCandidatesChange(all);
          }}
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
  mappingServiceType,
  glyphs,
  onCandidateChange,
  onLabelChange,
  onGlyphChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  index: number;
  candidate: TargetCandidate;
  total: number;
  mappingServiceType: string;
  glyphs: Glyph[];
  onCandidateChange: (next: TargetCandidate) => void;
  onLabelChange: (label: string) => void;
  onGlyphChange: (glyph: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  // Effective service for this candidate — override wins, else inherit
  // from the mapping.
  const effectiveServiceType = candidate.service_type ?? mappingServiceType;
  const isOverridden = candidate.service_type !== undefined;
  const knownTargets = useKnownTargets(effectiveServiceType);

  const targetOptions: ComboboxOption[] = knownTargets.map((t) => ({
    value: t.target,
    label: t.label,
    description: t.target !== t.label ? t.target : undefined,
  }));

  const setTarget = (target: string) => {
    const inferred =
      knownTargets.find((t) => t.target === target)?.label ?? "";
    const oldInferred =
      knownTargets.find((t) => t.target === candidate.target)?.label ?? "";
    const label =
      candidate.label && candidate.label !== oldInferred
        ? candidate.label
        : inferred;
    onCandidateChange({ ...candidate, target, label });
  };

  const setServiceTypeOverride = (value: string) => {
    // "inherit" means drop the override; changing the service resets the
    // target (a Roon zone id is never a Hue light id). Routes are also
    // cleared so the user picks a fresh set — the former routes are
    // meaningless against a different service.
    if (value === "") {
      onCandidateChange({
        ...candidate,
        service_type: undefined,
        target: "",
        label: "",
        routes: undefined,
      });
    } else {
      onCandidateChange({
        ...candidate,
        service_type: value,
        target: "",
        label: "",
        // Seed with empty list so the routes editor appears immediately.
        routes: candidate.routes ?? [],
      });
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-zinc-950/5 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          #{index + 1}
        </span>
        <div className="min-w-32">
          <Combobox
            aria-label="Service type override"
            value={candidate.service_type ?? ""}
            onChange={(v) => setServiceTypeOverride(v)}
            options={[
              { value: "", label: `inherit (${mappingServiceType})` },
              ...SERVICE_TYPES.filter((s) => s !== mappingServiceType).map(
                (s): ComboboxOption => ({
                  value: s,
                  label: s,
                  icon: serviceIconFor(s),
                })
              ),
              {
                value: mappingServiceType,
                label: mappingServiceType,
                icon: serviceIconFor(mappingServiceType),
                description: "explicit",
              },
            ]}
          />
        </div>
        <div className="min-w-40 flex-1">
          <Combobox
            aria-label="Service target"
            value={candidate.target}
            onChange={(v) => setTarget(v)}
            options={targetOptions}
            allowCustom
            placeholder="— pick —"
            emptyState={
              knownTargets.length === 0 ? (
                <>
                  No live targets for{" "}
                  <Code>{effectiveServiceType}</Code> — type a raw value
                </>
              ) : undefined
            }
          />
        </div>
        {/* Label override — only meaningful when the target value isn't in
            the live list (otherwise the option's label is the display name). */}
        {!targetOptions.some((o) => o.value === candidate.target) && (
          <div className="min-w-32">
            <Input
              value={candidate.label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="label"
            />
          </div>
        )}
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
      {isOverridden && (
        <CandidateRoutesEditor
          routes={candidate.routes ?? []}
          onChange={(routes) => onCandidateChange({ ...candidate, routes })}
          serviceTypeLabel={effectiveServiceType}
        />
      )}
    </div>
  );
}

/** Routes editor scoped to a single candidate. Reuses the Input / Intent /
 *  damping triplet from MappingEditForm's RouteRow but inlined — keeping
 *  this file independent of internal MappingEditForm helpers. */
function CandidateRoutesEditor({
  routes,
  onChange,
  serviceTypeLabel,
}: {
  routes: Route[];
  onChange: (next: Route[]) => void;
  serviceTypeLabel: string;
}) {
  const update = (i: number, next: Route) => {
    const out = [...routes];
    out[i] = next;
    onChange(out);
  };
  const add = () =>
    onChange([...routes, { input: "press", intent: "power_toggle" }]);
  const remove = (i: number) => onChange(routes.filter((_, k) => k !== i));

  return (
    <div className="ml-6 space-y-2 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-2">
        <Text className="text-xs">
          Routes for <Code>{serviceTypeLabel}</Code> — replaces the mapping&apos;s
          default routes while this candidate is active.
        </Text>
        <Button type="button" plain onClick={add} className="text-xs">
          + Add route
        </Button>
      </div>
      {routes.length === 0 && (
        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
          No routes yet — add at least one so the device has something to do
          when this candidate is selected.
        </Text>
      )}
      {routes.map((r, i) => {
        const isRotate = r.input === "rotate";
        const damping =
          typeof r.params?.damping === "number" ? r.params.damping : 1;
        const intentOptions: ComboboxOption[] = INTENT_TYPES.map((t) => ({
          value: t,
          label: t,
        }));
        if (!INTENT_TYPES.includes(r.intent)) {
          intentOptions.push({ value: r.intent, label: r.intent });
        }
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <div className="min-w-36">
              <Combobox
                aria-label="Input"
                value={r.input}
                onChange={(v) => update(i, { ...r, input: v })}
                options={INPUT_OPTIONS}
                allowCustom
              />
            </div>
            <span className="text-zinc-400">→</span>
            <div className="min-w-40">
              <Combobox
                aria-label="Intent"
                value={r.intent}
                onChange={(v) => update(i, { ...r, intent: v })}
                options={intentOptions}
                allowCustom
              />
            </div>
            <div className="w-20">
              <Input
                type="number"
                value={damping}
                disabled={!isRotate}
                onChange={(e) =>
                  update(i, {
                    ...r,
                    params: { damping: Number(e.target.value) },
                  })
                }
                title={
                  isRotate ? "Damping factor" : "Damping applies only to `rotate`"
                }
                aria-label="Damping"
                className={!isRotate ? "opacity-60" : undefined}
              />
            </div>
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
