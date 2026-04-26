"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { listPresets, type Preset } from "@/lib/presets";
import type { Route } from "@/lib/api";

interface Props {
  onApply: (routes: Route[]) => void;
  /** When provided, chips highlight the preset whose routes deep-equal the
   * current mapping's routes. Useful as a subtle "what preset am I on?"
   * indicator. */
  currentRoutes?: Route[];
}

function routesMatch(a: Route[], b: Route[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].input !== b[i].input) return false;
    if (a[i].intent !== b[i].intent) return false;
    const ad = a[i].params?.damping ?? 1;
    const bd = b[i].params?.damping ?? 1;
    if (ad !== bd) return false;
  }
  return true;
}

export function PresetChips({ onApply, currentRoutes }: Props) {
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPresets()
      .then((ps) => {
        if (!cancelled) setPresets(ps);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        Presets unavailable ({error}). You can still add routes manually.
      </div>
    );
  }

  if (!presets) {
    return (
      <div className="flex gap-2" aria-busy>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-7 w-24 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800"
          />
        ))}
      </div>
    );
  }

  const activeId = currentRoutes
    ? presets.find((p) => routesMatch(p.routes, currentRoutes))?.id
    : undefined;

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => {
        const active = p.id === activeId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onApply(p.routes)}
            title={p.description}
            className={clsx(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              active
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                : "border-zinc-950/10 bg-white text-zinc-700 hover:border-zinc-950/20 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-white/5"
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
