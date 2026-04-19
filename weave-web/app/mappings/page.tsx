"use client";

import Link from "next/link";
import { deleteMapping } from "@/lib/api";
import { useUIState, useUIDispatch } from "@/lib/ws";

export default function MappingsList() {
  const state = useUIState();
  const dispatch = useUIDispatch();

  const sorted = state.mappings.slice().sort((a, b) => {
    const ea = a.edge_id || "";
    const eb = b.edge_id || "";
    return ea === eb
      ? a.device_id.localeCompare(b.device_id)
      : ea.localeCompare(eb);
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this mapping?")) return;
    dispatch({ kind: "local_delete_mapping", id });
    try {
      await deleteMapping(id);
    } catch (e) {
      alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Mappings</h2>
        <Link
          href="/mappings/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New mapping
        </Link>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No mappings configured. Create one to route device inputs to
          services.
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((m) => (
            <div
              key={m.mapping_id}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        m.active ? "bg-green-500" : "bg-zinc-400"
                      }`}
                    />
                    {m.edge_id && (
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {m.edge_id}
                      </span>
                    )}
                    <span className="font-medium">
                      {m.device_type}/{m.device_id}
                    </span>
                    <span className="text-zinc-400">→</span>
                    <span className="font-medium">
                      {m.service_type}/{m.service_target}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">
                    {m.routes.length} route
                    {m.routes.length !== 1 ? "s" : ""}:{" "}
                    {m.routes
                      .map((r) => `${r.input}→${r.intent}`)
                      .join(", ")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3 text-sm">
                  <Link
                    href={`/mappings/${m.mapping_id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(m.mapping_id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
