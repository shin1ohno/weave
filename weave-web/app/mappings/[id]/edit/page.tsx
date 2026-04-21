"use client";

import { useParams, useRouter } from "next/navigation";
import { MappingEditForm } from "@/components/MappingEditForm";
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
      <MappingEditForm
        mode={{ kind: "edit", mappingId: id }}
        onSaved={() => router.push("/")}
      />
    </div>
  );
}
