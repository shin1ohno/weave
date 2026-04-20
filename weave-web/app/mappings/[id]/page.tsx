"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
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
import { Text, TextLink } from "@/components/ui/text";

const INPUT_TYPES = [
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

const INTENT_TYPES = [
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

export default function EditMapping() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const state = useUIState();
  const dispatch = useUIDispatch();

  const fromLive = useMemo(
    () => state.mappings.find((m) => m.mapping_id === id) ?? null,
    [state.mappings, id]
  );
  const [mapping, setMapping] = useState<Mapping | null>(fromLive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fromLive) {
      setMapping(fromLive);
      return;
    }
    getMapping(id).then(setMapping).catch((e) => setError(e.message));
  }, [id, fromLive]);

  const knownTargets = useMemo(() => {
    if (!mapping) return [];
    const metaProperty = mapping.service_type === "hue" ? "light" : "zone";
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

  if (error) return <Text className="text-red-600">{error}</Text>;
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
    dispatch({ kind: "local_upsert_mapping", mapping });
    try {
      await updateMapping(id, mapping);
      router.push("/mappings");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Heading>Edit mapping</Heading>
        <TextLink href="/mappings">← Back</TextLink>
      </div>

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
              list="edge-ids"
            />
            <datalist id="edge-ids">
              {state.edges.map((e) => (
                <option key={e.edge_id} value={e.edge_id} />
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
            />
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
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
