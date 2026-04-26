"use client";

import { TopBar } from "./TopBar";
import { DevicesPane } from "./DevicesPane";
import { ConnectionsPane } from "./ConnectionsPane";
import { ServicesPane } from "./ServicesPane";
import { useFiringTicker } from "./useFiringTicker";

/** 3-pane Connections-first view. Full-bleed — bypass AppShell's chrome
 * (which is hidden when pathname === "/"). Subscribes to the firing ticker
 * to auto-expire firing rings after their TTL. The "Try it" experience is
 * now inline in the Routes editor's TryFooter, so no separate slide-in
 * drawer is mounted here. */
export function ConnectionsView() {
  useFiringTicker();
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <TopBar />
      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr_320px] gap-6 overflow-hidden bg-zinc-50 p-6 dark:bg-zinc-950">
        <DevicesPane />
        <ConnectionsPane />
        <ServicesPane />
      </div>
    </div>
  );
}
