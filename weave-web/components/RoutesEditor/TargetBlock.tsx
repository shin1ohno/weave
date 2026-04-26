"use client";

import { useMemo, useState } from "react";
import type { Mapping } from "@/lib/api";
import { useUIState } from "@/lib/ws";
import { Field, Label } from "@/components/ui/fieldset";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const SERVICE_TYPES = ["roon", "hue", "ios_media"];

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

  const isKnown = knownTargets.some(
    (t) => t.target === mapping.service_target
  );
  // Preference is nullable: null → infer from the live list; once the user
  // explicitly toggles we honor their choice until they toggle again.
  const [userPrefersRaw, setUserPrefersRaw] = useState<boolean | null>(null);
  const mustUseRaw =
    knownTargets.length === 0 ||
    (mapping.service_target !== "" && !isKnown);
  const useRaw = userPrefersRaw ?? mustUseRaw;

  const gridClass =
    layout === "full" ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 grid-cols-1";

  return (
    <div className={gridClass}>
      <Field>
        <Label>Service Type</Label>
        {mode === "new" ? (
          <Select
            value={mapping.service_type}
            onChange={(e) => onUpdate("service_type", e.target.value)}
          >
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
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
        {!useRaw && knownTargets.length > 0 ? (
          <Select
            value={mapping.service_target}
            onChange={(e) => onUpdate("service_target", e.target.value)}
          >
            <option value="">— pick —</option>
            {knownTargets.map((t) => (
              <option key={t.target} value={t.target}>
                {t.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={mapping.service_target}
            onChange={(e) => onUpdate("service_target", e.target.value)}
            className="font-mono"
          />
        )}
        <div className="mt-1 flex items-center gap-2 text-xs">
          {knownTargets.length > 0 && (
            <button
              type="button"
              onClick={() => setUserPrefersRaw(!useRaw)}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {useRaw ? "← pick from list" : "use raw value"}
            </button>
          )}
          {knownTargets.length === 0 && (
            <span className="text-zinc-500 dark:text-zinc-400">
              No live targets — enter a raw value.
            </span>
          )}
        </div>
      </Field>
    </div>
  );
}
