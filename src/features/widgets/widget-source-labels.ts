import { titleCase } from "@/lib/utils";

const widgetSourceLabels: Record<string, string> = {
  main_sequence_workbench: "Main Sequence Foundry",
};

export function formatWidgetSourceLabel(source: string) {
  return widgetSourceLabels[source] ?? titleCase(source.replace(/[_-]+/g, " "));
}
