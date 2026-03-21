import type { AppExtension } from "@/app/registry/types";
import { neonMintTheme } from "@/extensions/flow-lab/theme";
import { orderBookWidget } from "@/widgets/extensions/order-book/definition";
import { strategyBookWidget } from "@/widgets/extensions/strategy-book/definition";

const flowLabExtension: AppExtension = {
  id: "flow-lab",
  title: "Flow Lab",
  description: "Example extension that ships a custom widget and theme for demo surfaces.",
  widgets: [orderBookWidget, strategyBookWidget],
  themes: [neonMintTheme],
};

export default flowLabExtension;
