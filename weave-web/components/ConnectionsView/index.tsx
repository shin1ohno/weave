"use client";

import { TopBar } from "./TopBar";
import { DevicesPane } from "./DevicesPane";
import { ConnectionsPane } from "./ConnectionsPane";
import { ServicesPane } from "./ServicesPane";
import { useFiringTicker } from "./useFiringTicker";
import { TryItPanel } from "@/components/TryItPanel";
import { useTryIt } from "@/hooks/useTryIt";

/** 3-pane Connections-first view. Full-bleed — bypass AppShell's chrome
 * (which is hidden when pathname === "/"). Subscribes to the firing ticker
 * to auto-expire firing rings after their TTL. */
export function ConnectionsView() {
  useFiringTicker();
  const { mapping, open, close } = useTryIt();
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <TopBar />
      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr_320px] gap-6 overflow-hidden bg-zinc-50 p-6 dark:bg-zinc-950">
        <DevicesPane />
        <ConnectionsPane />
        <ServicesPane />
      </div>
      <TryItPanel mapping={mapping} open={open} onClose={close} />
    </div>
  );
}
