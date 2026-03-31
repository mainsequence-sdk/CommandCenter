import { DataNodeTableWidget } from "../../widgets/data-node-table/DataNodeTableWidget";
import { mainSequenceDataNodeTableWidget } from "../../widgets/data-node-table/definition";
import { dataNodeTableVisualizerDefaultProps } from "../../widgets/data-node-table/dataNodeTableModel";

export function MainSequenceDataNodeSnapshotTab({
  dataNodeId,
}: {
  dataNodeId: number;
}) {
  return (
    <div className="min-h-[420px]">
      <DataNodeTableWidget
        widget={mainSequenceDataNodeTableWidget}
        instanceTitle="Data Snapshot"
        props={{
          ...dataNodeTableVisualizerDefaultProps,
          sourceMode: "direct",
          dataNodeId,
          pageSize: 25,
        }}
      />
    </div>
  );
}
