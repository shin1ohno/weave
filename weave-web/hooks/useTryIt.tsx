"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { Mapping } from "@/lib/api";

interface TryItContextValue {
  mapping: Mapping | null;
  open: boolean;
  openFor: (mapping: Mapping) => void;
  close: () => void;
}

const TryItContext = createContext<TryItContextValue | null>(null);

export function TryItProvider({ children }: { children: ReactNode }) {
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [open, setOpen] = useState(false);

  const openFor = useCallback((m: Mapping) => {
    setMapping(m);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <TryItContext.Provider value={{ mapping, open, openFor, close }}>
      {children}
    </TryItContext.Provider>
  );
}

export function useTryIt(): TryItContextValue {
  const ctx = useContext(TryItContext);
  if (!ctx) throw new Error("useTryIt must be used inside TryItProvider");
  return ctx;
}
