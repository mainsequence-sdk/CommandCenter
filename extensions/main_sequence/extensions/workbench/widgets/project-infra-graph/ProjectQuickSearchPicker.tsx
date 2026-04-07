import { useDeferredValue, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";

import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import {
  type ProjectQuickSearchRecord,
  formatMainSequenceError,
  quickSearchProjects,
} from "../../../../common/api";

const projectOptionLimit = 50;

function formatProjectLabel(project: Pick<ProjectQuickSearchRecord, "id" | "project_name">) {
  return project.project_name?.trim() || `Project ${project.id}`;
}

export function ProjectQuickSearchPicker({
  value,
  onChange,
  editable,
  queryScope,
  selectedProject,
  placeholder = "Select a project",
  searchPlaceholder = "Search projects",
  selectionHelpText = "Choose the project whose infrastructure graph you want to inspect.",
  showStatus = true,
  detailError,
}: {
  value?: number;
  onChange: (nextId?: number) => void;
  editable: boolean;
  queryScope: string;
  selectedProject?: Pick<ProjectQuickSearchRecord, "id" | "project_name" | "repository_branch"> | null;
  placeholder?: string;
  searchPlaceholder?: string;
  selectionHelpText?: string;
  showStatus?: boolean;
  detailError?: unknown;
}) {
  const [searchValue, setSearchValue] = useState("");
  const deferredSearchValue = useDeferredValue(searchValue);
  const normalizedSearchValue = deferredSearchValue.trim();

  const projectsQuery = useQuery({
    queryKey: ["main_sequence", "widgets", queryScope, "project_quick_search", normalizedSearchValue],
    queryFn: () =>
      quickSearchProjects({
        limit: projectOptionLimit,
        q: normalizedSearchValue,
      }),
    enabled: normalizedSearchValue.length >= 3,
    staleTime: 300_000,
  });

  const projectOptions = useMemo(() => {
    const baseOptions: ProjectQuickSearchRecord[] =
      normalizedSearchValue.length >= 3 ? projectsQuery.data ?? [] : [];

    if (
      selectedProject &&
      !baseOptions.some((project) => project.id === selectedProject.id)
    ) {
      return [selectedProject, ...baseOptions];
    }

    return baseOptions;
  }, [normalizedSearchValue.length, projectsQuery.data, selectedProject]);

  const pickerOptions = useMemo<PickerOption[]>(
    () =>
      projectOptions.map((project) => ({
        value: String(project.id),
        label: formatProjectLabel(project),
        description: project.repository_branch?.trim()
          ? `Branch: ${project.repository_branch.trim()}`
          : undefined,
        keywords: [String(project.id), project.project_name ?? "", project.repository_branch ?? ""],
      })),
    [projectOptions],
  );

  return (
    <div className="space-y-2">
      <PickerField
        value={value && value > 0 ? String(value) : ""}
        onChange={(nextValue) => {
          const nextId = Number(nextValue);
          onChange(Number.isFinite(nextId) && nextId > 0 ? nextId : undefined);
        }}
        options={pickerOptions}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={
          normalizedSearchValue.length >= 3
            ? "No matching projects."
            : normalizedSearchValue.length > 0
              ? "Type at least 3 characters."
              : "Type to search projects."
        }
        searchable
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        disabled={!editable}
        loading={normalizedSearchValue.length >= 3 && projectsQuery.isFetching}
      />

      {showStatus ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{selectionHelpText}</span>
            {normalizedSearchValue.length === 0 ? (
              <span>Type to search.</span>
            ) : normalizedSearchValue.length < 3 ? (
              <span>Use at least 3 characters.</span>
            ) : null}
            {projectsQuery.isError ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-auto px-0 py-0 text-sm text-primary hover:bg-transparent"
                onClick={() => {
                  void projectsQuery.refetch();
                }}
              >
                Retry
              </Button>
            ) : null}
          </div>

          {projectsQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(projectsQuery.error)}
            </div>
          ) : null}

          {detailError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(detailError)}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
