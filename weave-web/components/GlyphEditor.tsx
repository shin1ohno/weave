"use client";

import { parseGrid } from "./GlyphPreview";

interface Props {
  pattern: string;
  onChange: (pattern: string) => void;
  disabled?: boolean;
}

function gridToPattern(grid: boolean[][]): string {
  return grid
    .map((row) => row.map((on) => (on ? "*" : " ")).join(""))
    .join("\n");
}

export function GlyphEditor({ pattern, onChange, disabled }: Props) {
  const grid = parseGrid(pattern);

  const toggle = (r: number, c: number) => {
    if (disabled) return;
    const next = grid.map((row) => [...row]);
    next[r][c] = !next[r][c];
    onChange(gridToPattern(next));
  };

  return (
    <div
      className="inline-grid rounded bg-zinc-900 p-1"
      style={{ gridTemplateColumns: "repeat(9, 28px)" }}
    >
      {grid.map((row, r) =>
        row.map((on, c) => (
          <button
            key={`${r}-${c}`}
            type="button"
            onClick={() => toggle(r, c)}
            disabled={disabled}
            className={`h-7 w-7 border border-zinc-800 transition-colors ${
              on ? "bg-zinc-100" : "bg-zinc-700 hover:bg-zinc-600"
            } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            aria-label={`cell ${r},${c}`}
          />
        ))
      )}
    </div>
  );
}
