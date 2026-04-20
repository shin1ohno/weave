import { ServiceStateEntry } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Subheading } from "@/components/ui/heading";

interface Props {
  target: string;
  states: ServiceStateEntry[];
}

type VolumeVal = {
  type?: string;
  min?: number;
  max?: number;
  value?: number;
  is_muted?: boolean;
};

type NowPlayingVal = {
  one_line?: { line1?: string };
  two_line?: { line1?: string; line2?: string };
  length?: number;
};

const PLAYBACK_COLORS: Record<
  string,
  "green" | "yellow" | "zinc" | "blue"
> = {
  playing: "green",
  paused: "yellow",
  stopped: "zinc",
  loading: "blue",
};

export function ZoneCard({ target, states }: Props) {
  const playback = states.find((s) => s.property === "playback");
  const nowPlaying = states.find((s) => s.property === "now_playing");
  const volume = states.find((s) => s.property === "volume");
  const zone = states.find((s) => s.property === "zone");

  const displayName =
    (zone?.value as { display_name?: string } | undefined)?.display_name ??
    target;

  const np = nowPlaying?.value as NowPlayingVal | undefined;
  const vol = volume?.value as VolumeVal | undefined;

  const pbValue =
    typeof playback?.value === "string" ? playback.value : "unknown";
  const pbColor = PLAYBACK_COLORS[pbValue] ?? "zinc";

  return (
    <div className="rounded-lg border border-zinc-950/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <Subheading level={3} className="truncate">
          {displayName}
        </Subheading>
        <Badge color={pbColor}>{pbValue}</Badge>
      </div>
      <p className="mt-1 font-mono text-[10px] text-zinc-400 break-all">
        {target}
      </p>
      {np?.two_line?.line1 && (
        <div className="mt-3">
          <p className="text-sm font-medium truncate text-zinc-950 dark:text-white">
            {np.two_line.line1}
          </p>
          {np.two_line.line2 && (
            <p className="text-xs text-zinc-500 truncate">
              {np.two_line.line2}
            </p>
          )}
        </div>
      )}
      {vol && typeof vol.value === "number" && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>volume</span>
            <span>
              {vol.value}
              {vol.type === "db" ? " dB" : ""}
            </span>
          </div>
          {vol.type === "number" &&
            typeof vol.min === "number" &&
            typeof vol.max === "number" && (
              <div className="mt-1 h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        ((vol.value - vol.min) / (vol.max - vol.min)) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
            )}
        </div>
      )}
    </div>
  );
}
