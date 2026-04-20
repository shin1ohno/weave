"use client";

import { useMemo, useState } from "react";
import { useUIState } from "@/lib/ws";
import { GlyphPreview } from "./GlyphPreview";
import type { FeedbackRule, Glyph } from "@/lib/api";

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
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Feedback</h3>
        <button
          type="button"
          onClick={addRule}
          className="text-sm text-blue-600 hover:underline"
        >
          + Add feedback rule
        </button>
      </div>
      {feedback.length === 0 && (
        <p className="text-sm text-zinc-500">
          No feedback rules. Display a glyph on state change —
          e.g. <code>playback</code>: <code>playing → play</code>,{" "}
          <code>paused → pause</code>.
        </p>
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
      entries.map((e, i): [string, string] =>
        i === idx ? [key, e[1]] : e
      )
    );
  const setEntryGlyph = (idx: number, glyph: string) =>
    commit(
      entries.map((e, i): [string, string] =>
        i === idx ? [e[0], glyph] : e
      )
    );
  const removeEntry = (idx: number) =>
    commit(entries.filter((_, i) => i !== idx));
  const addEntry = () =>
    commit([...entries, ["", glyphNames[0] ?? ""]]);

  const valueSuggestions = rule.state ? suggestValuesFor(rule.state) : [];

  return (
    <div className="space-y-2 rounded border border-zinc-200 p-3 dark:border-zinc-700">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-zinc-500">property</label>
        <input
          value={rule.state}
          onChange={(e) => onChange({ ...rule, state: e.target.value })}
          list={
            knownProperties.length > 0 ? "feedback-props-suggest" : undefined
          }
          placeholder="e.g. playback"
          className="flex-1 min-w-32 rounded border bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {knownProperties.length > 0 && (
          <datalist id="feedback-props-suggest">
            {knownProperties.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        )}
        <label className="text-xs text-zinc-500">type</label>
        <select
          value={rule.feedback_type}
          disabled
          className="rounded border bg-zinc-50 px-2 py-1 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="glyph">glyph</option>
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="text-sm text-red-500 hover:underline"
        >
          ✕ rule
        </button>
      </div>
      <div className="space-y-1 pl-4">
        <p className="text-xs text-zinc-500">
          Values ({rule.state || "property"} → glyph)
        </p>
        {entries.length === 0 && (
          <p className="text-xs text-zinc-400">No value → glyph pairs yet.</p>
        )}
        {entries.map(([value, glyphName], idx) => {
          const glyph = glyphsByName.get(glyphName);
          const selectHasName =
            glyphName === "" || glyphNames.includes(glyphName);
          return (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <input
                value={value}
                onChange={(e) => setEntryKey(idx, e.target.value)}
                list={
                  valueSuggestions.length > 0
                    ? `feedback-vals-${idx}`
                    : undefined
                }
                placeholder="value"
                className="w-36 rounded border bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              {valueSuggestions.length > 0 && (
                <datalist id={`feedback-vals-${idx}`}>
                  {valueSuggestions.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              )}
              <span className="text-zinc-400">→</span>
              <select
                value={glyphName}
                onChange={(e) => setEntryGlyph(idx, e.target.value)}
                className="rounded border bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
              </select>
              {glyph && (
                <GlyphPreview
                  pattern={glyph.pattern}
                  glyph={glyph}
                  size={32}
                />
              )}
              <button
                type="button"
                onClick={() => removeEntry(idx)}
                className="text-sm text-red-500 hover:underline"
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={addEntry}
          className="text-xs text-blue-600 hover:underline"
        >
          + Add value
        </button>
      </div>
    </div>
  );
}
