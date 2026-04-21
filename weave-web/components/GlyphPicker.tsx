"use client";

import { useMemo, useState } from "react";
import type { Glyph } from "@/lib/api";
import { Select } from "@/components/ui/select";
import { GlyphPreview } from "./GlyphPreview";

type Category = "all" | "letter" | "number" | "other";

interface Props {
  value: string;
  onChange: (next: string) => void;
  glyphs: Glyph[];
  /** Rendered next to the picker; defaults to 32px. */
  previewSize?: number;
  /** Container className passed through for layout tweaks. */
  className?: string;
}

const LETTER_RE = /^[A-Z]$/;
const NUMBER_RE = /^\d{2}$/;

function categorize(name: string): Category {
  if (LETTER_RE.test(name)) return "letter";
  if (NUMBER_RE.test(name)) return "number";
  return "other";
}

/**
 * Two-stage glyph picker: category select → narrowed glyph select → inline
 * GlyphPreview. Backed by the shared `state.glyphs` list so any new glyph
 * the server pushes (including the auto-generated A-Z + 00-99 set) shows
 * up automatically without UI changes.
 */
export function GlyphPicker({
  value,
  onChange,
  glyphs,
  previewSize = 32,
  className = "",
}: Props) {
  // Pick the category that matches the *current* value so opening a
  // mapping with glyph="Q" lands on the Letters tab, etc.
  const initialCategory: Category = value ? categorize(value) : "all";
  const [category, setCategory] = useState<Category>(initialCategory);

  const byName = useMemo(() => {
    const m = new Map<string, Glyph>();
    for (const g of glyphs) m.set(g.name, g);
    return m;
  }, [glyphs]);

  const filtered = useMemo(() => {
    const sorted = glyphs.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (category === "all") return sorted;
    return sorted.filter((g) => categorize(g.name) === category);
  }, [glyphs, category]);

  const selected = value ? byName.get(value) : undefined;
  const selectHasValue = value === "" || filtered.some((g) => g.name === value);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <label className="text-xs text-zinc-500 dark:text-zinc-400">
        glyph
      </label>
      <div className="w-32 shrink-0">
        <Select
          value={category}
          onChange={(e) => {
            const next = e.target.value as Category;
            setCategory(next);
            // If the current value falls outside the new category, clear
            // it so the user can pick freely from the narrowed list
            // instead of seeing a stale "(out of category)" carry-over.
            if (
              next !== "all" &&
              value !== "" &&
              categorize(value) !== next
            ) {
              onChange("");
            }
          }}
          aria-label="Glyph category"
        >
          <option value="all">All</option>
          <option value="letter">Letters</option>
          <option value="number">Numbers</option>
          <option value="other">Other</option>
        </Select>
      </div>
      <div className="min-w-32 flex-1">
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Glyph"
        >
          {!selectHasValue && (
            <option value={value}>{value} (out of category)</option>
          )}
          <option value="">— pick glyph —</option>
          {filtered.map((g) => (
            <option key={g.name} value={g.name}>
              {g.name}
            </option>
          ))}
        </Select>
      </div>
      {selected && (
        <GlyphPreview
          pattern={selected.pattern}
          glyph={selected}
          size={previewSize}
        />
      )}
    </div>
  );
}
