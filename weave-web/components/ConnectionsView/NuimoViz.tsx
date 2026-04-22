import clsx from "clsx";

type Pattern = "blank" | "vol_mid" | "play" | "pause" | "brightness";

const PATTERN_FN: Record<Pattern, (x: number, y: number) => boolean> = {
  blank: () => false,
  vol_mid: (x, y) =>
    (y >= 3 && y <= 4 && x <= 5) ||
    (y === 2 && x === 4) ||
    (y === 5 && x === 4) ||
    (y === 3 && x === 6),
  play: (x, y) => {
    const cx = 3.2,
      cy = 3.5;
    const dx = x - cx,
      dy = y - cy;
    return dx >= 0 && dx <= 3 && Math.abs(dy) <= dx * 0.9;
  },
  pause: (x, y) => (x === 2 || x === 5) && y >= 1 && y <= 6,
  brightness: (x, y) => {
    if (x >= 3 && x <= 4 && y >= 3 && y <= 4) return true;
    if ((x === 1 || x === 6) && y === 3) return true;
    if ((x === 3 || x === 4) && (y === 1 || y === 6)) return true;
    return false;
  },
};

interface Props {
  pattern?: string;
  size?: number;
  firing?: boolean;
  className?: string;
}

/** 8×8 LED grid mini-visualization. `pattern` accepts a string — unknown
 * names render as blank, which is the right fallback for devices that
 * haven't reported an LED state. When `firing` is true, wraps in the
 * pulse-ring animation defined in globals.css. */
export function NuimoViz({
  pattern = "blank",
  size = 56,
  firing = false,
  className,
}: Props) {
  const dim = 8;
  const fn =
    (PATTERN_FN as Record<string, (x: number, y: number) => boolean>)[
      pattern
    ] ?? PATTERN_FN.blank;
  const cellSize = (size - 10) / dim;
  const cells: boolean[] = [];
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      cells.push(fn(x, y));
    }
  }
  return (
    <div
      className={clsx(
        "relative inline-flex items-center justify-center rounded-2xl bg-zinc-900 p-[5px] shadow-inner",
        firing && "firing-ring",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        className="grid gap-[1px]"
        style={{ gridTemplateColumns: `repeat(${dim}, ${cellSize}px)` }}
      >
        {cells.map((on, i) => (
          <div
            key={i}
            className={clsx(
              "rounded-[1px]",
              on ? "bg-orange-400 shadow-[0_0_2px_rgba(249,115,22,0.8)]" : "bg-zinc-800"
            )}
            style={{ width: cellSize, height: cellSize }}
          />
        ))}
      </div>
    </div>
  );
}
