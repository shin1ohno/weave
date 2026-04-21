"use client";

import { useRouter } from "next/navigation";
import * as Headless from "@headlessui/react";

/**
 * Right-side slide-in drawer rendered as the `@drawer` parallel-route slot.
 *
 * The drawer is always "open" from its own perspective — it only renders when
 * the intercepted URL matched. Closing invokes `router.back()` which pops the
 * drawer URL and renders `@drawer/default.tsx` (returns null) in its place.
 */
export function Drawer({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <Headless.Dialog open={true} onClose={() => router.back()}>
      <Headless.DialogBackdrop
        transition
        className="fixed inset-0 bg-zinc-950/30 transition duration-150 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in dark:bg-zinc-950/60"
      />
      <div className="fixed inset-0 flex justify-end">
        <Headless.DialogPanel
          transition
          className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white p-6 shadow-xl ring-1 ring-zinc-950/10 transition duration-150 will-change-transform data-closed:translate-x-8 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in sm:w-[32rem] dark:bg-zinc-900 dark:ring-white/10"
        >
          {children}
        </Headless.DialogPanel>
      </div>
    </Headless.Dialog>
  );
}
