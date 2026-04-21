"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUIState, useUIDispatch } from "@/lib/ws";
import { putGlyph } from "@/lib/api";
import { GlyphPreview } from "@/components/GlyphPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heading } from "@/components/ui/heading";
import { Badge } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/text";

export default function GlyphsList() {
  const state = useUIState();
  const dispatch = useUIDispatch();
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const sorted = state.glyphs
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

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
      router.push(`/g/${encodeURIComponent(glyph.name)}`);
    } catch (e) {
      alert(`Create failed: ${(e as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading>Glyphs</Heading>
        <TextLink href="/">← Back</TextLink>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <div className="flex-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="new glyph name"
          />
        </div>
        <Button type="submit" disabled={creating} color="blue">
          Create
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {sorted.map((g) => (
          <Link
            key={g.name}
            href={`/g/${encodeURIComponent(g.name)}`}
            className="rounded-lg border border-zinc-950/5 bg-white p-4 shadow-sm hover:border-blue-400 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-blue-500"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-zinc-950 dark:text-white">
                {g.name}
              </span>
              {g.builtin && <Badge color="zinc">builtin</Badge>}
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
