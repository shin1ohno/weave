import { InputStreamPanel } from "@/components/TryItPanel/InputStreamPanel";

// Full-page fallback for direct navigation to /stream (bookmarks, external
// links). On the main Connections view the `@drawer/(.)stream` intercept
// renders this as a right-side drawer instead.
export default function StreamPage() {
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-lg border border-zinc-950/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <InputStreamPanel variant="drawer" title="Live input stream" />
    </div>
  );
}
