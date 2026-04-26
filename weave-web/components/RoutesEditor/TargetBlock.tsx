"use client";

import { useMemo } from "react";
import type { Mapping } from "@/lib/api";
import { useUIState } from "@/lib/ws";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Field, Label } from "@/components/ui/fieldset";
import { Input } from "@/components/ui/input";
import { Lightbulb, Play, SERVICE_ICON, Volume2 } from "@/components/icon";

const SERVICE_TYPES = ["roon", "hue", "ios_media"];

const SERVICE_TYPE_OPTIONS: ComboboxOption[] = SERVICE_TYPES.map((t) => ({
  value: t,
  label: t,
  icon:
    SERVICE_ICON[t] ??
    (t === "roon" ? Play : t === "hue" ? Lightbulb : Volume2),
}));

/** The property each service uses as its "one row per target" key.
 * Mirrors `META_PROPERTY_BY_SERVICE` in `lib/services.ts`. */
const META_PROPERTY_BY_SERVICE: Record<string, string> = {
  roon: "zone",
  hue: "light",
  ios_media: "now_playing",
};

interface Props {
  mapping: Mapping;
  onUpdate: <K extends keyof Mapping>(key: K, value: Mapping[K]) => void;
  /** `new` allows changing service_type; `edit` keeps it read-only so
   * routes don't silently become incompatible with a different service. */
  mode: "new" | "edit";
  /** `drawer` and `inline` stack in a single column; `full` uses 2 cols. */
  layout?: "full" | "drawer" | "inline";
}

export function TargetBlock({ mapping, onUpdate, mode, layout = "full" }: Props) {
  const { serviceStates } = useUIState();

  const knownTargets = useMemo(() => {
    const metaProperty =
      META_PROPERTY_BY_SERVICE[mapping.service_type] ?? "zone";
    return serviceStates
      .filter(
        (s) =>
          s.service_type === mapping.service_type &&
          s.property === metaProperty
      )
      .map((s) => ({
        target: s.target,
        label:
          (s.value as { display_name?: string } | undefined)?.display_name ??
          s.target,
      }))
      .filter((v, i, a) => a.findIndex((x) => x.target === v.target) === i);
  }, [serviceStates, mapping.service_type]);

  const targetOptions: ComboboxOption[] = useMemo(
    () =>
      knownTargets.map((t) => ({
        value: t.target,
        label: t.label,
        // Show the raw target id as muted secondary text when it diverges
        // from the display label — useful when a Roon zone display name
        // collides between rooms.
        description: t.target !== t.label ? t.target : undefined,
      })),
    [knownTargets]
  );

  const gridClass =
    layout === "full" ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 grid-cols-1";

  return (
    <div className={gridClass}>
      <Field>
        <Label>Service Type</Label>
        {mode === "new" ? (
          <Combobox
            aria-label="Service Type"
            value={mapping.service_type}
            onChange={(v) => onUpdate("service_type", v)}
            options={SERVICE_TYPE_OPTIONS}
          />
        ) : (
          <Input
            value={mapping.service_type}
            readOnly
            className="font-mono"
            aria-readonly
          />
        )}
      </Field>

      <Field>
        <Label>Service Target</Label>
        <Combobox
          aria-label="Service Target"
          value={mapping.service_target}
          onChange={(v) => onUpdate("service_target", v)}
          options={targetOptions}
          allowCustom
          placeholder="— pick —"
          emptyState={
            knownTargets.length === 0
              ? "No live targets — type a raw value"
              : undefined
          }
        />
      </Field>
    </div>
  );
}
