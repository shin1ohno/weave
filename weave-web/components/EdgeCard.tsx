import { EdgeInfo } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Subheading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

interface Props {
  edge: EdgeInfo;
}

export function EdgeCard({ edge }: Props) {
  return (
    <div className="rounded-lg border border-zinc-950/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <Subheading level={3}>{edge.edge_id}</Subheading>
        <Badge color={edge.online ? "green" : "zinc"}>
          {edge.online ? "online" : "offline"}
        </Badge>
      </div>
      <Text className="mt-1 text-xs">v{edge.version}</Text>
      <Text className="text-xs">
        last seen: {new Date(edge.last_seen).toLocaleString()}
      </Text>
      <div className="mt-3 flex flex-wrap gap-1">
        {edge.capabilities.map((c) => (
          <Badge key={c} color="blue">
            {c}
          </Badge>
        ))}
      </div>
    </div>
  );
}
