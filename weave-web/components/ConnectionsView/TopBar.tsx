"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Search, Sun, Moon, Zap } from "@/components/icon";
import { useUIState, useFiringMappingIds } from "@/lib/ws";
import { useCommandUI } from "@/hooks/useCommandUI";
import { useTheme } from "@/hooks/useTheme";

// Client-only modifier glyph — kept in sync with AppShell.tsx behaviour.
const subscribePlatform = () => () => {};
const getPlatformClient = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? "⌘"
    : "Ctrl";
const getPlatformServer = () => "Ctrl";

export function TopBar() {
  const { connected } = useUIState();
  const firing = useFiringMappingIds();
  const firingCount = useMemo(() => firing.size, [firing]);
  const { openPalette } = useCommandUI();
  const { theme, toggle } = useTheme();
  const modKey = useSyncExternalStore(
    subscribePlatform,
    getPlatformClient,
    getPlatformServer
  );

  return (
    <header className="flex h-14 items-center gap-4 border-b border-zinc-950/5 bg-white px-6 dark:border-white/10 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
          <Zap className="h-3.5 w-3.5" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">
          weave
        </span>
      </div>
      <button
        type="button"
        onClick={openPalette}
        className="relative ml-4 w-72 rounded-lg border border-zinc-950/10 bg-white py-1.5 pl-9 pr-16 text-left text-sm text-zinc-400 hover:border-zinc-950/20 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/5"
        aria-label="Open command palette"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" />
        <span>Search devices, services, mappings…</span>
        <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">
          {modKey}K
        </Kbd>
      </button>
      <div className="ml-auto flex items-center gap-3">
        {firingCount > 0 && (
          <Badge color="orange">
            <span
              className="h-2 w-2 animate-pulse rounded-full bg-orange-500"
              aria-hidden
            />
            {firingCount} firing
          </Badge>
        )}
        <Badge color={connected ? "green" : "zinc"}>
          <span
            className={
              connected
                ? "h-2 w-2 rounded-full bg-green-500"
                : "h-2 w-2 rounded-full bg-zinc-400"
            }
            aria-hidden
          />
          {connected ? "live" : "offline"}
        </Badge>
        <Link
          href="/stream"
          className="rounded-lg border border-zinc-950/10 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-950/20 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
        >
          Stream
        </Link>
        <Button plain onClick={toggle} aria-label="Toggle theme">
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
