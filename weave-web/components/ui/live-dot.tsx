import clsx from "clsx";

const COLORS = {
  green: "bg-green-500",
  orange: "bg-orange-500",
  zinc: "bg-zinc-400",
  red: "bg-red-500",
  blue: "bg-blue-500",
} as const;

export type LiveDotColor = keyof typeof COLORS;

interface Props {
  color?: LiveDotColor;
  firing?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function LiveDot({
  color = "green",
  firing = false,
  className,
  ...rest
}: Props) {
  const dot = COLORS[color];
  return (
    <span
      className={clsx(
        "relative inline-flex h-2 w-2 flex-shrink-0 rounded-full",
        dot,
        className,
      )}
      aria-hidden={rest["aria-label"] ? undefined : true}
      {...rest}
    >
      {firing && (
        <span
          className={clsx(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
            dot,
          )}
        />
      )}
    </span>
  );
}
