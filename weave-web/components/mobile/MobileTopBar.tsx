"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Moon, Search, Sun, Zap } from "@/components/icon";
import { useTheme } from "@/hooks/useTheme";
import { useCommandUI } from "@/hooks/useCommandUI";

interface Props {
  firingCount: number;
}

/** Mobile-portrait TopBar. 44px high. Ships only the essentials:
 * logo + firing-count badge + theme toggle + search. The "search" button
 * opens the existing command palette — the on-screen keyboard prevents
 * `⌘K` from working, so this is the mobile affordance. */
export function MobileTopBar({ firingCount }: Props) {
  const { theme, toggle } = useTheme();
  const { openPalette } = useCommandUI();
  return (
    <header className="flex h-11 items-center gap-2 border-b border-zinc-950/5 bg-white px-4 dark:border-white/10 dark:bg-zinc-950">
      <div className="flex items-center gap-1.5">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
          <Zap className="h-3 w-3" />
        </div>
        <span className="text-base font-semibold tracking-tight text-zinc-950 dark:text-white">
          weave
        </span>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {firingCount > 0 && (
          <Badge color="orange">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500"
              aria-hidden
            />
            {firingCount}
          </Badge>
        )}
        <Button plain onClick={toggle} aria-label="Toggle theme">
          {theme === "dark" ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button plain onClick={openPalette} aria-label="Search">
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
