"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  deleteGlyph,
  getGlyph,
  putGlyph,
  type Glyph,
} from "@/lib/api";
import { useUIState, useUIDispatch } from "@/lib/ws";
import { GlyphEditor } from "@/components/GlyphEditor";
import { GlyphPreview } from "@/components/GlyphPreview";
import { Button } from "@/components/ui/button";
import { Heading, Subheading } from "@/components/ui/heading";
import { Text, TextLink } from "@/components/ui/text";

export default function GlyphEditPage() {
  const router = useRouter();
  const params = useParams();
  const name = decodeURIComponent(params.name as string);
  const state = useUIState();
  const dispatch = useUIDispatch();

  const fromLive = useMemo(
    () => state.glyphs.find((g) => g.name === name) ?? null,
    [state.glyphs, name]
  );
  const [glyph, setGlyph] = useState<Glyph | null>(fromLive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fromLive) {
      setGlyph(fromLive);
      return;
    }
    getGlyph(name).then(setGlyph).catch((e) => setError(e.message));
  }, [name, fromLive]);

  if (error) return <Text className="text-red-600">{error}</Text>;
  if (!glyph) return <Text>Loading…</Text>;

  const save = async () => {
    setSaving(true);
    setError(null);
    dispatch({ kind: "local_upsert_glyph", glyph });
    try {
      await putGlyph(glyph);
      router.push("/glyphs");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!confirm(`Delete glyph "${name}"?`)) return;
    try {
      await deleteGlyph(name);
      router.push("/glyphs");
    } catch (e) {
      alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading>{glyph.name}</Heading>
        <TextLink href="/glyphs">← Back</TextLink>
      </div>

      {error && (
        <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {glyph.builtin && (
        <div className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          This glyph is a built-in parametric renderer (e.g. `volume_bar`). The
          pattern is generated programmatically by the edge-agent and cannot be
          edited here.
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <Subheading level={3}>Editor</Subheading>
          <GlyphEditor
            pattern={glyph.pattern}
            onChange={(pattern) => setGlyph({ ...glyph, pattern })}
            disabled={glyph.builtin}
          />
        </div>
        <div className="space-y-3">
          <Subheading level={3}>Preview</Subheading>
          <GlyphPreview pattern={glyph.pattern} glyph={glyph} size={180} />
          <Subheading level={3}>ASCII</Subheading>
          <pre className="rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
{glyph.pattern}
          </pre>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={save}
          disabled={saving || glyph.builtin}
          color="blue"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
        {!glyph.builtin && (
          <Button onClick={del} outline className="!text-red-600">
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
