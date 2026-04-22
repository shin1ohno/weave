"use client";

import { ConnectionsView } from "@/components/ConnectionsView";
import { MobileHome } from "@/components/mobile/MobileHome";
import { useIsMobile } from "@/hooks/useResponsive";

// Responsive shell: ConnectionsView (3-pane) at ≥768px, MobileHome below.
// During SSR and the first client paint `useIsMobile()` returns null and
// we render ConnectionsView — a one-frame layout shift on mobile is
// acceptable given no server-side width signal is available.
export default function Home() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileHome />;
  return <ConnectionsView />;
}
