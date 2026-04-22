"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RoutesEditor } from "@/components/RoutesEditor";
import { TextLink, Text } from "@/components/ui/text";
import type { Mapping } from "@/lib/api";

function pick(
  sp: URLSearchParams,
  key: keyof Mapping
): string | undefined {
  return sp.get(key) ?? undefined;
}

// useSearchParams requires a Suspense boundary during prerender — wrap.
function NewMappingForm() {
  const router = useRouter();
  const sp = useSearchParams();

  const newDefaults: Partial<Mapping> = {};
  const edge_id = pick(sp, "edge_id");
  const device_type = pick(sp, "device_type");
  const device_id = pick(sp, "device_id");
  const service_type = pick(sp, "service_type");
  const service_target = pick(sp, "service_target");
  if (edge_id !== undefined) newDefaults.edge_id = edge_id;
  if (device_type !== undefined) newDefaults.device_type = device_type;
  if (device_id !== undefined) newDefaults.device_id = device_id;
  if (service_type !== undefined) newDefaults.service_type = service_type;
  if (service_target !== undefined) newDefaults.service_target = service_target;

  return (
    <RoutesEditor
      mode={{ kind: "new" }}
      onSaved={() => router.push("/")}
      onCancel={() => router.push("/")}
      newDefaults={newDefaults}
    />
  );
}

export default function NewMappingFullPage() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <TextLink href="/">← Back</TextLink>
      </div>
      <Suspense fallback={<Text>Loading…</Text>}>
        <NewMappingForm />
      </Suspense>
    </div>
  );
}
