"use client";

import { useMemo, useState } from "react";
import { useUIState } from "@/lib/ws";
import { useSuggestValues } from "@/hooks/useSuggestValues";
import { GlyphPicker } from "./GlyphPicker";
import type { FeedbackRule, Glyph } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
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
          serviceType={serviceType}
          serviceTarget={serviceTarget}
          knownProperties={knownProperties}
          glyphsFull={state.glyphs}
          onChange={(next) => updateRule(i, next)}
          onRemove={() => removeRule(i)}
        />
      ))}
    </div>
  );
}

interface RuleRowProps {
  rule: FeedbackRule;
  serviceType: string;
  serviceTarget: string;
  knownProperties: string[];
  glyphsFull: Glyph[];
  onChange: (next: FeedbackRule) => void;
  onRemove: () => void;
}

function FeedbackRuleRow({
  rule,
  serviceType,
  serviceTarget,
  knownProperties,
  glyphsFull,
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
    commit([...entries, ["", ""]]);

  const valueSuggestions = useSuggestValues(
    serviceType,
    serviceTarget,
    rule.state
  );

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
          <Combobox
            aria-label="Feedback type"
            value={rule.feedback_type}
            onChange={(v) => onChange({ ...rule, feedback_type: v })}
            options={[{ value: "glyph", label: "glyph" }]}
            disabled
          />
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
              <GlyphPicker
                value={glyphName}
                onChange={(v) => setEntryGlyph(idx, v)}
                glyphs={glyphsFull}
              />
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
