"use client";

import { useRouter } from "next/navigation";
import { Drawer } from "@/components/Drawer";
import { MappingEditForm } from "@/components/MappingEditForm";

export default function NewMappingDrawer() {
  const router = useRouter();
  return (
    <Drawer>
      <MappingEditForm
        mode={{ kind: "new" }}
        onSaved={() => router.back()}
        onCancel={() => router.back()}
      />
    </Drawer>
  );
}
