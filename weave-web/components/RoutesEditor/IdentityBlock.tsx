"use client";

import { useMemo } from "react";
import type { Mapping } from "@/lib/api";
import { useUIState } from "@/lib/ws";
import { Field, Label } from "@/components/ui/fieldset";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const DEVICE_TYPES = ["nuimo", "hue_tap_dial"];

interface Props {
  mapping: Mapping;
  onUpdate: <K extends keyof Mapping>(key: K, value: Mapping[K]) => void;
  mode: "new" | "edit";
}

export function IdentityBlock({ mapping, onUpdate, mode }: Props) {
  const { edges, deviceStates } = useUIState();

  const knownEdges = useMemo(
    () => edges.map((e) => e.edge_id).sort(),
    [edges]
  );

  const knownDevices = useMemo(
    () =>
      deviceStates
        .filter((d) => d.device_type === mapping.device_type)
        .map((d) => d.device_id)
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort(),
    [deviceStates, mapping.device_type]
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field>
        <Label>Edge ID</Label>
        <Input
          value={mapping.edge_id}
          onChange={(e) => onUpdate("edge_id", e.target.value)}
          list="mapping-edges"
          placeholder="living-room"
        />
        <datalist id="mapping-edges">
          {knownEdges.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </Field>
      <Field>
        <Label>Device Type</Label>
        {mode === "new" ? (
          <Select
            value={mapping.device_type}
            onChange={(e) => onUpdate("device_type", e.target.value)}
          >
            {DEVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            value={mapping.device_type}
            readOnly
            className="font-mono"
            aria-readonly
          />
        )}
      </Field>
      <Field>
        <Label>Device ID</Label>
        <Input
          value={mapping.device_id}
          onChange={(e) => onUpdate("device_id", e.target.value)}
          list="mapping-devices"
          placeholder="C3:81:DF:4E:FF:6A"
        />
        <datalist id="mapping-devices">
          {knownDevices.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </Field>
    </div>
  );
}
