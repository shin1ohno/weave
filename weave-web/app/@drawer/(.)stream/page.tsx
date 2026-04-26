"use client";

import { Drawer } from "@/components/Drawer";
import { InputStreamPanel } from "@/components/InputStreamPanel";

export default function StreamDrawer() {
  return (
    <Drawer>
      <div className="-m-6 flex h-full flex-col">
        <InputStreamPanel variant="drawer" title="Live stream" />
      </div>
    </Drawer>
  );
}
