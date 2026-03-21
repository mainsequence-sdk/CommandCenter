import type { AppExtension } from "@/app/registry/types";
import { neonMintTheme } from "@/extensions/flow-lab/theme";
import { dataNodeTableVisualizerWidget } from "@/widgets/extensions/data-node-table-visualizer/definition";

const flowLabExtension: AppExtension = {
  id: "flow-lab",
  title: "Flow Lab",
  description: "Example extension that ships a custom widget and theme for demo surfaces.",
  widgets: [dataNodeTableVisualizerWidget],
  themes: [neonMintTheme],
};

export default flowLabExtension;
