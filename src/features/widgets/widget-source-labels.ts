import { titleCase } from "@/lib/utils";

const widgetSourceLabels: Record<string, string> = {
  "main-sequence-foundry": "Main Sequence Foundry",
};

export function formatWidgetSourceLabel(source: string) {
  return widgetSourceLabels[source] ?? titleCase(source.replace(/[_-]+/g, " "));
}
