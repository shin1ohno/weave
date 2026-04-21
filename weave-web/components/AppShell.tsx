"use client";

import Link from "next/link";
import { useUIState } from "@/lib/ws";
import { Badge } from "@/components/ui/badge";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { connected } = useUIState();

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
          <div className="ml-auto">
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
