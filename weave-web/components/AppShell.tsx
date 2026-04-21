"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useUIState } from "@/lib/ws";
import { Badge } from "@/components/ui/badge";
import { useCommandUI } from "@/hooks/useCommandUI";

// Render the platform-appropriate modifier glyph only on the client to avoid
// SSR / hydration mismatches (navigator is unavailable on the server). Using
// useSyncExternalStore lets us keep the server snapshot stable (Ctrl) while
// swapping to the client-detected value on hydration without a state-in-effect.
const subscribePlatform = () => () => {};
const getPlatformClient = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? "⌘"
    : "Ctrl";
const getPlatformServer = () => "Ctrl";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { connected } = useUIState();
  const { openPalette } = useCommandUI();
  const modKey = useSyncExternalStore(
    subscribePlatform,
    getPlatformClient,
    getPlatformServer
  );

  return (
    <>
      <header className="border-b border-zinc-950/5 bg-white px-6 dark:border-white/10 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4">
          <Link
            href="/"
            className="text-lg font-semibold text-zinc-950 dark:text-white"
          >
            weave
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={openPalette}
              aria-label="Open command palette"
              title="Open command palette"
              className="flex items-center gap-1.5 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <kbd className="font-mono text-[11px]">{modKey}K</kbd>
            </button>
            <Badge color={connected ? "green" : "zinc"}>
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "bg-green-500" : "bg-zinc-400"
                }`}
              />
              {connected ? "live" : "disconnected"}
            </Badge>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </>
  );
}
