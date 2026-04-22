"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UiFrame } from "@/lib/api";
import { useWsFrames } from "@/lib/ws";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, X } from "@/components/icon";

export interface StreamEntry {
  seq: number;
  /** ms since epoch — used to render hh:mm:ss.mmm. */
  at: number;
  edge_id: string;
  dev: string;
  input: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}

interface Props {
  /** Optional filter to narrow the stream (e.g. "this device only"). Returns
   * true to include the entry, false to drop. */
  filter?: (e: StreamEntry) => boolean;
  /** Max rows to keep. Older rows drop off the top. */
  maxRows?: number;
  /** Controls the table's visual density / chrome. `drawer` fills the
   * parent; `inline` is sized for embedding inside another panel. */
  variant?: "drawer" | "inline";
  /** Optional title override. */
  title?: string;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
    d.getSeconds()
  )}.${pad(d.getMilliseconds(), 3)}`;
}

function extractInput(frame: UiFrame): StreamEntry | null {
  if (frame.type !== "device_state") return null;
  if (frame.property !== "input") return null;
  let input: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = frame.value as any;
  if (typeof v === "string") input = v;
  else if (v && typeof v === "object") {
    if (typeof v.input === "string") input = v.input;
    else if (typeof v.name === "string") input = v.name;
  }
  if (!input) return null;
  return {
    seq: 0, // overwritten on push
    at: Date.now(),
    edge_id: frame.edge_id,
    dev: `${frame.device_type}/${frame.device_id.slice(-8)}`,
    input,
    value: v,
  };
}

export function InputStreamPanel({
  filter,
  maxRows = 200,
  variant = "inline",
  title = "Input stream",
}: Props) {
  const [paused, setPaused] = useState(false);
  const [entries, setEntries] = useState<StreamEntry[]>([]);
  const seqRef = useRef(0);

  const push = useCallback(
    (e: StreamEntry) => {
      if (filter && !filter(e)) return;
      seqRef.current += 1;
      const next = { ...e, seq: seqRef.current };
      setEntries((prev) => {
        const rows = [...prev, next];
        return rows.length > maxRows ? rows.slice(rows.length - maxRows) : rows;
      });
    },
    [filter, maxRows]
  );

  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useWsFrames((frame) => {
    if (pausedRef.current) return;
    const entry = extractInput(frame);
    if (entry) push(entry);
  });

  const clear = useCallback(() => setEntries([]), []);

  const latest = entries[entries.length - 1]?.seq;

  return (
    <div className={clsx("flex flex-col", variant === "drawer" && "h-full")}>
      <div className="flex items-center gap-2 border-b border-zinc-950/5 px-4 py-3 dark:border-white/10">
        <span
          className="h-2 w-2 animate-pulse rounded-full bg-orange-500"
          aria-hidden
        />
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
          {title}
        </h3>
        <Badge color="zinc">{entries.length}</Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button
            plain
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume stream" : "Pause stream"}
          >
            {paused ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button plain onClick={clear} aria-label="Clear stream">
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>
      <div
        className={clsx(
          "overflow-y-auto font-mono text-[11px]",
          variant === "drawer" ? "flex-1" : "max-h-60"
        )}
      >
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
            {paused
              ? "Stream paused — no new rows will appear."
              : "Waiting for device input…"}
          </p>
        ) : (
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 bg-white/90 backdrop-blur dark:bg-zinc-900/90">
              <tr className="text-left text-zinc-500 dark:text-zinc-400">
                <th className="px-3 py-1 font-normal">time</th>
                <th className="px-3 py-1 font-normal">edge</th>
                <th className="px-3 py-1 font-normal">dev</th>
                <th className="px-3 py-1 font-normal">input</th>
                <th className="px-3 py-1 font-normal">value</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.seq}
                  className={clsx(
                    "text-zinc-700 dark:text-zinc-300",
                    e.seq === latest && "stream-row-new"
                  )}
                >
                  <td className="px-3 py-0.5 text-zinc-500">
                    {formatTime(e.at)}
                  </td>
                  <td className="px-3 py-0.5">{e.edge_id}</td>
                  <td className="px-3 py-0.5">{e.dev}</td>
                  <td className="px-3 py-0.5 text-zinc-900 dark:text-zinc-100">
                    {e.input}
                  </td>
                  <td className="px-3 py-0.5 text-zinc-500">
                    {formatValue(e.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatValue(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return "";
  if (typeof v === "object") {
    const entries = Object.entries(v).filter(([k]) => k !== "input" && k !== "name");
    if (entries.length === 0) return "";
    return entries.map(([k, val]) => `${k}=${JSON.stringify(val)}`).join(" ");
  }
  return String(v);
}

/** Helper for the Try it panel: filter down to a specific mapping's device. */
export function mappingFilter(
  edge_id: string,
  device_type: string,
  device_id: string
): (e: StreamEntry) => boolean {
  return (e) =>
    e.edge_id === edge_id &&
    e.dev === `${device_type}/${device_id.slice(-8)}`;
}
