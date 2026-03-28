import type { AppExtension } from "@/app/registry/types";

import { neonMintTheme } from "./theme";
import { orderBookDepthWidget, orderBookWidget } from "./widgets/order-book/definition";

const flowLabExtension: AppExtension = {
  id: "flow-lab",
  title: "Flow Lab",
  description: "Example extension that ships a custom widget and theme for demo surfaces.",
  mockOnly: true,
  widgets: [orderBookWidget, orderBookDepthWidget],
  themes: [neonMintTheme],
};

export default flowLabExtension;
