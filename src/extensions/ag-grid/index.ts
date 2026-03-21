import type { AppExtension } from "@/app/registry/types";
import { positionsTableWidget } from "@/widgets/extensions/ag-grid/definition";

const agGridExtension: AppExtension = {
  id: "ag-grid",
  title: "AG Grid Extension",
  description: "Optional data-grid integration kept outside the core library.",
  widgets: [positionsTableWidget],
};

export default agGridExtension;
