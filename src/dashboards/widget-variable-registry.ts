import {
  buildWidgetBindingTransformSignature,
} from "@/dashboards/widget-binding-transforms";
import type { DashboardWidgetInstance } from "@/dashboards/types";
import {
  WIDGET_REFERENCE_TITLE_INPUT_ID,
  parseWidgetReferencePropInputPath,
} from "@/dashboards/widget-instance-references";
import type { WidgetInstanceBindings, WidgetPortBinding } from "@/widgets/types";

export type WorkspaceVariableReferenceTargetKind = "title" | "prop" | "widget-input";

export interface WorkspaceVariableReferenceKey {
  sourceWidgetId: string;
  sourceOutputId: string;
  transformSignature: string;
}

export interface WorkspaceVariableReferenceConsumer {
  targetWidgetId: string;
  targetInputId: string;
  targetKind: WorkspaceVariableReferenceTargetKind;
  propPath?: string[];
  binding: WidgetPortBinding;
}

export interface WorkspaceVariableReferenceEntry {
  id: string;
  key: WorkspaceVariableReferenceKey;
  consumers: WorkspaceVariableReferenceConsumer[];
}

export interface WorkspaceVariableReferenceRegistry {
  entries: WorkspaceVariableReferenceEntry[];
  byId: ReadonlyMap<string, WorkspaceVariableReferenceEntry>;
  bySourceWidgetId: ReadonlyMap<string, WorkspaceVariableReferenceEntry[]>;
  byConsumerWidgetId: ReadonlyMap<string, WorkspaceVariableReferenceEntry[]>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeBinding(value: unknown): WidgetPortBinding | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const sourceWidgetId = typeof value.sourceWidgetId === "string"
    ? value.sourceWidgetId.trim()
    : "";
  const sourceOutputId = typeof value.sourceOutputId === "string"
    ? value.sourceOutputId.trim()
    : "";

  if (!sourceWidgetId || !sourceOutputId) {
    return null;
  }

  return value as unknown as WidgetPortBinding;
}

function toBindingArray(value: unknown): WidgetPortBinding[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeBinding(entry))
      .filter((entry): entry is WidgetPortBinding => entry !== null);
  }

  const binding = normalizeBinding(value);
  return binding ? [binding] : [];
}

function resolveTargetKind(inputId: string): Pick<
  WorkspaceVariableReferenceConsumer,
  "targetKind" | "propPath"
> {
  if (inputId === WIDGET_REFERENCE_TITLE_INPUT_ID) {
    return {
      targetKind: "title",
    };
  }

  const propPath = parseWidgetReferencePropInputPath(inputId);

  if (propPath) {
    return {
      targetKind: "prop",
      propPath,
    };
  }

  return {
    targetKind: "widget-input",
  };
}

export function buildWorkspaceVariableReferenceId(key: WorkspaceVariableReferenceKey) {
  return JSON.stringify([
    key.sourceWidgetId,
    key.sourceOutputId,
    key.transformSignature,
  ]);
}

function addToIndex(
  index: Map<string, WorkspaceVariableReferenceEntry[]>,
  key: string,
  entry: WorkspaceVariableReferenceEntry,
) {
  const entries = index.get(key) ?? [];
  entries.push(entry);
  index.set(key, entries);
}

export function buildWorkspaceVariableReferenceRegistry(
  widgets: Array<Pick<DashboardWidgetInstance, "bindings" | "id">>,
): WorkspaceVariableReferenceRegistry {
  const entriesById = new Map<string, WorkspaceVariableReferenceEntry>();

  widgets.forEach((widget) => {
    const bindings = widget.bindings;

    if (!bindings || !isPlainRecord(bindings)) {
      return;
    }

    Object.entries(bindings as WidgetInstanceBindings).forEach(([targetInputId, rawBinding]) => {
      toBindingArray(rawBinding).forEach((binding) => {
        if (binding.sourceWidgetId === widget.id) {
          return;
        }

        const key = {
          sourceWidgetId: binding.sourceWidgetId,
          sourceOutputId: binding.sourceOutputId,
          transformSignature: buildWidgetBindingTransformSignature(binding),
        } satisfies WorkspaceVariableReferenceKey;
        const id = buildWorkspaceVariableReferenceId(key);
        const entry = entriesById.get(id) ?? {
          id,
          key,
          consumers: [],
        } satisfies WorkspaceVariableReferenceEntry;
        const target = resolveTargetKind(targetInputId);

        if (target.targetKind === "widget-input") {
          return;
        }

        entry.consumers.push({
          targetWidgetId: widget.id,
          targetInputId,
          ...target,
          binding,
        });
        entriesById.set(id, entry);
      });
    });
  });

  const entries = [...entriesById.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const bySourceWidgetId = new Map<string, WorkspaceVariableReferenceEntry[]>();
  const byConsumerWidgetId = new Map<string, WorkspaceVariableReferenceEntry[]>();

  entries.forEach((entry) => {
    addToIndex(bySourceWidgetId, entry.key.sourceWidgetId, entry);

    [...new Set(entry.consumers.map((consumer) => consumer.targetWidgetId))].forEach(
      (targetWidgetId) => {
        addToIndex(byConsumerWidgetId, targetWidgetId, entry);
      },
    );
  });

  return {
    entries,
    byId: entriesById,
    bySourceWidgetId,
    byConsumerWidgetId,
  };
}
