"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  getMapping,
  updateMapping,
  type Mapping,
  type Route,
} from "@/lib/api";
import { useUIState, useUIDispatch } from "@/lib/ws";

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
          s.service_type === mapping.service_type && s.property === metaProperty
      )
      .map((s) => ({
        target: s.target,
        label:
          (s.value as { display_name?: string } | undefined)?.display_name ??
          s.target,
      }))
      .filter((v, i, a) => a.findIndex((x) => x.target === v.target) === i);
  }, [state.serviceStates, mapping]);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!mapping) return <div>Loading…</div>;

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
        <h2 className="text-2xl font-bold">Edit mapping</h2>
        <button
          onClick={() => router.push("/mappings")}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Back
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Edge ID">
            <input
              value={mapping.edge_id}
              onChange={(e) => updateField("edge_id", e.target.value)}
              list="edge-ids"
              className="w-full rounded border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <datalist id="edge-ids">
              {state.edges.map((e) => (
                <option key={e.edge_id} value={e.edge_id} />
              ))}
            </datalist>
          </Field>
          <Field label="Active">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mapping.active}
                onChange={(e) => updateField("active", e.target.checked)}
              />
              {mapping.active ? "active" : "inactive"}
            </label>
          </Field>
          <Field label="Device Type">
            <input
              value={mapping.device_type}
              onChange={(e) => updateField("device_type", e.target.value)}
              className="w-full rounded border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </Field>
          <Field label="Device ID">
            <input
              value={mapping.device_id}
              onChange={(e) => updateField("device_id", e.target.value)}
              className="w-full rounded border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </Field>
          <Field label="Service Type">
            <input
              value={mapping.service_type}
              onChange={(e) => updateField("service_type", e.target.value)}
              className="w-full rounded border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </Field>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Service Target
            </label>
            {knownTargets.length > 0 && (
              <select
                value={mapping.service_target}
                onChange={(e) =>
                  updateField("service_target", e.target.value)
                }
                className="mb-2 w-full rounded border bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">— pick —</option>
                {knownTargets.map((t) => (
                  <option key={t.target} value={t.target}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
            <input
              value={mapping.service_target}
              onChange={(e) => updateField("service_target", e.target.value)}
              className="w-full rounded border bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Routes</h3>
          <button
            type="button"
            onClick={addRoute}
            className="text-sm text-blue-600 hover:underline"
          >
            + Add route
          </button>
        </div>
        {mapping.routes.map((route, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={route.input}
              onChange={(e) =>
                updateRoute(i, { ...route, input: e.target.value })
              }
              className="rounded border px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {INPUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="text-zinc-400">→</span>
            <select
              value={route.intent}
              onChange={(e) =>
                updateRoute(i, { ...route, intent: e.target.value })
              }
              className="rounded border px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {INTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={route.params?.damping ?? 1}
              onChange={(e) =>
                updateRoute(i, {
                  ...route,
                  params: { damping: Number(e.target.value) },
                })
              }
              className="w-20 rounded border px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="button"
              onClick={() => removeRoute(i)}
              className="text-sm text-red-500 hover:underline"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
