import { ServiceStateEntry } from "@/lib/api";

interface Props {
  target: string;
  entry: ServiceStateEntry;
}

type LightValue = {
  display_name?: string;
  on?: boolean;
  brightness?: number | null;
};

export function LightCard({ target, entry }: Props) {
  const value = entry.value as LightValue | undefined;
  const name = value?.display_name || target;
  const on = value?.on ?? false;
  const brightness =
    typeof value?.brightness === "number" ? value.brightness : null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
              on
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
            aria-hidden
          >
            ◉
          </span>
          <h3 className="truncate text-lg font-semibold">{name}</h3>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            on
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {on ? "on" : "off"}
        </span>
      </div>
      <p className="mt-1 font-mono text-[10px] text-zinc-400 break-all">{target}</p>
      {brightness !== null && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>brightness</span>
            <span>{Math.round(brightness)}%</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className={`h-2 rounded-full ${
                on ? "bg-amber-400" : "bg-zinc-400"
              }`}
              style={{
                width: `${Math.max(0, Math.min(100, brightness))}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
