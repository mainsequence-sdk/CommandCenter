import type { AppExtension } from "@/app/registry/types";
import { neonMintTheme } from "@/extensions/flow-lab/theme";

const flowLabExtension: AppExtension = {
  id: "flow-lab",
  title: "Flow Lab",
  description: "Example extension that ships a custom widget and theme for demo surfaces.",
  themes: [neonMintTheme],
};

export default flowLabExtension;
