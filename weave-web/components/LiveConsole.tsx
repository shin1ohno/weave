"use client";

import { EdgesPanel } from "@/components/panels/EdgesPanel";
import { ZonesPanel } from "@/components/panels/ZonesPanel";
import { LightsPanel } from "@/components/panels/LightsPanel";
import { MacPanel } from "@/components/panels/MacPanel";
import { RecentEventsPanel } from "@/components/panels/RecentEventsPanel";
import { MappingsPanel } from "@/components/panels/MappingsPanel";

/**
 * The single Live Console page — replaces the former Overview / Mappings /
 * Edges / Glyphs top-level pages. Panels pull their data from the shared
 * `UIStateProvider` WebSocket snapshot.
 *
 * Panel order is deliberate: state-first (what's happening) above config
 * (what's wired up), so a glance tells the user both "is everything running"
 * and "what do my devices control right now".
 */
export function LiveConsole() {
  return (
    <div className="space-y-8">
      <EdgesPanel />
      <ZonesPanel />
      <LightsPanel />
      <MacPanel />
      <RecentEventsPanel />
      <MappingsPanel />
    </div>
  );
}
