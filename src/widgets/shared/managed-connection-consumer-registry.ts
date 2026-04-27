import type { AnyManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer";
import { graphManagedConnectionConsumerAdapter } from "@/widgets/core/graph/managedConnectionConsumer";
import { statisticManagedConnectionConsumerAdapter } from "@/widgets/core/statistic/managedConnectionConsumer";
import { tableManagedConnectionConsumerAdapter } from "@/widgets/core/table/managedConnectionConsumer";

const MANAGED_CONNECTION_CONSUMER_ADAPTERS = new Map<
  string,
  AnyManagedConnectionConsumerAdapter
>([
  [graphManagedConnectionConsumerAdapter.widgetId, graphManagedConnectionConsumerAdapter],
  [tableManagedConnectionConsumerAdapter.widgetId, tableManagedConnectionConsumerAdapter],
  [statisticManagedConnectionConsumerAdapter.widgetId, statisticManagedConnectionConsumerAdapter],
]);

export function getManagedConnectionConsumerAdapter(widgetId: string | undefined) {
  return widgetId ? MANAGED_CONNECTION_CONSUMER_ADAPTERS.get(widgetId) ?? null : null;
}
