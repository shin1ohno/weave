import { Glyph } from "@/lib/api";

export function parseGrid(pattern: string): boolean[][] {
  const rows = pattern.split("\n");
  return Array.from({ length: 9 }, (_, r) => {
    const row = rows[r] ?? "";
    return Array.from({ length: 9 }, (_, c) => row[c] === "*");
  });
}

interface Props {
  pattern: string;
  size?: number;
  glyph?: Glyph;
  className?: string;
}

export function GlyphPreview({ pattern, size = 72, glyph, className = "" }: Props) {
  const grid = parseGrid(pattern);
  const cell = size / 9;

  if (glyph?.builtin) {
    return (
      <div
        className={`flex items-center justify-center rounded border border-dashed border-zinc-400 bg-zinc-100 text-xs text-zinc-600 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-300 ${className}`}
        style={{ width: size, height: size }}
        title="builtin parametric glyph"
      >
        builtin
      </div>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`rounded bg-zinc-900 ${className}`}
      aria-label="glyph preview"
    >
      {grid.flatMap((row, r) =>
        row.map((on, c) => (
          <rect
            key={`${r}-${c}`}
            x={c * cell}
            y={r * cell}
            width={cell - 1}
            height={cell - 1}
            fill={on ? "#f5f5f5" : "transparent"}
          />
        ))
      )}
    </svg>
  );
}
