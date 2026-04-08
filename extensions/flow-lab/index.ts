import type { AppExtension } from "@/app/registry/types";

import { orderBookDepthWidget, orderBookWidget } from "./widgets/order-book/definition";

const flowLabExtension: AppExtension = {
  id: "flow-lab",
  title: "Flow Lab",
  description: "Example extension that ships custom widgets for demo surfaces.",
  mockOnly: true,
  widgets: [orderBookWidget, orderBookDepthWidget],
};

export default flowLabExtension;
