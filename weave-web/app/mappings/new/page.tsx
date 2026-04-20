"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createMapping,
  type FeedbackRule,
  type Route,
  type TargetCandidate,
} from "@/lib/api";
import { useUIState } from "@/lib/ws";
import { FeedbackSection } from "@/components/FeedbackSection";
import { TargetCandidatesSection } from "@/components/TargetCandidatesSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, Label } from "@/components/ui/fieldset";
import { Heading, Subheading } from "@/components/ui/heading";

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
  const [feedback, setFeedback] = useState<FeedbackRule[]>([]);
  const [targetCandidates, setTargetCandidates] = useState<TargetCandidate[]>(
    []
  );
  const [switchOn, setSwitchOn] = useState<string | null>(null);

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
  const knownTargets = useMemo(() => {
    const metaProperty = serviceType === "hue" ? "light" : "zone";
    return state.serviceStates
      .filter(
        (s) => s.service_type === serviceType && s.property === metaProperty
      )
      .map((s) => ({
        target: s.target,
        label:
          (s.value as { display_name?: string } | undefined)?.display_name ??
          s.target,
      }))
      .filter((v, i, a) => a.findIndex((x) => x.target === v.target) === i);
  }, [state.serviceStates, serviceType]);

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
        feedback,
        active: true,
        target_candidates: targetCandidates,
        target_switch_on: switchOn,
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
      <Heading>New mapping</Heading>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <DatalistField
            label="Edge ID"
            value={edgeId}
            onChange={setEdgeId}
            suggestions={knownEdges}
            placeholder="living-room"
          />
          <Field>
            <Label>Device Type</Label>
            <Input value={deviceType} onChange={(e) => setDeviceType(e.target.value)} />
          </Field>
          <DatalistField
            label="Device ID"
            value={deviceId}
            onChange={setDeviceId}
            suggestions={knownDevices}
            placeholder="C3:81:DF:4E:FF:6A"
          />
          <Field>
            <Label>Service Type</Label>
            <Input
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2 space-y-2">
            <Field>
              <Label>Service Target</Label>
              {knownTargets.length > 0 && (
                <Select
                  value={serviceTarget}
                  onChange={(e) => setServiceTarget(e.target.value)}
                >
                  <option value="">— pick a detected zone —</option>
                  {knownTargets.map((t) => (
                    <option key={t.target} value={t.target}>
                      {t.label} ({t.target.slice(0, 10)}…)
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Input
              value={serviceTarget}
              onChange={(e) => setServiceTarget(e.target.value)}
              placeholder="16017ec931848..."
              className="font-mono"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-zinc-950/5 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <Subheading level={3}>Routes</Subheading>
            <Button type="button" plain onClick={addRoute}>
              + Add route
            </Button>
          </div>
          <div className="space-y-2">
            {routes.map((route, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <div className="min-w-40">
                  <Select
                    value={route.input}
                    onChange={(e) =>
                      updateRoute(i, "input", e.target.value)
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
                      updateRoute(i, "intent", e.target.value)
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
                      updateRoute(i, "damping", e.target.value)
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
        </div>

        <TargetCandidatesSection
          candidates={targetCandidates}
          switchOn={switchOn}
          onCandidatesChange={setTargetCandidates}
          onSwitchOnChange={setSwitchOn}
          serviceType={serviceType}
          serviceTarget={serviceTarget}
        />

        <FeedbackSection
          feedback={feedback}
          onChange={setFeedback}
          serviceType={serviceType}
          serviceTarget={serviceTarget}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting} color="blue">
            {submitting ? "Creating…" : "Create mapping"}
          </Button>
          <Button type="button" outline onClick={() => router.push("/mappings")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

function DatalistField({
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
  const listId =
    suggestions && suggestions.length > 0
      ? `${label.replace(/\s/g, "-")}-suggestions`
      : undefined;
  return (
    <Field>
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={listId}
      />
      {listId && suggestions && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </Field>
  );
}
