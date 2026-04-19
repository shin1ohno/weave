import { EdgeInfo } from "@/lib/api";

interface Props {
  edge: EdgeInfo;
}

export function EdgeCard({ edge }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{edge.edge_id}</h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            edge.online
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              edge.online ? "bg-green-500" : "bg-zinc-400"
            }`}
          />
          {edge.online ? "online" : "offline"}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">v{edge.version}</p>
      <p className="mt-1 text-xs text-zinc-500">
        last seen: {new Date(edge.last_seen).toLocaleString()}
      </p>
      <div className="mt-3 flex flex-wrap gap-1">
        {edge.capabilities.map((c) => (
          <span
            key={c}
            className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
