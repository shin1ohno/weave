"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createMapping,
  getMapping,
  updateMapping,
  type FeedbackRule,
  type Mapping,
  type Route,
  type TargetCandidate,
} from "@/lib/api";
import { useUIState, useUIDispatch } from "@/lib/ws";
import { FeedbackSection } from "@/components/FeedbackSection";
import { TargetCandidatesSection } from "@/components/TargetCandidatesSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox, CheckboxField } from "@/components/ui/checkbox";
import { Field, Label } from "@/components/ui/fieldset";
import { Heading, Subheading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

export const INPUT_TYPES = [
  "rotate",
  "press",
  "release",
  "long_press",
  "swipe_up",
  "swipe_down",
  "swipe_left",
  "swipe_right",
  "slide",
  "hover",
  "touch_top",
  "touch_bottom",
  "touch_left",
  "touch_right",
  "key_press",
];

export const INTENT_TYPES = [
  "play",
  "pause",
  "play_pause",
  "stop",
  "next",
  "previous",
  "volume_change",
  "volume_set",
  "mute",
  "unmute",
  "seek_relative",
  "seek_absolute",
  "brightness_change",
  "brightness_set",
  "power_toggle",
  "power_on",
  "power_off",
];

const DEFAULT_NEW_ROUTES: Route[] = [
  { input: "rotate", intent: "volume_change", params: { damping: 80 } },
  { input: "press", intent: "play_pause" },
  { input: "swipe_right", intent: "next" },
  { input: "swipe_left", intent: "previous" },
];

type Mode = { kind: "new" } | { kind: "edit"; mappingId: string };

interface Props {
  mode: Mode;
  /** Called after a successful save. The host decides whether to close the
   *  drawer (`router.back()`) or navigate away (`router.push("/")`). */
  onSaved: () => void;
  /** Heading string. Defaults: "New mapping" / "Edit mapping". */
  title?: string;
  /** Optional cancel handler. If provided, renders a Cancel button next to Save. */
  onCancel?: () => void;
}

export function MappingEditForm({ mode, onSaved, title, onCancel }: Props) {
  const state = useUIState();
  const dispatch = useUIDispatch();

  const [mapping, setMapping] = useState<Mapping | null>(() =>
    mode.kind === "new" ? newMappingDraft() : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode: prefer live state, fall back to REST.
  useEffect(() => {
    if (mode.kind !== "edit") return;
    const fromLive = state.mappings.find(
      (m) => m.mapping_id === mode.mappingId
    );
    if (fromLive) {
      setMapping(fromLive);
      return;
    }
    getMapping(mode.mappingId)
      .then(setMapping)
      .catch((e) => setError((e as Error).message));
  }, [mode, state.mappings]);

  const knownTargets = useMemo(() => {
    if (!mapping) return [];
    const metaProperty =
      mapping.service_type === "hue" ? "light" : "zone";
    return state.serviceStates
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
  }, [state.serviceStates, mapping]);

  const knownEdges = useMemo(
    () => state.edges.map((e) => e.edge_id).sort(),
    [state.edges]
  );
  const knownDevices = useMemo(() => {
    if (!mapping) return [];
    return state.deviceStates
      .filter((d) => d.device_type === mapping.device_type)
      .map((d) => d.device_id)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
  }, [state.deviceStates, mapping]);

  if (error && !mapping) return <Text className="text-red-600">{error}</Text>;
  if (!mapping) return <Text>Loading…</Text>;

  const updateField = <K extends keyof Mapping>(key: K, value: Mapping[K]) => {
    setMapping({ ...mapping, [key]: value });
  };

  const updateRoute = (i: number, next: Route) => {
    const routes = [...mapping.routes];
    routes[i] = next;
    setMapping({ ...mapping, routes });
  };
  const removeRoute = (i: number) => {
    setMapping({
      ...mapping,
      routes: mapping.routes.filter((_, idx) => idx !== i),
    });
  };
  const addRoute = () => {
    setMapping({
      ...mapping,
      routes: [...mapping.routes, { input: "press", intent: "play" }],
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode.kind === "edit") {
        dispatch({ kind: "local_upsert_mapping", mapping });
        await updateMapping(mode.mappingId, mapping);
      } else {
        const created = await createMapping({
          edge_id: mapping.edge_id,
          device_type: mapping.device_type,
          device_id: mapping.device_id,
          service_type: mapping.service_type,
          service_target: mapping.service_target,
          routes: mapping.routes,
          feedback: mapping.feedback,
          active: mapping.active,
          target_candidates: mapping.target_candidates,
          target_switch_on: mapping.target_switch_on,
        });
        dispatch({ kind: "local_upsert_mapping", mapping: created });
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Heading>{title ?? (mode.kind === "edit" ? "Edit mapping" : "New mapping")}</Heading>

      {error && (
        <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-zinc-950/5 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <Label>Edge ID</Label>
            <Input
              value={mapping.edge_id}
              onChange={(e) => updateField("edge_id", e.target.value)}
              list="mapping-edges"
              placeholder="living-room"
            />
            <datalist id="mapping-edges">
              {knownEdges.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          </Field>
          <CheckboxField>
            <Checkbox
              checked={mapping.active}
              onChange={(checked) => updateField("active", checked)}
            />
            <Label>Active</Label>
          </CheckboxField>
          <Field>
            <Label>Device Type</Label>
            <Input
              value={mapping.device_type}
              onChange={(e) => updateField("device_type", e.target.value)}
            />
          </Field>
          <Field>
            <Label>Device ID</Label>
            <Input
              value={mapping.device_id}
              onChange={(e) => updateField("device_id", e.target.value)}
              list="mapping-devices"
              placeholder="C3:81:DF:4E:FF:6A"
            />
            <datalist id="mapping-devices">
              {knownDevices.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          </Field>
          <Field>
            <Label>Service Type</Label>
            <Input
              value={mapping.service_type}
              onChange={(e) => updateField("service_type", e.target.value)}
            />
          </Field>
          <div className="space-y-2">
            <Field>
              <Label>Service Target</Label>
              {knownTargets.length > 0 && (
                <Select
                  value={mapping.service_target}
                  onChange={(e) =>
                    updateField("service_target", e.target.value)
                  }
                >
                  <option value="">— pick —</option>
                  {knownTargets.map((t) => (
                    <option key={t.target} value={t.target}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Input
              value={mapping.service_target}
              onChange={(e) => updateField("service_target", e.target.value)}
              className="font-mono"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-950/5 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <Subheading level={3}>Routes</Subheading>
          <Button type="button" plain onClick={addRoute}>
            + Add route
          </Button>
        </div>
        {mapping.routes.map((route, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <div className="min-w-40">
              <Select
                value={route.input}
                onChange={(e) =>
                  updateRoute(i, { ...route, input: e.target.value })
                }
              >
                {INPUT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <span className="text-zinc-400">→</span>
            <div className="min-w-40">
              <Select
                value={route.intent}
                onChange={(e) =>
                  updateRoute(i, { ...route, intent: e.target.value })
                }
              >
                {INTENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-24">
              <Input
                type="number"
                value={route.params?.damping ?? 1}
                onChange={(e) =>
                  updateRoute(i, {
                    ...route,
                    params: { damping: Number(e.target.value) },
                  })
                }
                title="Damping factor"
              />
            </div>
            <Button
              type="button"
              plain
              onClick={() => removeRoute(i)}
              className="!text-red-600"
            >
              ✕
            </Button>
          </div>
        ))}
      </div>

      <TargetCandidatesSection
        candidates={mapping.target_candidates ?? []}
        switchOn={mapping.target_switch_on ?? null}
        onCandidatesChange={(next: TargetCandidate[]) =>
          updateField("target_candidates", next)
        }
        onSwitchOnChange={(next: string | null) =>
          updateField("target_switch_on", next)
        }
        serviceType={mapping.service_type}
        serviceTarget={mapping.service_target}
      />

      <FeedbackSection
        feedback={mapping.feedback}
        onChange={(next: FeedbackRule[]) => updateField("feedback", next)}
        serviceType={mapping.service_type}
        serviceTarget={mapping.service_target}
      />

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} color="blue">
          {saving ? "Saving…" : mode.kind === "edit" ? "Save" : "Create mapping"}
        </Button>
        {onCancel && (
          <Button type="button" outline onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function newMappingDraft(): Mapping {
  return {
    mapping_id: "",
    edge_id: "",
    device_type: "nuimo",
    device_id: "",
    service_type: "roon",
    service_target: "",
    routes: DEFAULT_NEW_ROUTES,
    feedback: [],
    active: true,
    target_candidates: [],
    target_switch_on: null,
  };
}
