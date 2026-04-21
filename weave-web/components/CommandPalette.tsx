"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Command } from "cmdk";
import { useUIState } from "@/lib/ws";
import { useCommandUI } from "@/hooks/useCommandUI";
import { useRowSelection } from "@/hooks/useRowSelection";
import type { Mapping } from "@/lib/api";

/**
 * Command palette backed by `cmdk`. Opens on ⌘K / Ctrl+K (from
 * KeyboardBindings) and from the AppShell hint button.
 *
 * Actions are generated from live UIState: one entry per mapping (edit),
 * per glyph (edit), per edge (goto/select). Static actions include "Create
 * new mapping" and "Open glyph gallery". cmdk performs fuzzy matching on
 * the `value` string of each CommandItem.
 */
export function CommandPalette() {
  const { paletteOpen, closePalette } = useCommandUI();
  const { mappings, glyphs, edges, serviceStates } = useUIState();
  const router = useRouter();
  const { setSelectedId } = useRowSelection();

  // Map service_type:target → display_name for nicer mapping labels.
  const targetLabels = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of serviceStates) {
      if (s.property !== "zone" && s.property !== "light") continue;
      const label = (s.value as { display_name?: string } | undefined)
        ?.display_name;
      if (label) m.set(`${s.service_type}:${s.target}`, label);
    }
    return m;
  }, [serviceStates]);

  function run(action: () => void) {
    closePalette();
    action();
  }

  function mappingLabel(m: Mapping): string {
    const tgt =
      targetLabels.get(`${m.service_type}:${m.service_target}`) ||
      m.service_target;
    return `${m.device_type} [${m.edge_id || "?"}] → ${m.service_type}/${tgt}`;
  }

  return (
    <Command.Dialog
      open={paletteOpen}
      onOpenChange={(open) => {
        if (!open) closePalette();
      }}
      label="Command palette"
      className="fixed inset-0 z-50"
      overlayClassName="fixed inset-0 bg-zinc-950/30 dark:bg-zinc-950/60"
      contentClassName="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg rounded-lg bg-white shadow-2xl ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10"
    >
      <Command
        // cmdk applies its own fuzzy filter on the `value` string of each item.
        className="flex flex-col overflow-hidden rounded-lg"
      >
        <Command.Input
          autoFocus
          placeholder="Type a command or search…"
          className="w-full border-b border-zinc-200 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-zinc-400 dark:border-zinc-700 dark:placeholder:text-zinc-500"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No matching actions.
          </Command.Empty>

          <Command.Group
            heading="Actions"
            className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400"
          >
            <PaletteItem
              value="new mapping create"
              onSelect={() => run(() => router.push("/mappings/new"))}
            >
              Create new mapping
            </PaletteItem>
            <PaletteItem
              value="glyph gallery open"
              onSelect={() => run(() => router.push("/g"))}
            >
              Open glyph gallery
            </PaletteItem>
          </Command.Group>

          {mappings.length > 0 && (
            <Command.Group
              heading="Mappings"
              className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400"
            >
              {mappings.map((m) => (
                <PaletteItem
                  key={`mapping:${m.mapping_id}`}
                  value={`edit mapping ${mappingLabel(m)} ${m.mapping_id}`}
                  onSelect={() =>
                    run(() => router.push(`/mappings/${m.mapping_id}/edit`))
                  }
                >
                  Edit mapping {mappingLabel(m)}
                </PaletteItem>
              ))}
            </Command.Group>
          )}

          {glyphs.length > 0 && (
            <Command.Group
              heading="Glyphs"
              className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400"
            >
              {glyphs.map((g) => (
                <PaletteItem
                  key={`glyph:${g.name}`}
                  value={`edit glyph ${g.name}`}
                  onSelect={() =>
                    run(() =>
                      router.push(`/g/${encodeURIComponent(g.name)}`)
                    )
                  }
                >
                  Edit glyph {g.name}
                </PaletteItem>
              ))}
            </Command.Group>
          )}

          {edges.length > 0 && (
            <Command.Group
              heading="Edges"
              className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400"
            >
              {edges.map((e) => (
                <PaletteItem
                  key={`edge:${e.edge_id}`}
                  value={`goto edge ${e.edge_id}`}
                  onSelect={() =>
                    run(() => setSelectedId(`edge:${e.edge_id}`))
                  }
                >
                  Goto edge {e.edge_id}
                </PaletteItem>
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </Command.Dialog>
  );
}

function PaletteItem({
  value,
  onSelect,
  children,
}: {
  value: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-zinc-800 outline-none data-[selected=true]:bg-zinc-100 aria-selected:bg-zinc-100 dark:text-zinc-100 dark:data-[selected=true]:bg-zinc-800 dark:aria-selected:bg-zinc-800"
    >
      {children}
    </Command.Item>
  );
}
