"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createMapping, type Route } from "@/lib/api";
import { useUIState } from "@/lib/ws";

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

export default function NewMapping() {
  const router = useRouter();
  const state = useUIState();
  const [edgeId, setEdgeId] = useState("");
  const [deviceType, setDeviceType] = useState("nuimo");
  const [deviceId, setDeviceId] = useState("");
  const [serviceType, setServiceType] = useState("roon");
  const [serviceTarget, setServiceTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Route[]>([
    { input: "rotate", intent: "volume_change", params: { damping: 80 } },
    { input: "press", intent: "play_pause" },
    { input: "swipe_right", intent: "next" },
    { input: "swipe_left", intent: "previous" },
  ]);

  const knownEdges = useMemo(
    () => state.edges.map((e) => e.edge_id).sort(),
    [state.edges]
  );
  const knownDevices = useMemo(
    () =>
      state.deviceStates
        .filter((d) => d.device_type === deviceType)
        .map((d) => d.device_id)
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort(),
    [state.deviceStates, deviceType]
  );
  const knownTargets = useMemo(
    () =>
      state.serviceStates
        .filter((s) => s.service_type === serviceType && s.property === "zone")
        .map((s) => ({
          target: s.target,
          label:
            (s.value as { display_name?: string } | undefined)?.display_name ??
            s.target,
        }))
        .filter(
          (v, i, a) => a.findIndex((x) => x.target === v.target) === i
        ),
    [state.serviceStates, serviceType]
  );

  const addRoute = () =>
    setRoutes([...routes, { input: "press", intent: "play" }]);
  const removeRoute = (i: number) =>
    setRoutes(routes.filter((_, idx) => idx !== i));
  const updateRoute = (i: number, field: string, value: string | number) => {
    const updated = [...routes];
    if (field === "damping") {
      updated[i] = { ...updated[i], params: { damping: Number(value) } };
    } else {
      updated[i] = { ...updated[i], [field]: value };
    }
    setRoutes(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createMapping({
        edge_id: edgeId,
        device_type: deviceType,
        device_id: deviceId,
        service_type: serviceType,
        service_target: serviceTarget,
        routes,
        feedback: [],
        active: true,
      });
      router.push("/mappings");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">New mapping</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Edge ID"
            value={edgeId}
            onChange={setEdgeId}
            suggestions={knownEdges}
            placeholder="living-room"
          />
          <TextField
            label="Device Type"
            value={deviceType}
            onChange={setDeviceType}
          />
          <TextField
            label="Device ID"
            value={deviceId}
            onChange={setDeviceId}
            suggestions={knownDevices}
            placeholder="C3:81:DF:4E:FF:6A"
          />
          <TextField
            label="Service Type"
            value={serviceType}
            onChange={setServiceType}
          />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Service Target
            </label>
            {knownTargets.length > 0 && (
              <select
                value={serviceTarget}
                onChange={(e) => setServiceTarget(e.target.value)}
                className="mb-2 w-full rounded-lg border bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">— pick a detected zone —</option>
                {knownTargets.map((t) => (
                  <option key={t.target} value={t.target}>
                    {t.label} ({t.target.slice(0, 10)}…)
                  </option>
                ))}
              </select>
            )}
            <input
              value={serviceTarget}
              onChange={(e) => setServiceTarget(e.target.value)}
              placeholder="16017ec931848..."
              className="w-full rounded-lg border bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-medium">Routes</h3>
            <button
              type="button"
              onClick={addRoute}
              className="text-sm text-blue-600 hover:underline"
            >
              + Add route
            </button>
          </div>
          <div className="space-y-2">
            {routes.map((route, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <select
                  value={route.input}
                  onChange={(e) => updateRoute(i, "input", e.target.value)}
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
                  onChange={(e) => updateRoute(i, "intent", e.target.value)}
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
                  onChange={(e) => updateRoute(i, "damping", e.target.value)}
                  className="w-20 rounded border px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  title="Damping factor"
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
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create mapping"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/mappings")}
            className="rounded-lg border px-6 py-2 dark:border-zinc-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const listId = suggestions && suggestions.length > 0
    ? `${label.replace(/\s/g, "-")}-suggestions`
    : undefined;
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
        className="w-full rounded-lg border bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {listId && suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
