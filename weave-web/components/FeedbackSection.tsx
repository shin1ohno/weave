"use client";

import { useMemo, useState } from "react";
import { useUIState } from "@/lib/ws";
import { GlyphPreview } from "./GlyphPreview";
import type { FeedbackRule, Glyph } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Subheading } from "@/components/ui/heading";
import { Text, Code } from "@/components/ui/text";

// Properties reserved as target-identity meta; filtered out from feedback
// property suggestions because they don't carry state-change values to display.
const META_PROPERTIES = new Set(["zone", "light"]);

interface Props {
  feedback: FeedbackRule[];
  onChange: (next: FeedbackRule[]) => void;
  serviceType: string;
  serviceTarget: string;
}

export function FeedbackSection({
  feedback,
  onChange,
  serviceType,
  serviceTarget,
}: Props) {
  const state = useUIState();

  const knownProperties = useMemo(() => {
    const set = new Set<string>();
    for (const s of state.serviceStates) {
      if (
        s.service_type === serviceType &&
        s.target === serviceTarget &&
        !META_PROPERTIES.has(s.property)
      ) {
        set.add(s.property);
      }
    }
    return Array.from(set).sort();
  }, [state.serviceStates, serviceType, serviceTarget]);

  const glyphNames = useMemo(
    () => state.glyphs.map((g) => g.name).sort(),
    [state.glyphs]
  );
  const glyphsByName = useMemo(() => {
    const m = new Map<string, Glyph>();
    for (const g of state.glyphs) m.set(g.name, g);
    return m;
  }, [state.glyphs]);

  const suggestValuesFor = (property: string): string[] => {
    const values = new Set<string>();
    for (const s of state.serviceStates) {
      if (
        s.service_type !== serviceType ||
        s.target !== serviceTarget ||
        s.property !== property
      )
        continue;
      if (typeof s.value === "string") values.add(s.value);
      else if (typeof s.value === "number" || typeof s.value === "boolean")
        values.add(String(s.value));
    }
    return Array.from(values).sort();
  };

  const updateRule = (i: number, next: FeedbackRule) => {
    const arr = [...feedback];
    arr[i] = next;
    onChange(arr);
  };
  const addRule = () =>
    onChange([
      ...feedback,
      { state: "", feedback_type: "glyph", mapping: {} },
    ]);
  const removeRule = (i: number) =>
    onChange(feedback.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3 rounded-lg border border-zinc-950/5 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <Subheading level={3}>Feedback</Subheading>
        <Button type="button" plain onClick={addRule}>
          + Add feedback rule
        </Button>
      </div>
      {feedback.length === 0 && (
        <Text>
          No feedback rules. Display a glyph on state change —
          e.g. <Code>playback</Code>: <Code>playing → play</Code>,{" "}
          <Code>paused → pause</Code>.
        </Text>
      )}
      {feedback.map((rule, i) => (
        <FeedbackRuleRow
          key={i}
          rule={rule}
          knownProperties={knownProperties}
          glyphNames={glyphNames}
          glyphsByName={glyphsByName}
          suggestValuesFor={suggestValuesFor}
          onChange={(next) => updateRule(i, next)}
          onRemove={() => removeRule(i)}
        />
      ))}
    </div>
  );
}

interface RuleRowProps {
  rule: FeedbackRule;
  knownProperties: string[];
  glyphNames: string[];
  glyphsByName: Map<string, Glyph>;
  suggestValuesFor: (property: string) => string[];
  onChange: (next: FeedbackRule) => void;
  onRemove: () => void;
}

