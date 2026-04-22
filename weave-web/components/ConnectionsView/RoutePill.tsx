import clsx from "clsx";
import { Circle } from "@/components/icon";
import { INPUT_ICON } from "@/components/icon";
import type { Route } from "@/lib/api";

const INPUT_SHORT: Record<string, string> = {
  rotate: "rotate",
  press: "press",
  release: "release",
  long_press: "long press",
  swipe_up: "swipe ↑",
  swipe_down: "swipe ↓",
  swipe_left: "swipe ←",
  swipe_right: "swipe →",
  slide: "slide",
  hover: "hover",
  touch_top: "touch ↑",
  touch_bottom: "touch ↓",
  touch_left: "touch ←",
  touch_right: "touch →",
  key_press: "key",
};

const INTENT_SHORT: Record<string, string> = {
  volume_change: "volume",
  volume_set: "volume=",
  brightness_change: "brightness",
  brightness_set: "brightness=",
  play_pause: "play/pause",
  seek_relative: "seek",
  seek_absolute: "seek=",
  power_toggle: "toggle power",
  power_on: "power on",
  power_off: "power off",
};

export function prettyInput(i: string): string {
  return INPUT_SHORT[i] ?? i;
}

export function prettyIntent(i: string): string {
  return INTENT_SHORT[i] ?? i;
}

export function RoutePill({
  route,
  mini = false,
}: {
  route: Route;
  mini?: boolean;
}) {
  const Icon = INPUT_ICON[route.input] ?? Circle;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md border border-zinc-950/10 bg-zinc-50 py-0.5 dark:border-white/10 dark:bg-zinc-900",
        mini ? "px-1.5 text-[10px]" : "px-2 text-xs"
      )}
    >
      <Icon className={mini ? "h-3 w-3 text-zinc-500" : "h-3.5 w-3.5 text-zinc-500"} />
      <span className="font-medium text-zinc-700 dark:text-zinc-200">
        {prettyInput(route.input)}
      </span>
      <span className="text-zinc-400">→</span>
      <span className="text-zinc-900 dark:text-zinc-100">
        {prettyIntent(route.intent)}
      </span>
    </span>
  );
}
