"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "@/components/ConnectionsView/TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // The root page renders its own full-bleed chrome (ConnectionsView TopBar).
  // Suppress AppShell's header/main wrappers there so the 3-pane layout can
  // claim the viewport.
  if (pathname === "/") {
    return <>{children}</>;
  }

  // Reuse the same TopBar as the 3-pane home view so chrome stays
  // consistent across `/stream`, `/g`, `/live`, `/mappings/...`. The
  // viewport keeps a max-w-6xl content area; the header itself is
  // full-bleed, matching the home view.
  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </>
  );
}
