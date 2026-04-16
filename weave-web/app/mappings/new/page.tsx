"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMapping, type Route } from "@/lib/api";

const INPUT_TYPES = [
  "rotate", "press", "release", "long_press",
  "swipe_up", "swipe_down", "swipe_left", "swipe_right",
  "slide", "hover",
  "touch_top", "touch_bottom", "touch_left", "touch_right",
  "key_press",
];

const INTENT_TYPES = [
  "play", "pause", "playpause", "stop", "next", "previous",
  "volume_change", "volume_set", "mute", "unmute",
  "seek_relative", "seek_absolute",
  "brightness_change", "brightness_set",
  "power_toggle", "power_on", "power_off",
];

export default function NewMapping() {
  const router = useRouter();
  const [deviceType, setDeviceType] = useState("nuimo");
  const [deviceId, setDeviceId] = useState("");
  const [serviceType, setServiceType] = useState("roon");
  const [serviceTarget, setServiceTarget] = useState("");
  const [routes, setRoutes] = useState<Route[]>([
    { input: "rotate", intent: "volume_change", params: { damping: 80 } },
    { input: "press", intent: "playpause" },
    { input: "swipe_right", intent: "next" },
    { input: "swipe_left", intent: "previous" },
  ]);

  const addRoute = () => {
    setRoutes([...routes, { input: "press", intent: "play" }]);
  };

  const removeRoute = (i: number) => {
    setRoutes(routes.filter((_, idx) => idx !== i));
  };

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
    await createMapping({
      device_type: deviceType,
      device_id: deviceId,
      service_type: serviceType,
      service_target: serviceTarget,
      routes,
      feedback: [],
      active: true,
    });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 dark:text-white">New Mapping</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Device Type</label>
              <input value={deviceType} onChange={(e) => setDeviceType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Device ID</label>
              <input value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
                placeholder="C3:81:DF:4E:FF:6A"
                className="w-full border rounded-lg px-3 py-2 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Service Type</label>
              <input value={serviceType} onChange={(e) => setServiceType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Service Target (ID)</label>
              <input value={serviceTarget} onChange={(e) => setServiceTarget(e.target.value)}
                placeholder="16017ec9318..."
                className="w-full border rounded-lg px-3 py-2 dark:bg-zinc-800 dark:border-zinc-600 dark:text-white" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-medium dark:text-white">Routes</h2>
              <button type="button" onClick={addRoute}
                className="text-blue-600 text-sm hover:underline">+ Add Route</button>
            </div>
            <div className="space-y-2">
              {routes.map((route, i) => (
                <div key={i} className="flex gap-2 items-center bg-white dark:bg-zinc-800 p-3 rounded-lg border dark:border-zinc-700">
                  <select value={route.input} onChange={(e) => updateRoute(i, "input", e.target.value)}
                    className="border rounded px-2 py-1 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-white">
                    {INPUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="text-zinc-400">→</span>
                  <select value={route.intent} onChange={(e) => updateRoute(i, "intent", e.target.value)}
                    className="border rounded px-2 py-1 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-white">
                    {INTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="number" value={route.params?.damping ?? 1}
                    onChange={(e) => updateRoute(i, "damping", e.target.value)}
                    className="w-20 border rounded px-2 py-1 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
                    title="Damping factor" />
                  <button type="button" onClick={() => removeRoute(i)}
                    className="text-red-500 text-sm">✕</button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              Create Mapping
            </button>
            <button type="button" onClick={() => router.push("/")}
              className="border px-6 py-2 rounded-lg hover:bg-zinc-100 dark:border-zinc-600 dark:text-white dark:hover:bg-zinc-800">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
