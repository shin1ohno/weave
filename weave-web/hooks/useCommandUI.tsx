"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Shared open/close state for the command palette and help overlay.
 *
 * Both widgets are mounted once at the root layout; multiple callers
 * (KeyboardBindings, AppShell's ⌘K button, palette actions) need to toggle
 * them. Keeping this state in a dedicated tiny context avoids prop-drilling
 * and keeps the palette render independent from the shell.
 */

interface CommandUIContextValue {
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  helpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
  toggleHelp: () => void;
}

const CommandUIContext = createContext<CommandUIContextValue | null>(null);

export function CommandUIProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const togglePalette = useCallback(() => setPaletteOpen((v) => !v), []);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const toggleHelp = useCallback(() => setHelpOpen((v) => !v), []);

  const value = useMemo<CommandUIContextValue>(
    () => ({
      paletteOpen,
      openPalette,
      closePalette,
      togglePalette,
      helpOpen,
      openHelp,
      closeHelp,
      toggleHelp,
    }),
    [
      paletteOpen,
      openPalette,
      closePalette,
      togglePalette,
      helpOpen,
      openHelp,
      closeHelp,
      toggleHelp,
    ]
  );

  return (
    <CommandUIContext.Provider value={value}>
      {children}
    </CommandUIContext.Provider>
  );
}

export function useCommandUI(): CommandUIContextValue {
  const ctx = useContext(CommandUIContext);
  if (!ctx)
    throw new Error("useCommandUI must be used inside <CommandUIProvider>");
  return ctx;
}
