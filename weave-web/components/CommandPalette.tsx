"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Command } from "cmdk";
import { useUIState } from "@/lib/ws";
import { useCommandUI } from "@/hooks/useCommandUI";
import { useRowSelection } from "@/hooks/useRowSelection";
import { useSelectedDevice } from "@/lib/ws";
import { useTheme } from "@/hooks/useTheme";
import { summarizeDevices } from "@/lib/devices";
import { summarizeServices, targetLabel } from "@/lib/services";
import type { Mapping } from "@/lib/api";

/**
 * Command palette. Opens on ⌘K / Ctrl+K (KeyboardBindings) and from the
 * TopBar search-styled trigger. Organised into three groups matching the
 * Connections-first mental model:
 *
 *   Jump    — navigate the existing state (edit a connection, select a
 *             device, focus a service target)
 *   Create  — start new work (new connection, pair, new glyph)
 *   System  — palette-accessible UI chrome (theme, stream, glyph gallery,
 *             target switching)
 *
 * cmdk performs fuzzy matching on each item's `value` string — include the
 * words a user would type when searching for each action.
 */
export function CommandPalette() {
  const { paletteOpen, closePalette } = useCommandUI();
  const {
    mappings,
    glyphs,
    edges,
    serviceStates,
    deviceStates,
  } = useUIState();
  const router = useRouter();
  const { setSelectedId } = useRowSelection();
  const [, setSelectedDevice] = useSelectedDevice();
  const { theme, toggle: toggleTheme } = useTheme();

  const devices = useMemo(
    () => summarizeDevices(deviceStates, mappings),
    [deviceStates, mappings]
  );
  const services = useMemo(
    () => summarizeServices(serviceStates, mappings),
    [serviceStates, mappings]
  );

  function mappingLabel(m: Mapping): string {
    const tgt = targetLabel(services, m.service_type, m.service_target);
    const device = devices.find((d) => d.device_id === m.device_id);
    const deviceName = device?.nickname ?? m.device_id.slice(-8);
    return `${deviceName} → ${m.service_type}/${tgt}`;
  }


  function run(action: () => void) {
    closePalette();
    action();
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
      <Command className="flex flex-col overflow-hidden rounded-lg">
        <Command.Input
          autoFocus
          placeholder="Type a command or search…"
          className="w-full border-b border-zinc-200 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-zinc-400 dark:border-zinc-700 dark:placeholder:text-zinc-500"
        />
        <Command.List className="max-h-96 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No matching actions.
          </Command.Empty>

          <Group heading="Jump">
            {mappings.map((m) => (
              <PaletteItem
                key={`edit:${m.mapping_id}`}
                value={`edit connection ${mappingLabel(m)} ${m.mapping_id}`}
                onSelect={() =>
                  run(() => router.push(`/mappings/${m.mapping_id}/edit`))
                }
              >
                Edit connection · {mappingLabel(m)}
              </PaletteItem>
            ))}
            {devices.map((d) => (
              <PaletteItem
                key={`device:${d.device_id}`}
                value={`select device ${d.nickname} ${d.device_id}`}
                onSelect={() => run(() => setSelectedDevice(d.device_id))}
              >
                Select device · {d.nickname}
              </PaletteItem>
            ))}
            {services.flatMap((svc) =>
              svc.targets.map((t) => {
                const rowId =
                  svc.type === "roon"
                    ? `zone:roon:${t.target}`
                    : svc.type === "hue"
                      ? `light:hue:${t.target}`
                      : null;
                return (
                  <PaletteItem
                    key={`goto:${svc.type}:${t.target}`}
                    value={`goto service ${svc.type} ${t.label} ${t.target}`}
                    onSelect={() =>
                      run(() => {
                        if (rowId) {
                          // Navigate to /live where row-selection works on
                          // the row-id registry (MappingsPanel / ZoneRow /
                          // LightRow). On /, keep the UI focused instead.
                          setSelectedId(rowId);
                        }
                      })
                    }
                  >
                    Goto service · {svc.label}/{t.label}
                  </PaletteItem>
                );
              })
            )}
          </Group>

          <Group heading="Create">
            {devices.map((d) => {
              const qs = new URLSearchParams({
                edge_id: d.edge_id,
                device_type: d.device_type,
                device_id: d.device_id,
              });
              return (
                <PaletteItem
                  key={`new-from:${d.device_id}`}
                  value={`new connection from ${d.nickname} ${d.device_id}`}
                  onSelect={() =>
                    run(() => router.push(`/mappings/new?${qs.toString()}`))
                  }
                >
                  New connection from {d.nickname}
                </PaletteItem>
              );
            })}
            <PaletteItem
              value="new connection blank"
              onSelect={() => run(() => router.push("/mappings/new"))}
            >
              New blank connection
            </PaletteItem>
            <PaletteItem
              value="pair new device"
              disabled
              onSelect={() => {}}
            >
              Pair new device (coming soon)
            </PaletteItem>
          </Group>

          <Group heading="System">
            <PaletteItem
              value={`toggle theme ${theme === "dark" ? "light" : "dark"}`}
              onSelect={() => run(toggleTheme)}
            >
              Toggle theme · currently {theme}
            </PaletteItem>
            <PaletteItem
              value="open stream drawer"
              onSelect={() => run(() => router.push("/stream"))}
            >
              Open Stream drawer
            </PaletteItem>
            <PaletteItem
              value="open glyph gallery"
              onSelect={() => run(() => router.push("/g"))}
            >
              Open glyph gallery
            </PaletteItem>
          </Group>

          {edges.length > 0 && (
            <Group heading="Edges">
              {edges.map((e) => (
                <PaletteItem
                  key={`edge:${e.edge_id}`}
                  value={`goto edge ${e.edge_id}`}
                  onSelect={() =>
                    run(() => setSelectedId(`edge:${e.edge_id}`))
                  }
                >
                  Goto edge · {e.edge_id}
                </PaletteItem>
              ))}
            </Group>
          )}

          {glyphs.length > 0 && (
            <Group heading="Glyphs">
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
                  Edit glyph · {g.name}
                </PaletteItem>
              ))}
            </Group>
          )}
        </Command.List>
      </Command>
    </Command.Dialog>
  );
}

function Group({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <Command.Group
      heading={heading}
      className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400"
    >
      {children}
    </Command.Group>
  );
}

function PaletteItem({
  value,
  onSelect,
  disabled,
  children,
}: {
  value: string;
  onSelect: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-zinc-800 outline-none data-[selected=true]:bg-zinc-100 data-[disabled=true]:opacity-60 aria-selected:bg-zinc-100 dark:text-zinc-100 dark:data-[selected=true]:bg-zinc-800 dark:aria-selected:bg-zinc-800"
    >
      {children}
    </Command.Item>
  );
}
