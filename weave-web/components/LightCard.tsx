import { ServiceStateEntry } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Subheading } from "@/components/ui/heading";

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
    <div className="rounded-lg border border-zinc-950/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
              on
                ? "bg-amber-400/20 text-amber-700 dark:text-amber-300"
                : "bg-zinc-500/15 text-zinc-500"
            }`}
            aria-hidden
          >
            ◉
          </span>
          <Subheading level={3} className="truncate">
            {name}
          </Subheading>
        </div>
        <Badge color={on ? "amber" : "zinc"}>{on ? "on" : "off"}</Badge>
      </div>
      <p className="mt-1 font-mono text-[10px] text-zinc-400 break-all">
        {target}
      </p>
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
