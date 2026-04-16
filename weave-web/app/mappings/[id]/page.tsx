"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getMapping, updateMapping, switchTarget, type Mapping } from "@/lib/api";

export default function EditMapping() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [newTarget, setNewTarget] = useState("");

  useEffect(() => {
    getMapping(id).then(setMapping).catch(console.error);
  }, [id]);

  if (!mapping) return <div className="p-8 dark:text-white">Loading...</div>;

  const handleSave = async () => {
    await updateMapping(id, mapping);
    router.push("/");
  };

  const handleSwitchTarget = async () => {
    if (!newTarget) return;
    await switchTarget(id, newTarget);
    setMapping({ ...mapping, service_target: newTarget });
    setNewTarget("");
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 dark:text-white">Edit Mapping</h1>

        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border dark:border-zinc-700 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="text-sm text-zinc-500">Device</span>
              <p className="font-medium dark:text-white">{mapping.device_type}/{mapping.device_id}</p>
            </div>
            <div>
              <span className="text-sm text-zinc-500">Service</span>
              <p className="font-medium dark:text-white">{mapping.service_type}/{mapping.service_target}</p>
            </div>
          </div>

          <div className="border-t dark:border-zinc-700 pt-4">
            <h3 className="text-sm font-medium mb-2 dark:text-zinc-300">Switch Target</h3>
            <div className="flex gap-2">
              <input
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="New service target ID..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm dark:bg-zinc-700 dark:border-zinc-600 dark:text-white"
              />
              <button
                onClick={handleSwitchTarget}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                Switch
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border dark:border-zinc-700 mb-6">
          <h3 className="font-medium mb-3 dark:text-white">Routes</h3>
          <div className="space-y-2">
            {mapping.routes.map((route, i) => (
              <div key={i} className="flex gap-2 items-center text-sm dark:text-zinc-300">
                <span className="bg-zinc-100 dark:bg-zinc-700 px-2 py-1 rounded">{route.input}</span>
                <span className="text-zinc-400">→</span>
                <span className="bg-zinc-100 dark:bg-zinc-700 px-2 py-1 rounded">{route.intent}</span>
                {route.params?.damping && route.params.damping !== 1 && (
                  <span className="text-zinc-400">(damping: {route.params.damping})</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <label className="flex items-center gap-2 dark:text-white">
            <input
              type="checkbox"
              checked={mapping.active}
              onChange={(e) => setMapping({ ...mapping, active: e.target.checked })}
            />
            Active
          </label>
          <button onClick={handleSave}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            Save
          </button>
          <button onClick={() => router.push("/")}
            className="border px-6 py-2 rounded-lg hover:bg-zinc-100 dark:border-zinc-600 dark:text-white dark:hover:bg-zinc-800">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
