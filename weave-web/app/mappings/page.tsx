"use client";

import { deleteMapping } from "@/lib/api";
import { useUIState, useUIDispatch } from "@/lib/ws";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text, TextLink } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";

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
        <Heading>Mappings</Heading>
        <Button href="/mappings/new" color="blue">
          New mapping
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Text>
          No mappings configured. Create one to route device inputs to
          services.
        </Text>
      ) : (
        <div className="space-y-3">
          {sorted.map((m) => (
            <div
              key={m.mapping_id}
              className="rounded-lg border border-zinc-950/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={m.active ? "green" : "zinc"}>
                      {m.active ? "active" : "inactive"}
                    </Badge>
                    {m.edge_id && <Badge color="zinc">{m.edge_id}</Badge>}
                    <span className="font-medium text-zinc-950 dark:text-white">
                      {m.device_type}/{m.device_id}
                    </span>
                    <span className="text-zinc-400">→</span>
                    <span className="font-medium text-zinc-950 dark:text-white">
                      {m.service_type}/{m.service_target}
                    </span>
                  </div>
                  <Text className="mt-2">
                    {m.routes.length} route
                    {m.routes.length !== 1 ? "s" : ""}:{" "}
                    {m.routes
                      .map((r) => `${r.input}→${r.intent}`)
                      .join(", ")}
                  </Text>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <TextLink href={`/mappings/${m.mapping_id}`}>Edit</TextLink>
                  <Button
                    plain
                    onClick={() => handleDelete(m.mapping_id)}
                    className="!text-red-600"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
