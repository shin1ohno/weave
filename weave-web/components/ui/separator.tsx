import clsx from "clsx";

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

export function Separator({
  orientation = "horizontal",
  className,
  ...rest
}: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={clsx(
        "bg-zinc-950/10 dark:bg-white/10",
        orientation === "horizontal" ? "h-px w-full" : "h-6 w-px",
        className
      )}
      {...rest}
    />
  );
}
