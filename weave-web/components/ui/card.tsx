import clsx from "clsx";
import { forwardRef } from "react";

type CardVariant =
  | "default"
  | "firing"
  | "inactive"
  | "cycle_idle"
  | "selected";

const variants: Record<CardVariant, string> = {
  default:
    "border-zinc-950/10 bg-white shadow-sm hover:border-zinc-950/20 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20",
  firing:
    "border-orange-500/60 bg-white ring-2 ring-orange-500/30 shadow-sm firing-ring dark:bg-zinc-900",
  inactive:
    "border-dashed border-zinc-950/10 bg-zinc-50/40 dark:border-white/10 dark:bg-zinc-950/60",
  // cycle_idle: in a DeviceCycle but not the currently active mapping —
  // dim relative to default so it's visually clear which cycle member is
  // routing input right now. Border stays solid (vs the dashed
  // `inactive` style for soft-disabled mappings) since the user didn't
  // disable it; it's just dormant until the next cycle gesture.
  cycle_idle:
    "border-zinc-950/5 bg-zinc-50/70 opacity-60 hover:opacity-80 dark:border-white/5 dark:bg-zinc-950/40",
  selected:
    "border-blue-500 bg-white ring-2 ring-blue-500/30 shadow-sm dark:bg-zinc-900",
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = "default", className, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={clsx(
        "relative rounded-xl border p-4 transition-colors",
        variants[variant],
        className
      )}
      {...rest}
    />
  );
});

export function CardHeader({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx("flex items-start gap-3", className)}
      {...rest}
    />
  );
}

export function CardBody({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("mt-3", className)} {...rest} />;
}

export function CardFooter({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "mt-3 flex items-center gap-2 border-t border-zinc-950/5 pt-3 font-mono text-[11px] text-zinc-500 dark:border-white/5 dark:text-zinc-400",
        className
      )}
      {...rest}
    />
  );
}
