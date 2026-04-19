"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUIState, useUIDispatch } from "@/lib/ws";
import { putGlyph } from "@/lib/api";
import { GlyphPreview } from "@/components/GlyphPreview";

export default function GlyphsList() {
  const state = useUIState();
  const dispatch = useUIDispatch();
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const sorted = state.glyphs.slice().sort((a, b) => a.name.localeCompare(b.name));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const glyph = {
      name: newName.trim(),
      pattern: "         \n".repeat(8) + "         ",
      builtin: false,
    };
    dispatch({ kind: "local_upsert_glyph", glyph });
    try {
      await putGlyph(glyph);
      router.push(`/glyphs/${encodeURIComponent(glyph.name)}`);
    } catch (e) {
      alert(`Create failed: ${(e as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Glyphs</h2>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="new glyph name"
          className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
        >
          Create
        </button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {sorted.map((g) => (
          <Link
            key={g.name}
            href={`/glyphs/${encodeURIComponent(g.name)}`}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{g.name}</span>
              {g.builtin && (
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  builtin
                </span>
              )}
            </div>
            <div className="mt-3 flex justify-center">
              <GlyphPreview pattern={g.pattern} glyph={g} size={100} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
