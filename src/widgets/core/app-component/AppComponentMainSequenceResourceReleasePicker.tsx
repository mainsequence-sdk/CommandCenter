import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";

import {
  formatMainSequenceError,
  listResourceReleaseGallery,
  type ResourceReleaseGalleryRecord,
} from "../../../../extensions/main_sequence/common/api";
import { PickerField, type PickerOption } from "../../../../extensions/main_sequence/common/components/PickerField";
import type { AppComponentMainSequenceResourceReleaseRef } from "./appComponentModel";

function matchesFastApiRelease(release: Pick<ResourceReleaseGalleryRecord, "release_kind">) {
  return release.release_kind.trim().toLowerCase() === "fastapi";
}

function buildReleaseOption(
  release:
    | Pick<
        ResourceReleaseGalleryRecord,
        "id" | "title" | "resource_name" | "project_name" | "subdomain" | "public_url"
      >
    | AppComponentMainSequenceResourceReleaseRef,
): PickerOption {
  const releaseId = "releaseId" in release ? release.releaseId : release.id;
  const title =
    "title" in release && typeof release.title === "string" && release.title.trim()
      ? release.title.trim()
      : "label" in release && typeof release.label === "string" && release.label.trim()
        ? release.label.trim()
        : "resource_name" in release &&
            typeof release.resource_name === "string" &&
            release.resource_name.trim()
          ? release.resource_name.trim()
          : `Release ${releaseId}`;
  const projectName =
    "project_name" in release && typeof release.project_name === "string"
      ? release.project_name
      : "projectName" in release && typeof release.projectName === "string"
        ? release.projectName
        : "";
  const subdomain =
    "subdomain" in release && typeof release.subdomain === "string"
      ? release.subdomain
      : "";
  const publicUrl =
    "public_url" in release && typeof release.public_url === "string"
      ? release.public_url
      : "publicUrl" in release && typeof release.publicUrl === "string"
        ? release.publicUrl
        : "";

  return {
    value: String(releaseId),
    label: title,
    description: [projectName, subdomain || publicUrl].filter(Boolean).join(" · "),
    keywords: [String(releaseId), projectName, subdomain, publicUrl],
  };
}

export function AppComponentMainSequenceResourceReleasePicker({
  editable,
  enabled = true,
  selectedRelease,
  value,
  onSelect,
}: {
  editable: boolean;
  enabled?: boolean;
  selectedRelease?: AppComponentMainSequenceResourceReleaseRef | null;
  value?: number;
  onSelect: (release: ResourceReleaseGalleryRecord) => void;
}) {
  const releasesQuery = useQuery({
    queryKey: ["main_sequence", "resource-release-gallery", "app-component-fastapi"],
    queryFn: () => listResourceReleaseGallery({ exclude: "agents" }),
    enabled,
    staleTime: 300_000,
  });

  const fastApiReleases = useMemo(
    () => (releasesQuery.data?.results ?? []).filter(matchesFastApiRelease),
    [releasesQuery.data?.results],
  );
  const pickerOptions = useMemo(() => {
    const options = fastApiReleases.map((release) => buildReleaseOption(release));

    if (
      selectedRelease?.releaseId &&
      !options.some((option) => option.value === String(selectedRelease.releaseId))
    ) {
      return [buildReleaseOption(selectedRelease), ...options];
    }

    return options;
  }, [fastApiReleases, selectedRelease]);

  return (
    <div className="space-y-3 rounded-[calc(var(--radius)-7px)] border border-border/65 bg-background/28 p-4">
      <div className="space-y-1">
        <div className="text-sm font-medium text-topbar-foreground">
          Main Sequence FastAPI release
        </div>
        <p className="text-sm text-muted-foreground">
          Search published Main Sequence FastAPI releases. Selecting one switches this widget to the
          exchange-launch transport that fetches short-lived release tokens automatically.
        </p>
      </div>

      <PickerField
        value={value && value > 0 ? String(value) : ""}
        onChange={(nextValue) => {
          const nextRelease = fastApiReleases.find(
            (release) => String(release.id) === nextValue,
          );

          if (nextRelease) {
            onSelect(nextRelease);
          }
        }}
        options={pickerOptions}
        placeholder="Select a FastAPI resource release"
        searchPlaceholder="Search releases"
        emptyMessage={
          releasesQuery.isLoading
            ? "Loading FastAPI releases."
            : "No FastAPI resource releases available."
        }
        searchable
        disabled={!editable}
        loading={releasesQuery.isFetching}
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Only FastAPI resource releases are listed here.</span>
        {releasesQuery.isError ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-auto px-0 py-0 text-sm text-primary hover:bg-transparent"
            onClick={() => {
              void releasesQuery.refetch();
            }}
          >
            Retry
          </Button>
        ) : null}
      </div>

      {releasesQuery.isError ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(releasesQuery.error)}
        </div>
      ) : null}
    </div>
  );
}
