"use client";

import { useEffect, useState } from "react";

/** Mobile breakpoint in px. Below this width the Mobile UI shell renders;
 * at or above, the 3-pane desktop ConnectionsView. */
export const MOBILE_BREAKPOINT = 768;

/** Viewport-width based mobile/desktop test.
 *
 * Returns `null` during SSR and the initial client render (we don't know
 * the width yet), then `true`/`false` after mount. Callers should prefer
 * rendering desktop for the null state — the client flips to mobile after
 * hydration if needed. Fine for the root page; a small one-frame layout
 * shift is acceptable given no authoritative user-agent is available
 * server-side.
 */
export function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mql.matches);
    handler();
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
