"use client";

import { useParams, useRouter } from "next/navigation";
import { RoutesEditor } from "@/components/RoutesEditor";
import { TextLink } from "@/components/ui/text";

export default function EditMappingFullPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <TextLink href="/">← Back</TextLink>
      </div>
      <RoutesEditor
        mode={{ kind: "edit", mappingId: id }}
        onSaved={() => router.push("/")}
      />
    </div>
  );
}
