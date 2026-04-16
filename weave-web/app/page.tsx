"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listMappings, deleteMapping, type Mapping } from "@/lib/api";

export default function Dashboard() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    listMappings()
      .then(setMappings)
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this mapping?")) return;
    await deleteMapping(id);
    load();
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold dark:text-white">weave</h1>
          <Link
            href="/mappings/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            New Mapping
          </Link>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
            {error} — Is weave-server running on port 3001?
          </div>
        )}

        {mappings.length === 0 && !error && (
          <p className="text-zinc-500 dark:text-zinc-400">
            No mappings configured. Create one to start routing device events to services.
          </p>
        )}

        <div className="grid gap-4">
          {mappings.map((m) => (
            <div
              key={m.mapping_id}
              className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-sm border border-zinc-200 dark:border-zinc-700"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${m.active ? "bg-green-500" : "bg-zinc-400"}`} />
                    <span className="font-medium dark:text-white">
                      {m.device_type}/{m.device_id}
                    </span>
                    <span className="text-zinc-400">→</span>
                    <span className="font-medium dark:text-white">
                      {m.service_type}/{m.service_target}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400">
                    {m.routes.length} route{m.routes.length !== 1 ? "s" : ""}:{" "}
                    {m.routes.map((r) => `${r.input}→${r.intent}`).join(", ")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/mappings/${m.mapping_id}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(m.mapping_id)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
