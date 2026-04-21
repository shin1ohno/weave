"use client";

import { useParams, useRouter } from "next/navigation";
import { Drawer } from "@/components/Drawer";
import { MappingEditForm } from "@/components/MappingEditForm";

export default function EditMappingDrawer() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  return (
    <Drawer>
      <MappingEditForm
        mode={{ kind: "edit", mappingId: id }}
        onSaved={() => router.back()}
        variant="drawer"
      />
    </Drawer>
  );
}
