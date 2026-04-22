import clsx from "clsx";

export function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={clsx(
        "inline-flex items-center rounded-md border border-zinc-950/10 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300",
        className
      )}
    >
      {children}
    </kbd>
  );
}
