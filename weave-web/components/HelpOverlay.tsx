"use client";

import { Dialog, DialogBody, DialogTitle } from "@/components/ui/dialog";
import { useCommandUI } from "@/hooks/useCommandUI";

/**
 * Modal keyboard-shortcut reference. Toggled with `?`, dismissed with `?`
 * or `Esc`. Grouped by purpose (Navigation / Actions) so users can scan
 * related shortcuts.
 */
export function HelpOverlay() {
  const { helpOpen, closeHelp } = useCommandUI();

  return (
    <Dialog open={helpOpen} onClose={closeHelp} size="md">
      <DialogTitle>Keyboard shortcuts</DialogTitle>
      <DialogBody>
        <div className="space-y-6">
          <Section heading="Navigation">
            <Row keys={["j", "↓"]} label="Next row" />
            <Row keys={["k", "↑"]} label="Previous row" />
            <Row keys={["/"]} label="Focus search / open palette" />
            <Row keys={["⌘K", "Ctrl+K"]} label="Open command palette" />
            <Row keys={["Esc"]} label="Close palette / help" />
          </Section>
          <Section heading="Actions">
            <Row keys={["Enter"]} label="Default action on selected row" />
            <Row keys={["e"]} label="Edit selected row's mapping" />
            <Row keys={["s"]} label="Switch target for selected row" />
            <Row keys={["n"]} label="New mapping" />
            <Row keys={["?"]} label="Toggle this help" />
          </Section>
        </div>
      </DialogBody>
    </Dialog>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {heading}
      </h3>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-zinc-700 dark:text-zinc-200">{label}</dt>
      <dd className="flex gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 font-mono text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            {k}
          </kbd>
        ))}
      </dd>
    </div>
  );
}
