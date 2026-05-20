import type { AnyManagedConnectionConsumerAdapter } from "@/widgets/shared/managed-connection-consumer";
import { graphManagedConnectionConsumerAdapter } from "@/widgets/core/graph/managedConnectionConsumer";
import { statisticManagedConnectionConsumerAdapter } from "@/widgets/core/statistic/managedConnectionConsumer";
import {
  proTableManagedConnectionConsumerAdapter,
  tableManagedConnectionConsumerAdapter,
} from "@/widgets/core/table/managedConnectionConsumer";
import { assetScreenerManagedConnectionConsumerAdapter } from "../../../extensions/main_sequence/extensions/markets/widgets/asset-screener/managedConnectionConsumer";

const MANAGED_CONNECTION_CONSUMER_ADAPTERS = new Map<
  string,
  AnyManagedConnectionConsumerAdapter
>([
  [graphManagedConnectionConsumerAdapter.widgetId, graphManagedConnectionConsumerAdapter],
  [tableManagedConnectionConsumerAdapter.widgetId, tableManagedConnectionConsumerAdapter],
  [proTableManagedConnectionConsumerAdapter.widgetId, proTableManagedConnectionConsumerAdapter],
  [statisticManagedConnectionConsumerAdapter.widgetId, statisticManagedConnectionConsumerAdapter],
  [
    assetScreenerManagedConnectionConsumerAdapter.widgetId,
    assetScreenerManagedConnectionConsumerAdapter,
  ],
]);

export function getManagedConnectionConsumerAdapter(widgetId: string | undefined) {
  return widgetId ? MANAGED_CONNECTION_CONSUMER_ADAPTERS.get(widgetId) ?? null : null;
}