function FeedbackRuleRow({
  rule,
  knownProperties,
  glyphNames,
  glyphsByName,
  suggestValuesFor,
  onChange,
  onRemove,
}: RuleRowProps) {
  // Edit as an ordered list of (stateValue, glyphName) pairs so that
  // transient empty/duplicate keys can coexist; on commit we fold into
  // rule.mapping (Record<string,string>) — duplicates resolve last-wins.
  const [entries, setEntries] = useState<[string, string][]>(() => {
    if (
      rule.mapping &&
      typeof rule.mapping === "object" &&
      !Array.isArray(rule.mapping)
    ) {
      return Object.entries(rule.mapping as Record<string, unknown>).filter(
        ([, v]) => typeof v === "string"
      ) as [string, string][];
    }
    return [];
  });

  const commit = (next: [string, string][]) => {
    setEntries(next);
    const map: Record<string, string> = {};
    for (const [k, v] of next) map[k] = v;
    onChange({ ...rule, mapping: map });
  };

  const setEntryKey = (idx: number, key: string) =>
    commit(
      entries.map((e, i): [string, string] => (i === idx ? [key, e[1]] : e))
    );
  const setEntryGlyph = (idx: number, glyph: string) =>
    commit(
      entries.map((e, i): [string, string] => (i === idx ? [e[0], glyph] : e))
    );
  const removeEntry = (idx: number) =>
    commit(entries.filter((_, i) => i !== idx));
  const addEntry = () =>
    commit([...entries, ["", glyphNames[0] ?? ""]]);

  const valueSuggestions = rule.state ? suggestValuesFor(rule.state) : [];

  return (
    <div className="space-y-2 rounded-lg border border-zinc-950/5 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-zinc-500 dark:text-zinc-400">
          property
        </label>
        <div className="min-w-32 flex-1">
          <Input
            value={rule.state}
            onChange={(e) => onChange({ ...rule, state: e.target.value })}
            list={
              knownProperties.length > 0
                ? "feedback-props-suggest"
                : undefined
            }
            placeholder="e.g. playback"
          />
        </div>
        {knownProperties.length > 0 && (
          <datalist id="feedback-props-suggest">
            {knownProperties.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        )}
        <label className="text-xs text-zinc-500 dark:text-zinc-400">
          type
        </label>
        <div className="w-28">
          <Select value={rule.feedback_type} disabled>
            <option value="glyph">glyph</option>
          </Select>
        </div>
        <Button
          type="button"
          plain
          onClick={onRemove}
          className="!text-red-600"
        >
          ✕ rule
        </Button>
      </div>
      <div className="space-y-2 pl-4">
        <Text className="text-xs">
          Values ({rule.state || "property"} → glyph)
        </Text>
        {entries.length === 0 && (
          <Text className="text-xs">No value → glyph pairs yet.</Text>
        )}
        {entries.map(([value, glyphName], idx) => {
          const glyph = glyphsByName.get(glyphName);
          const selectHasName =
            glyphName === "" || glyphNames.includes(glyphName);
          return (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <Input
                  value={value}
                  onChange={(e) => setEntryKey(idx, e.target.value)}
                  list={
                    valueSuggestions.length > 0
                      ? `feedback-vals-${idx}`
                      : undefined
                  }
                  placeholder="value"
                />
              </div>
              {valueSuggestions.length > 0 && (
                <datalist id={`feedback-vals-${idx}`}>
                  {valueSuggestions.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              )}
              <span className="text-zinc-400">→</span>
              <div className="min-w-40">
                <Select
                  value={glyphName}
                  onChange={(e) => setEntryGlyph(idx, e.target.value)}
                >
                  {!selectHasName && (
                    <option value={glyphName}>{glyphName} (unknown)</option>
                  )}
                  <option value="">— pick glyph —</option>
                  {glyphNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
              {glyph && (
                <GlyphPreview
                  pattern={glyph.pattern}
                  glyph={glyph}
                  size={32}
                />
              )}
              <Button
                type="button"
                plain
                onClick={() => removeEntry(idx)}
                className="!text-red-600"
              >
                ✕
              </Button>
            </div>
          );
        })}
        <Button type="button" plain onClick={addEntry}>
          + Add value
        </Button>
      </div>
    </div>
  );
}
