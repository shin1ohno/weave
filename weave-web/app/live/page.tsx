import { LiveConsole } from "@/components/LiveConsole";

// Legacy single-column view. The primary UI is now the Connections-first
// 3-pane view at `/`. This route is kept for operators who want the old
// dense stack of edges / zones / lights / events / mappings.
export default function LiveConsolePage() {
  return <LiveConsole />;
}
