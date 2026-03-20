import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, Plus } from "lucide-react";

import {
  FileExplorer,
  type FileExplorerItem,
} from "@/components/ui/file-explorer";

import {
  fetchProjectResourceCode,
  fetchProjectRepositoryBrowser,
  formatMainSequenceError,
  type ProjectRepositoryBrowserResponse,
} from "../../api";
import { MainSequenceCreateJobDialog } from "./MainSequenceCreateJobDialog";

function toFileExplorerItems(
  payload: ProjectRepositoryBrowserResponse | undefined,
): FileExplorerItem[] {
  if (!payload) {
    return [];
  }

  const folderItems: FileExplorerItem[] = payload.folders.map((folder) => ({
    id: `folder:${folder.path}`,
    type: "folder",
    name: folder.name,
    path: folder.path,
  }));

  const fileItems: FileExplorerItem[] = payload.files.map((file) => ({
    id: `file:${file.path}`,
    type: "file",
    name: file.name,
    path: file.path,
    description: file.allowed_types ? "Allowed type" : undefined,
  }));

  return [...folderItems, ...fileItems];
}

export function MainSequenceProjectCodeTab({
  onJobCreated,
  projectId,
}: {
  onJobCreated?: () => void;
  projectId: number;
}) {
  const [currentPath, setCurrentPath] = useState("");
  const [jobFilePath, setJobFilePath] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPath("");
    setJobFilePath(null);
  }, [projectId]);

  const repositoryBrowserQuery = useQuery({
    queryKey: ["main_sequence", "projects", "repository-browser", projectId, currentPath],
    queryFn: () => fetchProjectRepositoryBrowser(projectId, currentPath),
    enabled: projectId > 0,
  });

  const items = useMemo(
    () => toFileExplorerItems(repositoryBrowserQuery.data),
    [repositoryBrowserQuery.data],
  );
  const itemActions = useMemo(
    () => [
      {
        id: "create-job",
        label: "Create job",
        icon: <Plus className="h-3.5 w-3.5" />,
        variant: "outline" as const,
        className:
          "border-primary/30 bg-primary/10 text-primary hover:bg-primary/18 hover:text-primary",
        isVisible: (item: FileExplorerItem) =>
          item.type === "file" && (item.path ?? item.name).toLowerCase().endsWith(".py"),
        isDisabled: (item: FileExplorerItem) =>
          item.type !== "file" || !(item.path ?? item.name).trim(),
        onClick: (item: FileExplorerItem) => {
          if (item.type !== "file") {
            return;
          }

          const nextPath = item.path ?? item.name;
          if (!nextPath) {
            return;
          }

          setJobFilePath(nextPath);
        },
      },
    ],
    [],
  );

  const payload = repositoryBrowserQuery.data;

  if (repositoryBrowserQuery.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading repository
        </div>
      </div>
    );
  }

  if (repositoryBrowserQuery.isError) {
    return (
      <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
        {formatMainSequenceError(repositoryBrowserQuery.error)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <button
          type="button"
          className="transition-colors hover:text-foreground"
          onClick={() => setCurrentPath("")}
        >
          Repository
        </button>
        {(payload?.breadcrumbs ?? []).map((breadcrumb) => (
          <div key={breadcrumb.path} className="inline-flex items-center gap-2">
            <ChevronRight className="h-3.5 w-3.5" />
            <button
              type="button"
              className="transition-colors hover:text-foreground"
              onClick={() => setCurrentPath(breadcrumb.path)}
            >
              {breadcrumb.name}
            </button>
          </div>
        ))}
      </div>

      <FileExplorer
        items={items}
        itemActions={itemActions}
        searchPlaceholder="Search repository"
        ariaLabel="Project repository browser"
        treeClassName="min-h-[420px]"
        previewClassName="min-h-[420px]"
        emptyState={
          payload?.has_repository === false
            ? (payload.message || "Project has no repository.")
            : (payload?.message || "This folder is empty.")
        }
        noResultsState="No files match the current search."
        previewEmptyState="Select a file to preview its contents."
        onRequestFileContent={(item) =>
          fetchProjectResourceCode(projectId, item.path ?? item.name)
        }
        onSelect={(item) => {
          if (item.type === "folder") {
            setCurrentPath(item.path ?? "");
          }
        }}
      />

      <MainSequenceCreateJobDialog
        projectId={projectId}
        filePath={jobFilePath ?? ""}
        open={Boolean(jobFilePath)}
        onCreated={onJobCreated}
        onClose={() => setJobFilePath(null)}
      />
    </div>
  );
}
