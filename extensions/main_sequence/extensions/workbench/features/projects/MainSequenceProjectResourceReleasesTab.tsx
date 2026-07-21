import { useDeferredValue, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  FileText,
  Globe,
  History,
  Info,
  LayoutDashboard,
  Loader2,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Server,
  Trash2,
  XCircle,
} from "lucide-react";

import { AdminMenu } from "@/app/layout/AdminMenu";
import { useAuthStore } from "@/auth/auth-store";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  RbacAssignmentMatrix,
  type RbacAssignableTeam,
  type RbacAssignableUser,
  type RbacAssignmentScope,
  type RbacAssignmentValue,
} from "@/components/ui/rbac-assignment-matrix";
import { useToast } from "@/components/ui/toaster";
import { listTeams } from "@/features/teams/api";
import { useTheme } from "@/themes/ThemeProvider";

import {
  bulkDeleteResourceReleases,
  createResourceRelease,
  deployResourceReleaseCurrentVersion,
  deleteResourceRelease,
  fetchResourceRelease,
  getOrCreateProjectExecutorAgentService,
  type CreateProjectExecutorAgentServiceInput,
  type CreateResourceReleaseInput,
  fetchAvailableGpuTypes,
  fetchObjectCanEdit,
  fetchObjectCanView,
  fetchProjectImages,
  fetchResourceReleaseExchangeLaunch,
  fetchResourceReleaseSummary,
  fetchStaticSiteCapabilities,
  formatMainSequenceError,
  listDeploymentRuns,
  listPermissionCandidateUsers,
  listProjectResources,
  listResourceReleases,
  MainSequenceApiError,
  mainSequenceRegistryPageSize,
  requireStaticSiteExchangeLaunchUrl,
  updateShareableObjectPermission,
  type DeploymentRunListRecord,
  type EntitySummaryHeader,
  type PermissionCandidateUserRecord,
  type ProjectImageOption,
  type ProjectExecutorAgentServiceRecord,
  type ProjectResourceRecord,
  type ResourceReleaseRecord,
  type ResourceReleaseReadmeSummary,
  type ResourceReleaseSummaryExtensions,
  type ShareableAccessLevel,
  type ShareablePrincipalsResponse,
  type ShareablePrincipalType,
  type StaticSiteCapabilities,
  type StaticSiteCreateField,
  type StaticSiteCreateFieldChoice,
  type SummaryField,
  updateResourceRelease,
} from "../../../../common/api";
import { MainSequenceEntitySummaryCard } from "../../../../common/components/MainSequenceEntitySummaryCard";
import { PickerField, type PickerOption } from "../../../../common/components/PickerField";
import {
  mergePermissionEntityIds,
  normalizePermissionEntityId,
  resolvePermissionEntityId,
} from "../../../../common/components/permissionEntityId";
import { toProjectImagePickerOption } from "../../../../common/components/projectImagePickerOptions";
import { MainSequenceRegistryPagination } from "../../../../common/components/MainSequenceRegistryPagination";
import { MainSequenceRegistrySearch } from "../../../../common/components/MainSequenceRegistrySearch";
import {
  buildMainSequenceCostEstimateResources,
  MainSequenceCapacityToggle,
  MainSequenceResourceField,
  MainSequenceResourceRequirementsSection,
} from "../../../../common/components/MainSequenceResourceRequirementsSection";
import { MainSequenceSelectionCheckbox } from "../../../../common/components/MainSequenceSelectionCheckbox";
import { getRegistryTableCellClassName } from "../../../../common/components/registryTable";
import { useRegistrySelection } from "../../../../common/hooks/useRegistrySelection";
import { MainSequenceResourceReleaseApiTestTab } from "./MainSequenceResourceReleaseApiTestTab";
import {
  buildStaticSiteEmbedInitializeMessage,
  readStaticSiteEmbedHandshake,
  resolveStaticSiteEmbedOrigin,
  type StaticSiteEmbedThemeMode,
} from "./staticSiteEmbedBridge";

const projectResourceReleaseFetchLimit = 500;
const releaseKindToProjectResourceType = {
  streamlit_dashboard: "dashboard",
  agent: "agent",
  fastapi: "fastapi",
} as const;
const staticSiteReleaseKind = "static_site";
const emptyPermissionAssignments: RbacAssignmentValue = {
  view: { userIds: [], teamIds: [] },
  edit: { userIds: [], teamIds: [] },
};
const resourceReleasePermissionsObjectUrl = "resource-release";
const projectAgentCardResourceType = "project_agent_card";

type RuntimeReleaseKind = keyof typeof releaseKindToProjectResourceType;
type ReleaseKind = RuntimeReleaseKind | typeof staticSiteReleaseKind;
type ResourceReleaseDetailTabId = "readme" | "deployment" | "permissions" | "test-api";
type CreateReleaseIntent = "project-agent";
type CreateReleaseMode = "default" | "project-agent" | "static-site";
type StaticSiteCreateFormState = {
  automaticDeployment: boolean;
  rootDirectory: string;
  framework: string;
  nodeVersion: string;
  outputDirectory: string;
  routingMode: string;
  spaEntryFile: string;
  buildEnvironmentText: string;
};
type EffectiveStaticSiteCreateField = StaticSiteCreateField & {
  enabled: boolean;
  effectiveDefault: unknown;
  effectiveChoices?: StaticSiteCreateFieldChoice[];
};
type StaticSiteViewerState =
  | { status: "loading" }
  | { status: "ready"; launchUrl: string }
  | { status: "error"; title: string; detail: string };

const baseResourceReleaseDetailTabs = [
  { id: "readme", label: "README" },
  { id: "deployment", label: "Deployment" },
  { id: "permissions", label: "Permissions" },
] as const;
const staticSiteResourceReleaseDetailTabs = [
  { id: "permissions", label: "Permissions" },
] as const;
const gpuCountOptions: PickerOption[] = [
  { value: "", label: "No GPU" },
  { value: "1", label: "1 GPU" },
  { value: "2", label: "2 GPUs" },
  { value: "3", label: "3 GPUs" },
  { value: "4", label: "4 GPUs" },
  { value: "5", label: "5 GPUs" },
  { value: "6", label: "6 GPUs" },
  { value: "7", label: "7 GPUs" },
  { value: "8", label: "8 GPUs" },
];
const resourceReleaseAccessScopes: RbacAssignmentScope[] = [
  {
    id: "view",
    title: "Can view",
    userHelperText: "Users on the right can view this release.",
    teamHelperText: "Teams on the right can view this release.",
  },
  {
    id: "edit",
    title: "Can edit",
    userHelperText: "Users on the right can edit this release.",
    teamHelperText: "Teams on the right can edit this release.",
  },
];

function createDefaultReleaseComputeState() {
  return {
    cpuRequest: "100m",
    memoryRequest: "512Mi",
    gpuRequest: "",
    gpuType: "",
    spot: true,
  };
}

function createDefaultStaticSiteFormState(): StaticSiteCreateFormState {
  return {
    automaticDeployment: false,
    rootDirectory: "",
    framework: "",
    nodeVersion: "",
    outputDirectory: "",
    routingMode: "",
    spaEntryFile: "",
    buildEnvironmentText: "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFormString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function readFormBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function formatStaticSiteBuildEnvironment(value: unknown) {
  if (!isRecord(value)) {
    return "";
  }

  return Object.entries(value)
    .map(([key, entryValue]) => `${key}=${readFormString(entryValue)}`)
    .join("\n");
}

function parseStaticSiteBuildEnvironmentText(value: string) {
  const environment: Record<string, string> = {};

  for (const line of value.split("\n")) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();

    if (!key) {
      continue;
    }

    environment[key] = trimmedLine.slice(separatorIndex + 1);
  }

  return environment;
}

function getStaticSiteCreateFields(
  capabilities: StaticSiteCapabilities | null | undefined,
): StaticSiteCreateField[] {
  return Array.isArray(capabilities?.creation?.fields) ? capabilities.creation.fields : [];
}

function getStaticSiteCreateField(
  fields: StaticSiteCreateField[],
  name: string,
) {
  return fields.find((field) => field.name === name);
}

function getStaticSiteCurrentFieldValues(
  formState: StaticSiteCreateFormState,
  projectUid: string,
  siteName: string,
) {
  return {
    release_kind: "static_site",
    project_uid: projectUid,
    name: siteName,
    automatic_deployment: formState.automaticDeployment,
    root_directory: formState.rootDirectory,
    framework: formState.framework,
    node_version: formState.nodeVersion || null,
    output_directory: formState.outputDirectory || null,
    routing_mode: formState.routingMode || null,
    spa_entry_file: formState.spaEntryFile || null,
    build_environment: parseStaticSiteBuildEnvironmentText(formState.buildEnvironmentText),
  };
}

function staticSiteConditionMatches(
  conditionWhen: Record<string, string>,
  values: Record<string, unknown>,
) {
  return Object.entries(conditionWhen).every(
    ([fieldName, expectedValue]) => readFormString(values[fieldName]) === expectedValue,
  );
}

function getEffectiveStaticSiteCreateField(
  field: StaticSiteCreateField | undefined,
  values: Record<string, unknown>,
): EffectiveStaticSiteCreateField | null {
  if (!field) {
    return null;
  }

  const matchingCondition = field.conditions?.find((condition) =>
    staticSiteConditionMatches(condition.when, values),
  );

  return {
    ...field,
    enabled: matchingCondition ? matchingCondition.enabled : true,
    required: matchingCondition ? matchingCondition.required : field.required,
    effectiveDefault: matchingCondition ? matchingCondition.default : field.default,
    effectiveChoices: matchingCondition?.choices ?? field.choices,
  };
}

function assignStaticSiteFormStateField(
  state: StaticSiteCreateFormState,
  fieldName: string,
  value: unknown,
) {
  if (fieldName === "automatic_deployment") {
    state.automaticDeployment = readFormBoolean(value, false);
  } else if (fieldName === "root_directory") {
    state.rootDirectory = readFormString(value);
  } else if (fieldName === "framework") {
    state.framework = readFormString(value);
  } else if (fieldName === "node_version") {
    state.nodeVersion = readFormString(value);
  } else if (fieldName === "output_directory") {
    state.outputDirectory = readFormString(value);
  } else if (fieldName === "routing_mode") {
    state.routingMode = readFormString(value);
  } else if (fieldName === "spa_entry_file") {
    state.spaEntryFile = readFormString(value);
  } else if (fieldName === "build_environment") {
    state.buildEnvironmentText = formatStaticSiteBuildEnvironment(value);
  }
}

function createStaticSiteFormStateFromCapabilities(
  capabilities: StaticSiteCapabilities | null | undefined,
  projectUid: string,
): StaticSiteCreateFormState {
  const state = createDefaultStaticSiteFormState();
  const fields = getStaticSiteCreateFields(capabilities);

  for (const field of fields) {
    assignStaticSiteFormStateField(state, field.name, field.default);
  }

  return applyStaticSiteDependentDefaults(state, fields, projectUid, readFormString(
    getStaticSiteCreateField(fields, "name")?.default,
  ), "framework");
}

function applyStaticSiteDependentDefaults(
  current: StaticSiteCreateFormState,
  fields: StaticSiteCreateField[],
  projectUid: string,
  siteName: string,
  changedField: "framework" | "routing_mode",
): StaticSiteCreateFormState {
  const next = { ...current };

  if (changedField === "framework") {
    for (const fieldName of [
      "node_version",
      "output_directory",
      "routing_mode",
    ]) {
      const field = getEffectiveStaticSiteCreateField(
        getStaticSiteCreateField(fields, fieldName),
        getStaticSiteCurrentFieldValues(next, projectUid, siteName),
      );

      if (field) {
        assignStaticSiteFormStateField(next, fieldName, field.effectiveDefault);
      }
    }
  }

  const spaEntryFileField = getEffectiveStaticSiteCreateField(
    getStaticSiteCreateField(fields, "spa_entry_file"),
    getStaticSiteCurrentFieldValues(next, projectUid, siteName),
  );

  if (spaEntryFileField) {
    assignStaticSiteFormStateField(next, "spa_entry_file", spaEntryFileField.effectiveDefault);
  }

  return next;
}

function staticSiteChoiceOptions(field: EffectiveStaticSiteCreateField | null): PickerOption[] {
  return (field?.effectiveChoices ?? []).map((choice) => ({
    value: choice.value,
    label: choice.label,
    keywords: [choice.value, choice.label],
  }));
}

function getStaticSiteFormRequestValue(
  field: EffectiveStaticSiteCreateField,
  values: Record<string, unknown>,
) {
  const value = values[field.name];

  if (field.type === "string_map") {
    return isRecord(value) ? value : {};
  }

  if (field.type === "boolean") {
    return readFormBoolean(value, false);
  }

  if (value === "" && field.nullable) {
    return null;
  }

  return value;
}

function staticSiteRequiredFieldIsMissing(
  field: EffectiveStaticSiteCreateField | null,
  values: Record<string, unknown>,
) {
  if (!field?.enabled || !field.required) {
    return false;
  }

  const value = getStaticSiteFormRequestValue(field, values);

  return value === null || value === undefined;
}

function buildStaticSiteCreateRequest(
  fields: StaticSiteCreateField[],
  values: Record<string, unknown>,
): CreateResourceReleaseInput | null {
  const requestBody: Record<string, unknown> = {};

  for (const field of fields) {
    const effectiveField = getEffectiveStaticSiteCreateField(field, values);

    if (!effectiveField?.enabled) {
      continue;
    }

    requestBody[field.name] = getStaticSiteFormRequestValue(effectiveField, values);
  }

  if (requestBody.release_kind !== staticSiteReleaseKind) {
    return null;
  }

  if (typeof requestBody.project_uid !== "string" || typeof requestBody.name !== "string") {
    return null;
  }

  return requestBody as unknown as CreateResourceReleaseInput;
}

function openCreateReleaseDialog(input: {
  reset: () => void;
  setCreateReleaseKind: (kind: ReleaseKind) => void;
  setComputeState: Dispatch<SetStateAction<ReturnType<typeof createDefaultReleaseComputeState>>>;
  setCreateDialogOpen: (open: boolean) => void;
  setCreateReleaseMode: (mode: CreateReleaseMode) => void;
  setCreateReleaseResourceTypeOverride: (value: string | null) => void;
  setCreateAutomaticDeployment: (value: boolean) => void;
  setStaticSiteFormState: Dispatch<SetStateAction<StaticSiteCreateFormState>>;
  setStaticSiteName: (value: string) => void;
  releaseKind: ReleaseKind;
  mode?: CreateReleaseMode;
  resourceTypeOverride?: string | null;
}) {
  input.reset();
  input.setCreateReleaseKind(input.releaseKind);
  input.setComputeState(createDefaultReleaseComputeState());
  input.setCreateReleaseMode(input.mode ?? "default");
  input.setCreateReleaseResourceTypeOverride(input.resourceTypeOverride ?? null);
  input.setCreateAutomaticDeployment(false);
  input.setStaticSiteFormState(createDefaultStaticSiteFormState());
  input.setStaticSiteName("");
  input.setCreateDialogOpen(true);
}

function isStaticSiteReleaseKind(releaseKind: string | null | undefined) {
  return releaseKind === staticSiteReleaseKind;
}

function isRuntimeReleaseKind(releaseKind: ReleaseKind | null): releaseKind is RuntimeReleaseKind {
  return Boolean(
    releaseKind &&
      Object.prototype.hasOwnProperty.call(releaseKindToProjectResourceType, releaseKind),
  );
}

function formatReleaseKind(releaseKind: string) {
  if (releaseKind === "streamlit_dashboard") {
    return "Dashboard";
  }

  if (releaseKind === "agent") {
    return "Agent";
  }

  if (releaseKind === "fastapi") {
    return "Fast API";
  }

  if (isStaticSiteReleaseKind(releaseKind)) {
    return "Static Site";
  }

  return releaseKind.replaceAll("_", " ");
}

function formatStaticSiteRoutingMode(routingMode: string) {
  if (routingMode === "spa") {
    return "SPA";
  }

  if (routingMode === "static") {
    return "Static";
  }

  return routingMode.replaceAll("_", " ");
}

function getReleaseKindBadgeVariant(releaseKind: string) {
  if (releaseKind === "streamlit_dashboard") {
    return "primary" as const;
  }

  if (releaseKind === "agent") {
    return "secondary" as const;
  }

  if (releaseKind === "fastapi") {
    return "primary" as const;
  }

  if (isStaticSiteReleaseKind(releaseKind)) {
    return "secondary" as const;
  }

  return "neutral" as const;
}

function formatReadmeFilesize(filesize?: number | null) {
  if (!filesize || filesize <= 0) {
    return null;
  }

  if (filesize < 1024) {
    return `${filesize} B`;
  }

  if (filesize < 1024 * 1024) {
    return `${(filesize / 1024).toFixed(1)} KB`;
  }

  return `${(filesize / (1024 * 1024)).toFixed(1)} MB`;
}

function toProjectResourceOption(resource: ProjectResourceRecord) {
  return {
    value: resource.uid,
    label: resource.name,
    description: resource.path,
    keywords: [resource.path, resource.repo_commit_sha ?? "", resource.resource_type],
  };
}

function getEntityUidFromSummaryHref(href: string | undefined, queryKeys: string[]) {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, "https://mainsequence.local");

    for (const queryKey of queryKeys) {
      const rawValue = url.searchParams.get(queryKey)?.trim();

      if (rawValue) {
        return rawValue;
      }
    }

    const pathnameSegments = url.pathname.split("/").filter(Boolean).reverse();

    for (const segment of pathnameSegments) {
      if (segment.trim()) {
        return segment.trim();
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getProjectUidFromSummaryHref(href?: string) {
  return getEntityUidFromSummaryHref(href, ["project_uid", "msProjectUid"]);
}

function getJobUidFromSummaryHref(href?: string) {
  return getEntityUidFromSummaryHref(href, ["job_uid", "msJobUid"]);
}

function readReleaseScalar(value: string | number | null | undefined) {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function getResourceReleaseResourceUid(release: ResourceReleaseRecord | null | undefined) {
  return readReleaseScalar(release?.resource_uid);
}

function getResourceReleaseReadmeResourceUid(release: ResourceReleaseRecord | null | undefined) {
  return readReleaseScalar(release?.readme_resource_uid);
}

function getResourceReleaseRelatedJobUid(release: ResourceReleaseRecord | null | undefined) {
  return readReleaseScalar(release?.related_job_uid);
}

function getResourceReleaseProjectUid(release: ResourceReleaseRecord | null | undefined) {
  return readReleaseScalar(release?.project_uid);
}

function getResourceReleaseDisplayName(release: ResourceReleaseRecord) {
  return release.name?.trim() || release.subdomain;
}

function formatReleaseResourceReference(release: ResourceReleaseRecord) {
  if (isStaticSiteReleaseKind(release.release_kind)) {
    return getResourceReleaseDisplayName(release);
  }

  const resourceUid = getResourceReleaseResourceUid(release);

  if (resourceUid) {
    return resourceUid;
  }

  const projectUid = getResourceReleaseProjectUid(release);
  if (projectUid) {
    return `Project ${projectUid}`;
  }

  const legacyResource = readReleaseScalar(release.resource);
  return legacyResource ? `Resource ${legacyResource}` : "No resource";
}

function formatReleaseReadmeReference(release: ResourceReleaseRecord) {
  if (isStaticSiteReleaseKind(release.release_kind)) {
    return release.public_url?.trim() || getResourceReleaseDisplayName(release);
  }

  const readmeResourceUid = getResourceReleaseReadmeResourceUid(release);

  if (readmeResourceUid) {
    return readmeResourceUid;
  }

  const legacyReadmeResource = readReleaseScalar(release.readme_resource);
  return legacyReadmeResource ? `Resource ${legacyReadmeResource}` : "No readme";
}

function formatReleaseJobReference(release: ResourceReleaseRecord) {
  if (isStaticSiteReleaseKind(release.release_kind)) {
    const activeDeployment = release.active_deployment;

    return activeDeployment
      ? `Active deployment #${activeDeployment.sequence}`
      : `automatic_deployment ${formatAutomaticDeploymentValue(release.automatic_deployment ?? false)}`;
  }

  const relatedJobUid = getResourceReleaseRelatedJobUid(release);

  if (relatedJobUid) {
    return relatedJobUid;
  }

  const legacyJob = readReleaseScalar(release.related_job);
  return legacyJob ? `Job ${legacyJob}` : "No job";
}

function formatAutomaticDeploymentValue(automaticDeployment: boolean) {
  return automaticDeployment ? "true" : "false";
}

function AutomaticDeploymentBoolean({
  automaticDeployment,
}: {
  automaticDeployment: boolean;
}) {
  const Icon = automaticDeployment ? CheckCircle2 : XCircle;

  return (
    <span
      className={
        automaticDeployment
          ? "inline-flex items-center gap-1.5 text-sm font-medium text-success"
          : "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
      }
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{formatAutomaticDeploymentValue(automaticDeployment)}</span>
    </span>
  );
}

function normalizeDeploymentRunStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() ?? "";
}

function isResourceReleaseDeploymentRunActive(status: string | null | undefined) {
  return [
    "pending",
    "running",
    "waiting_project_image",
    "waiting_runtime_ready",
  ].includes(normalizeDeploymentRunStatus(status));
}

function getResourceReleaseDeploymentRunStatusVariant(status: string) {
  const normalized = normalizeDeploymentRunStatus(status);

  if (["deployed", "no_action"].includes(normalized)) {
    return "success" as const;
  }

  if (["skipped", "blocked", "failed"].includes(normalized)) {
    return "danger" as const;
  }

  if (isResourceReleaseDeploymentRunActive(status)) {
    return normalized === "running" ? "primary" as const : "warning" as const;
  }

  return "neutral" as const;
}

function formatStatusLabel(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.replaceAll("_", " ") : "Not available";
}

function formatReleaseTimestamp(value: string | null | undefined) {
  if (!value?.trim()) {
    return "Not started";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function readDeploymentRunErrorField(
  error: DeploymentRunListRecord["error"],
  keys: string[],
) {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error.trim() || null;
  }

  for (const key of keys) {
    const value = error[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function buildFallbackResourceReleaseSummary(release: ResourceReleaseRecord): EntitySummaryHeader {
  const isStaticSite = isStaticSiteReleaseKind(release.release_kind);
  const readmeLinked =
    getResourceReleaseReadmeResourceUid(release) || readReleaseScalar(release.readme_resource);

  return {
    entity: {
      id: release.uid,
      type: "resource_release",
      title: getResourceReleaseDisplayName(release),
    },
    badges: [
      {
        key: "release_kind",
        label: formatReleaseKind(release.release_kind),
        tone: getReleaseKindBadgeVariant(release.release_kind),
      },
      ...(isStaticSite
        ? []
        : [
            {
              key: "readme",
              label: readmeLinked ? "README linked" : "No README",
              tone: readmeLinked ? ("success" as const) : ("warning" as const),
            },
          ]),
      {
        key: "automatic_deployment",
        label: `automatic_deployment ${formatAutomaticDeploymentValue(
          release.automatic_deployment ?? false,
        )}`,
        tone: release.automatic_deployment ? "success" : "neutral",
      },
    ],
    inline_fields: isStaticSite
      ? [
          {
            key: "project_uid",
            label: "Project UID",
            value: getResourceReleaseProjectUid(release) ?? "Not returned",
            kind: "text",
          },
          {
            key: "automatic_deployment",
            label: "automatic_deployment",
            value: formatAutomaticDeploymentValue(release.automatic_deployment ?? false),
            kind: "text",
          },
          {
            key: "public_url",
            label: "Public URL",
            value: release.public_url,
            kind: "link",
            href: `/orm/api/pods/resource-release/${release.uid}/exchange-launch/`,
            iframe: true,
          },
        ]
      : [
          {
            key: "resource_uid",
            label: "Resource",
            value: formatReleaseResourceReference(release),
            kind: "text",
          },
          {
            key: "related_job_uid",
            label: "Job",
            value: formatReleaseJobReference(release),
            kind: "text",
          },
          {
            key: "readme_resource_uid",
            label: "README",
            value: formatReleaseReadmeReference(release),
            kind: "text",
          },
        ],
    highlight_fields: [
      {
        key: "subdomain",
        label: "Subdomain",
        value: release.subdomain,
        kind: "text",
        icon: "globe",
      },
      {
        key: "release_id",
        label: "Release UID",
        value: release.uid,
        kind: "text",
      },
    ],
    stats: [],
  };
}

function getResourceReleaseReadme(
  extensions?: ResourceReleaseSummaryExtensions,
): ResourceReleaseReadmeSummary | undefined {
  return extensions?.readme;
}

function getResourceReleaseSummaryResourceType(
  summary: EntitySummaryHeader | null,
) {
  const resourceTypeField = summary?.inline_fields.find((field) => field.key === "resource_type");
  return typeof resourceTypeField?.value === "string" ? resourceTypeField.value : null;
}

type CreateResourceReleaseMutationInput =
  | CreateResourceReleaseInput
  | (CreateProjectExecutorAgentServiceInput & { mode: "project-agent" });

function isProjectAgentCreateInput(
  input: CreateResourceReleaseMutationInput,
): input is CreateProjectExecutorAgentServiceInput & { mode: "project-agent" } {
  return "mode" in input && input.mode === "project-agent";
}

function mergeRbacIds(...lists: Array<Array<string | number>>) {
  return mergePermissionEntityIds(...lists);
}

function formatPermissionUserName(
  user: Pick<PermissionCandidateUserRecord, "email" | "first_name" | "last_name" | "username">,
) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  return user.username || user.email;
}

function normalizePermissionValue(value: RbacAssignmentValue): RbacAssignmentValue {
  const editUserIds = mergeRbacIds(value.edit?.userIds ?? []);
  const editTeamIds = mergeRbacIds(value.edit?.teamIds ?? []);

  return {
    view: {
      userIds: mergeRbacIds(value.view?.userIds ?? [], editUserIds),
      teamIds: mergeRbacIds(value.view?.teamIds ?? [], editTeamIds),
    },
    edit: {
      userIds: editUserIds,
      teamIds: editTeamIds,
    },
  };
}

function buildPermissionValue(
  canView: ShareablePrincipalsResponse | undefined,
  canEdit: ShareablePrincipalsResponse | undefined,
) {
  return normalizePermissionValue({
    view: {
      userIds: mergePermissionEntityIds(canView?.users ?? []),
      teamIds: mergePermissionEntityIds(canView?.teams ?? []),
    },
    edit: {
      userIds: mergePermissionEntityIds(canEdit?.users ?? []),
      teamIds: mergePermissionEntityIds(canEdit?.teams ?? []),
    },
  });
}

function resolvePermissionLevel(
  value: RbacAssignmentValue,
  principalType: ShareablePrincipalType,
  principalId: string | number,
): ShareableAccessLevel | "none" {
  const normalizedId = normalizePermissionEntityId(principalId);

  if (normalizedId === null) {
    return "none";
  }

  const normalizedKey = String(normalizedId);
  const editIds =
    principalType === "user" ? value.edit?.userIds ?? [] : value.edit?.teamIds ?? [];
  const viewIds =
    principalType === "user" ? value.view?.userIds ?? [] : value.view?.teamIds ?? [];

  if (editIds.some((id) => String(normalizePermissionEntityId(id)) === normalizedKey)) {
    return "edit";
  }

  if (viewIds.some((id) => String(normalizePermissionEntityId(id)) === normalizedKey)) {
    return "view";
  }

  return "none";
}

function buildPermissionOperations(
  currentValue: RbacAssignmentValue,
  nextValue: RbacAssignmentValue,
) {
  const operations: Array<{
    principalId: string | number;
    principalType: ShareablePrincipalType;
    accessLevel: ShareableAccessLevel;
    operation: "add" | "remove";
  }> = [];

  for (const principalType of ["user", "team"] as const) {
    const principalIds =
      principalType === "user"
        ? mergeRbacIds(
            currentValue.view.userIds,
            currentValue.edit.userIds,
            nextValue.view.userIds,
            nextValue.edit.userIds,
          )
        : mergeRbacIds(
            currentValue.view.teamIds,
            currentValue.edit.teamIds,
            nextValue.view.teamIds,
            nextValue.edit.teamIds,
          );

    for (const principalId of principalIds) {
      const currentLevel = resolvePermissionLevel(currentValue, principalType, principalId);
      const nextLevel = resolvePermissionLevel(nextValue, principalType, principalId);

      if (currentLevel === nextLevel) {
        continue;
      }

      if (nextLevel === "none") {
        operations.push({
          principalId,
          principalType,
          accessLevel: "view",
          operation: "remove",
        });
        continue;
      }

      if (nextLevel === "edit") {
        operations.push({
          principalId,
          principalType,
          accessLevel: "edit",
          operation: "add",
        });
        continue;
      }

      if (currentLevel === "edit" && nextLevel === "view") {
        operations.push({
          principalId,
          principalType,
          accessLevel: "edit",
          operation: "remove",
        });
        continue;
      }

      operations.push({
        principalId,
        principalType,
        accessLevel: "view",
        operation: "add",
      });
    }
  }

  return operations;
}

function ResourceReleaseDeploymentPolicyToggle({
  automaticDeployment,
  disabled = false,
  helpText,
  onChange,
}: {
  automaticDeployment: boolean;
  disabled?: boolean;
  helpText?: string | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={
        disabled
          ? "flex cursor-not-allowed items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 opacity-70"
          : "flex cursor-pointer items-start gap-3 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 transition-colors hover:bg-background/36"
      }
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 accent-primary"
        checked={automaticDeployment}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            automatic_deployment
            {helpText ? (
              <span
                aria-label={helpText}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/70 text-muted-foreground"
                title={helpText}
              >
                <Info className="h-3 w-3" aria-hidden="true" />
              </span>
            ) : null}
          </span>
          <AutomaticDeploymentBoolean automaticDeployment={automaticDeployment} />
        </span>
      </span>
    </label>
  );
}

function ResourceReleaseReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="min-w-0 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-all text-sm font-medium text-foreground">
        {value?.trim() || "Not available"}
      </div>
    </div>
  );
}

function ResourceReleaseDeploymentRunsTable({
  error,
  isFetching,
  isLoading,
  onRefresh,
  runs,
}: {
  error: Error | null;
  isFetching: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  runs: DeploymentRunListRecord[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="h-4 w-4 text-muted-foreground" />
            Deployment run history
          </div>
          <p className="text-sm text-muted-foreground">
            Manual and automatic deployment runs for this resource release.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isFetching && !isLoading ? <Badge variant="neutral">Refreshing</Badge> : null}
          <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-36 items-center justify-center rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading deployment runs
          </div>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {formatMainSequenceError(error)}
        </div>
      ) : null}

      {!isLoading && !error && runs.length === 0 ? (
        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-8 text-center">
          <div className="text-sm font-medium text-foreground">No deployment runs yet</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manual deploys and repository-triggered rotations will appear here.
          </p>
        </div>
      ) : null}

      {!isLoading && !error && runs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-4 pb-2">Run</th>
                <th className="px-4 pb-2">Status</th>
                <th className="px-4 pb-2">Source</th>
                <th className="px-4 pb-2">Revision</th>
                <th className="px-4 pb-2">Timing</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const errorCode = readDeploymentRunErrorField(run.error, [
                  "error_code",
                  "code",
                ]);
                const errorDetail = readDeploymentRunErrorField(run.error, [
                  "error_detail",
                  "detail",
                ]);
                const hasFailureDetails =
                  Boolean(errorCode?.trim()) || Boolean(errorDetail?.trim());

                return (
                  <tr key={run.uid}>
                    <td className={getRegistryTableCellClassName(false, "left")}>
                      <div className="font-medium text-foreground">{run.uid}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Release {run.target.name || run.target.uid}
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(false)}>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={getResourceReleaseDeploymentRunStatusVariant(run.state)}>
                          {formatStatusLabel(run.state)}
                        </Badge>
                        {run.phase ? (
                          <Badge variant="neutral">{formatStatusLabel(run.phase)}</Badge>
                        ) : null}
                      </div>
                      {hasFailureDetails ? (
                        <div className="mt-2 rounded-[calc(var(--radius)-8px)] border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                          {errorCode ? (
                            <div className="font-medium">{errorCode}</div>
                          ) : null}
                          {errorDetail ? <div>{errorDetail}</div> : null}
                        </div>
                      ) : null}
                    </td>
                    <td className={getRegistryTableCellClassName(false)}>
                      <div className="text-foreground">
                        {formatStatusLabel(run.source)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatReleaseKind(run.target.kind ?? run.target_type)}
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(false)}>
                      <div className="break-all text-foreground">
                        {run.operation?.trim() || "Operation unavailable"}
                      </div>
                      <div className="mt-1 break-all text-xs text-muted-foreground">
                        {run.commit_sha ? `Commit ${run.commit_sha}` : "Commit unavailable"}
                      </div>
                    </td>
                    <td className={getRegistryTableCellClassName(false, "right")}>
                      <div className="text-foreground">
                        Started {formatReleaseTimestamp(run.started_at ?? run.created_at)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {run.finished_at
                          ? `Finished ${formatReleaseTimestamp(run.finished_at)}`
                          : isResourceReleaseDeploymentRunActive(run.state)
                            ? "Still in progress"
                            : "No finish timestamp"}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function StaticSiteReleaseViewer({
  onClose,
  state,
  themeId,
  themeMode,
  userUid,
}: {
  onClose: () => void;
  state: StaticSiteViewerState;
  themeId: string;
  themeMode: StaticSiteEmbedThemeMode;
  userUid: string | null;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const shellRoot =
    typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>("[data-app-shell]");

  if (!shellRoot) {
    return null;
  }

  return createPortal(
    <div
      className="fixed bottom-0 right-0 z-[80] bg-background"
      style={{
        left: "var(--shell-sidebar-width, 52px)",
        top: "var(--shell-topbar-height, 56px)",
      }}
      role="dialog"
      aria-label="Static site viewer"
      aria-modal="true"
    >
      {state.status === "ready" ? (
        <div className="flex h-full min-h-0 flex-col">
          <StaticSiteEmbedFrame
            launchUrl={state.launchUrl}
            themeId={themeId}
            themeMode={themeMode}
            userUid={userUid}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center px-6 py-10">
          {state.status === "loading" ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Opening site
            </div>
          ) : (
            <div className="max-w-xl text-center">
              <h2 className="text-base font-semibold text-foreground">{state.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{state.detail}</p>
            </div>
          )}
        </div>
      )}
    </div>,
    shellRoot,
  );
}

function StaticSiteEmbedFrame({
  launchUrl,
  themeId,
  themeMode,
  userUid,
}: {
  launchUrl: string;
  themeId: string;
  themeMode: StaticSiteEmbedThemeMode;
  userUid: string | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [handshake, setHandshake] = useState<ReturnType<typeof readStaticSiteEmbedHandshake>>(null);
  const targetOrigin = useMemo(() => resolveStaticSiteEmbedOrigin(launchUrl), [launchUrl]);

  useEffect(() => {
    setHandshake(null);

    function handleMessage(event: MessageEvent<unknown>) {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== targetOrigin) {
        return;
      }

      const nextHandshake = readStaticSiteEmbedHandshake(event.data);

      if (nextHandshake) {
        setHandshake(nextHandshake);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [launchUrl, targetOrigin]);

  useEffect(() => {
    if (!handshake) {
      return;
    }

    iframeRef.current?.contentWindow?.postMessage(
      buildStaticSiteEmbedInitializeMessage({
        handshake,
        themeId,
        themeMode,
        userUid,
      }),
      targetOrigin,
    );
  }, [handshake, targetOrigin, themeId, themeMode, userUid]);

  return (
    <iframe
      ref={iframeRef}
      className="min-h-0 w-full flex-1 border-0 bg-background"
      src={launchUrl}
      title="Static site"
    />
  );
}

export function MainSequenceProjectResourceReleasesTab({
  onConsumeCreateReleaseIntent,
  onCloseResourceReleaseDetail,
  onOpenJobDetail,
  onOpenProjectDetail,
  onOpenResourceReleaseDetail,
  projectUid,
  requestedCreateReleaseIntent,
  selectedResourceReleaseUid,
}: {
  onConsumeCreateReleaseIntent?: () => void;
  onCloseResourceReleaseDetail: () => void;
  onOpenJobDetail: (jobUid: string) => void;
  onOpenProjectDetail: (projectUid: string) => void;
  onOpenResourceReleaseDetail: (resourceReleaseUid: string) => void;
  projectUid: string;
  requestedCreateReleaseIntent: CreateReleaseIntent | null;
  selectedResourceReleaseUid: string | null;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeTheme, themeId } = useTheme();
  const sessionUser = useAuthStore((state) => state.session?.user ?? null);
  const [filterValue, setFilterValue] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createReleaseKind, setCreateReleaseKind] = useState<ReleaseKind | null>(null);
  const [createReleaseMode, setCreateReleaseMode] = useState<CreateReleaseMode>("default");
  const [createReleaseResourceTypeOverride, setCreateReleaseResourceTypeOverride] =
    useState<string | null>(null);
  const [createAutomaticDeployment, setCreateAutomaticDeployment] = useState(false);
  const [staticSiteName, setStaticSiteName] = useState("");
  const [staticSiteFormState, setStaticSiteFormState] = useState(() =>
    createDefaultStaticSiteFormState(),
  );
  const [selectedResourceUid, setSelectedResourceUid] = useState("");
  const [selectedImageUid, setSelectedImageUid] = useState("");
  const [selectedDetailTabId, setSelectedDetailTabId] = useState<ResourceReleaseDetailTabId>("readme");
  const [computeState, setComputeState] = useState(() => createDefaultReleaseComputeState());
  const [releasesPendingDelete, setReleasesPendingDelete] = useState<ResourceReleaseRecord[]>([]);
  const [deploymentDraftAutomaticDeployment, setDeploymentDraftAutomaticDeployment] =
    useState(false);
  const [hasUserEditedDeployment, setHasUserEditedDeployment] = useState(false);
  const [permissionsValue, setPermissionsValue] =
    useState<RbacAssignmentValue>(emptyPermissionAssignments);
  const [staticSiteViewerState, setStaticSiteViewerState] =
    useState<StaticSiteViewerState | null>(null);
  const deferredFilterValue = useDeferredValue(filterValue);
  const handledCreateReleaseIntentRef = useRef<CreateReleaseIntent | null>(null);
  const staticSiteViewerRequestIdRef = useRef(0);

  const resourceReleasesQuery = useQuery({
    queryKey: ["main_sequence", "projects", "resource-releases", "list", projectUid],
    queryFn: () =>
      listResourceReleases({
        limit: projectResourceReleaseFetchLimit,
        offset: 0,
        projectUid,
      }),
    enabled: Boolean(projectUid),
    staleTime: 300_000,
  });

  const resourceReleaseSummaryQuery = useQuery({
    queryKey: ["main_sequence", "projects", "resource-releases", "summary", selectedResourceReleaseUid],
    queryFn: () => fetchResourceReleaseSummary(selectedResourceReleaseUid ?? ""),
    enabled: Boolean(selectedResourceReleaseUid),
  });

  const resourceReleaseDetailQuery = useQuery({
    queryKey: ["main_sequence", "projects", "resource-releases", "detail", selectedResourceReleaseUid],
    queryFn: () => fetchResourceRelease(selectedResourceReleaseUid ?? ""),
    enabled: Boolean(selectedResourceReleaseUid),
    staleTime: 60_000,
  });

  const resourceReleaseCanViewQuery = useQuery({
    queryKey: [
      "main_sequence",
      "permissions",
      resourceReleasePermissionsObjectUrl,
      selectedResourceReleaseUid,
      "view",
    ],
    queryFn: () =>
      fetchObjectCanView(
        resourceReleasePermissionsObjectUrl,
        selectedResourceReleaseUid ?? "",
      ),
    enabled: Boolean(selectedResourceReleaseUid) && selectedDetailTabId === "permissions",
    staleTime: 60_000,
  });

  const resourceReleaseCanEditQuery = useQuery({
    queryKey: [
      "main_sequence",
      "permissions",
      resourceReleasePermissionsObjectUrl,
      selectedResourceReleaseUid,
      "edit",
    ],
    queryFn: () =>
      fetchObjectCanEdit(
        resourceReleasePermissionsObjectUrl,
        selectedResourceReleaseUid ?? "",
      ),
    enabled: Boolean(selectedResourceReleaseUid) && selectedDetailTabId === "permissions",
    staleTime: 60_000,
  });

  const permissionCandidateUsersQuery = useQuery({
    queryKey: [
      "main_sequence",
      "permissions",
      resourceReleasePermissionsObjectUrl,
      selectedResourceReleaseUid,
      "candidate-users",
    ],
    queryFn: () =>
      listPermissionCandidateUsers(
        resourceReleasePermissionsObjectUrl,
        selectedResourceReleaseUid ?? "",
      ),
    enabled: Boolean(selectedResourceReleaseUid) && selectedDetailTabId === "permissions",
    staleTime: 300_000,
  });
  const permissionTeamsQuery = useQuery({
    queryKey: ["main_sequence", "permissions", "teams"],
    queryFn: () => listTeams(),
    enabled: Boolean(selectedResourceReleaseUid) && selectedDetailTabId === "permissions",
    staleTime: 300_000,
  });

  const resourceReleaseDeploymentRunsQuery = useQuery({
    queryKey: [
      "main_sequence",
      "projects",
      "resource-releases",
      "deployment-runs",
      projectUid,
      selectedResourceReleaseUid,
    ],
    queryFn: async () => {
      const response = await listDeploymentRuns({
        projectUid,
        targetType: "resource_release",
        limit: 500,
        offset: 0,
      });

      return response.results.filter(
        (run) => run.target.uid === selectedResourceReleaseUid,
      );
    },
    enabled: Boolean(selectedResourceReleaseUid) && selectedDetailTabId === "deployment",
    refetchInterval: (query) => {
      const runs = query.state.data;

      return Array.isArray(runs) &&
        runs.some((run) => isResourceReleaseDeploymentRunActive(run.state))
        ? 5_000
        : false;
    },
  });

  const staticSiteCapabilitiesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "projects",
      "resource-releases",
      "static-site-capabilities",
      projectUid,
    ],
    queryFn: () => fetchStaticSiteCapabilities(projectUid),
    enabled:
      createDialogOpen &&
      createReleaseMode === "static-site" &&
      Boolean(projectUid),
    staleTime: 60_000,
  });

  const projectImagesQuery = useQuery({
    queryKey: ["main_sequence", "projects", "job-images", projectUid],
    queryFn: () => fetchProjectImages(projectUid),
    enabled:
      createDialogOpen &&
      createReleaseMode !== "static-site" &&
      Boolean(projectUid),
    staleTime: 300_000,
  });

  const availableGpuTypesQuery = useQuery({
    queryKey: ["main_sequence", "billing", "available-gpu-types"],
    queryFn: fetchAvailableGpuTypes,
    enabled: createDialogOpen && createReleaseMode !== "static-site",
    staleTime: 300_000,
  });

  const readyProjectImages = useMemo(
    () =>
      (projectImagesQuery.data ?? []).filter(
        (image) => image.is_ready && Boolean(image.project_repo_hash?.trim()),
      ),
    [projectImagesQuery.data],
  );
  const selectedProjectImage =
    readyProjectImages.find((image) => image.uid === selectedImageUid) ?? null;

  const releaseResourcesQuery = useQuery({
    queryKey: [
      "main_sequence",
      "projects",
      "resource-releases",
      "resources",
      projectUid,
      createReleaseKind,
      selectedProjectImage?.project_repo_hash ?? "",
    ],
    queryFn: () =>
      listProjectResources(projectUid, {
        limit: 200,
        repoCommitSha: selectedProjectImage?.project_repo_hash ?? undefined,
        resourceType:
          createReleaseResourceTypeOverride ??
          (isRuntimeReleaseKind(createReleaseKind)
            ? releaseKindToProjectResourceType[createReleaseKind]
            : undefined),
      }),
    enabled:
      createDialogOpen &&
      Boolean(projectUid) &&
      createReleaseMode === "default" &&
      isRuntimeReleaseKind(createReleaseKind) &&
      Boolean(selectedProjectImage?.project_repo_hash),
    staleTime: 300_000,
  });

  const projectReleases = useMemo(
    () =>
      (resourceReleasesQuery.data?.results ?? []).filter((release) => {
        const releaseProjectUid = getResourceReleaseProjectUid(release);

        if (!releaseProjectUid) {
          return true;
        }

        return releaseProjectUid === projectUid;
      }),
    [projectUid, resourceReleasesQuery.data?.results],
  );
  const selectedReleaseFromList = useMemo(
    () => projectReleases.find((release) => release.uid === selectedResourceReleaseUid) ?? null,
    [projectReleases, selectedResourceReleaseUid],
  );
  const selectedReleaseRecord = resourceReleaseDetailQuery.data ?? selectedReleaseFromList;
  const filteredReleases = useMemo(() => {
    const needle = deferredFilterValue.trim().toLowerCase();

    return projectReleases.filter((release) => {
      if (!needle) {
        return true;
      }

      const automaticDeployment = release.automatic_deployment ?? false;

      return [
        release.uid,
        release.subdomain,
        release.name ?? "",
        release.release_kind,
        release.public_url ?? "",
        release.lifecycle_status ?? "",
        release.framework ?? "",
        release.active_deployment?.commit_sha ?? "",
        release.desired_deployment?.commit_sha ?? "",
        release.project_uid ?? "",
        formatReleaseResourceReference(release),
        formatReleaseReadmeReference(release),
        formatReleaseJobReference(release),
        "automatic_deployment",
        formatAutomaticDeploymentValue(automaticDeployment),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [deferredFilterValue, projectReleases]);
  const pagedReleases = useMemo(() => {
    const start = pageIndex * mainSequenceRegistryPageSize;
    return filteredReleases.slice(start, start + mainSequenceRegistryPageSize);
  }, [filteredReleases, pageIndex]);
  const releaseSelection = useRegistrySelection(pagedReleases, (release) => release.uid);
  const projectResourceOptions = useMemo(
    () => (releaseResourcesQuery.data?.results ?? []).map(toProjectResourceOption),
    [releaseResourcesQuery.data?.results],
  );
  const projectImageOptions = useMemo(
    () => readyProjectImages.map(toProjectImagePickerOption),
    [readyProjectImages],
  );
  const gpuTypeOptions = useMemo<PickerOption[]>(
    () =>
      (availableGpuTypesQuery.data ?? []).map((gpuType) => ({
        value: gpuType.value,
        label: gpuType.label,
        keywords: [gpuType.value, gpuType.label],
      })),
    [availableGpuTypesQuery.data],
  );
  const resourceReleaseSummary =
    resourceReleaseSummaryQuery.data ??
    (selectedReleaseRecord ? buildFallbackResourceReleaseSummary(selectedReleaseRecord) : null);
  const selectedResourceReleaseKind =
    getResourceReleaseSummaryResourceType(resourceReleaseSummary) ??
    selectedReleaseRecord?.release_kind ??
    null;
  const resourceReleaseDetailTabs = useMemo(
    (): ReadonlyArray<{ id: ResourceReleaseDetailTabId; label: string }> => {
      if (isStaticSiteReleaseKind(selectedResourceReleaseKind)) {
        return staticSiteResourceReleaseDetailTabs;
      }

      return selectedResourceReleaseKind === "fastapi"
        ? [
            ...baseResourceReleaseDetailTabs,
            { id: "test-api", label: "Test API" },
          ]
        : baseResourceReleaseDetailTabs;
    },
    [selectedResourceReleaseKind],
  );
  const resourceReleaseTitle =
    resourceReleaseSummary?.entity.title ??
    selectedReleaseRecord?.subdomain ??
    (selectedResourceReleaseUid ? `Release ${selectedResourceReleaseUid}` : "Release");
  const persistedPermissionsValue = useMemo(
    () =>
      buildPermissionValue(
        resourceReleaseCanViewQuery.data,
        resourceReleaseCanEditQuery.data,
      ),
    [resourceReleaseCanEditQuery.data, resourceReleaseCanViewQuery.data],
  );
  const permissionUsers = useMemo<RbacAssignableUser[]>(() => {
    const usersById = new Map<string, RbacAssignableUser>();

    for (const user of permissionCandidateUsersQuery.data ?? []) {
      const normalizedId = resolvePermissionEntityId(user);

      if (normalizedId === null) {
        continue;
      }

      usersById.set(String(normalizedId), {
        id: normalizedId,
        email: user.email,
        name: formatPermissionUserName(user),
      });
    }

    for (const user of [
      ...(resourceReleaseCanViewQuery.data?.users ?? []),
      ...(resourceReleaseCanEditQuery.data?.users ?? []),
    ]) {
      const normalizedId = resolvePermissionEntityId(user);

      if (normalizedId === null) {
        continue;
      }

      usersById.set(String(normalizedId), {
        id: normalizedId,
        email: user.email,
        name: formatPermissionUserName(user),
      });
    }

    if (sessionUser) {
      const normalizedId = resolvePermissionEntityId(sessionUser);

      if (normalizedId !== null) {
        const existingUser = usersById.get(String(normalizedId));

        usersById.set(String(normalizedId), {
          id: normalizedId,
          email: sessionUser.email,
          name: sessionUser.name || existingUser?.name || sessionUser.email,
        });
      }
    }

    return [...usersById.values()].sort((left, right) => left.email.localeCompare(right.email));
  }, [
    permissionCandidateUsersQuery.data,
    resourceReleaseCanEditQuery.data?.users,
    resourceReleaseCanViewQuery.data?.users,
    sessionUser,
  ]);
  const permissionTeams = useMemo<RbacAssignableTeam[]>(() => {
    const teamsById = new Map<string, RbacAssignableTeam>();

    for (const team of permissionTeamsQuery.data ?? []) {
      const normalizedId = resolvePermissionEntityId(team);

      if (normalizedId === null) {
        continue;
      }

      teamsById.set(String(normalizedId), {
        id: normalizedId,
        name: team.name,
        description: team.description,
        memberCount: team.member_count,
      });
    }

    for (const team of [
      ...(resourceReleaseCanViewQuery.data?.teams ?? []),
      ...(resourceReleaseCanEditQuery.data?.teams ?? []),
    ]) {
      const normalizedId = resolvePermissionEntityId(team);

      if (normalizedId === null) {
        continue;
      }

      teamsById.set(String(normalizedId), {
        id: normalizedId,
        name: team.name,
        description: team.description,
        memberCount: team.member_count,
      });
    }

    return [...teamsById.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [
    permissionTeamsQuery.data,
    resourceReleaseCanEditQuery.data?.teams,
    resourceReleaseCanViewQuery.data?.teams,
  ]);
  const permissionsTabLoading =
    permissionCandidateUsersQuery.isLoading ||
    permissionTeamsQuery.isLoading ||
    resourceReleaseCanViewQuery.isLoading ||
    resourceReleaseCanEditQuery.isLoading;
  const permissionsTabError =
    permissionCandidateUsersQuery.error ??
    permissionTeamsQuery.error ??
    resourceReleaseCanViewQuery.error ??
    resourceReleaseCanEditQuery.error ??
    null;
  const releaseBulkActions =
    releaseSelection.selectedCount > 0
      ? [
          {
            id: "delete-releases",
            label:
              releaseSelection.selectedCount === 1
                ? "Delete selected release"
                : "Delete selected releases",
            icon: Trash2,
            tone: "danger" as const,
            onSelect: () => {
              deleteResourceReleaseMutation.reset();
              setReleasesPendingDelete(releaseSelection.selectedItems);
            },
          },
        ]
      : [];

  const createResourceReleaseMutation = useMutation<
    ResourceReleaseRecord | ProjectExecutorAgentServiceRecord,
    Error,
    CreateResourceReleaseMutationInput
  >({
    mutationFn: async (input) =>
      isProjectAgentCreateInput(input)
        ? getOrCreateProjectExecutorAgentService({
            project: input.project,
            project_related_image: input.project_related_image,
            cpu_request: input.cpu_request,
            memory_request: input.memory_request,
            gpu_request: input.gpu_request,
            gpu_type: input.gpu_type,
            spot: input.spot,
          })
        : createResourceRelease(input),
    onSuccess: async (result, input) => {
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "resource-releases"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "resource-releases", "resources", projectUid],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "job-images", projectUid],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "jobs", projectUid],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", projectUid],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "deploy-history", projectUid],
      });

      const isProjectAgentMode = isProjectAgentCreateInput(input);
      let successTitle: string;
      let successDescription: string;
      let successVariant: "success" | "info" = "success";

      if (isProjectAgentMode) {
        const projectAgentResult = result as ProjectExecutorAgentServiceRecord;
        const backendDetail = projectAgentResult.detail?.trim();
        const agentStillPending =
          projectAgentResult.image_building === true ||
          projectAgentResult.image_status === "building" ||
          projectAgentResult.build_status === "WORKING" ||
          projectAgentResult.created_service === false ||
          projectAgentResult.created_backing_job === false;

        successTitle = agentStillPending ? "Project agent pending" : "Project agent configured";
        successDescription =
          backendDetail && backendDetail.length > 0
            ? backendDetail
            : "The project execution agent service is ready for the selected image.";
        successVariant = agentStillPending ? "info" : "success";
      } else {
        const release = result as ResourceReleaseRecord;
        successTitle = `${formatReleaseKind(release.release_kind)} release created`;
        successDescription = `${release.subdomain} is now available in this project.`;
      }

      toast({
        variant: successVariant,
        title: successTitle,
        description: successDescription,
      });

      setCreateDialogOpen(false);
      setCreateReleaseKind(null);
      setSelectedResourceUid("");
      setSelectedImageUid("");
      setComputeState(createDefaultReleaseComputeState());
      setCreateAutomaticDeployment(false);
      setStaticSiteFormState(createDefaultStaticSiteFormState());
      setStaticSiteName("");
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Resource release creation failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const deleteResourceReleaseMutation = useMutation({
    mutationFn: async (releases: ResourceReleaseRecord[]) => {
      const staticSiteReleases = releases.filter((release) =>
        isStaticSiteReleaseKind(release.release_kind),
      );
      const runtimeReleaseUids = releases
        .filter((release) => !isStaticSiteReleaseKind(release.release_kind))
        .map((release) => release.uid);
      const runtimeResult =
        runtimeReleaseUids.length > 0
          ? await bulkDeleteResourceReleases(runtimeReleaseUids)
          : { deleted_count: 0 };

      await Promise.all(
        staticSiteReleases.map((release) => deleteResourceRelease(release.uid)),
      );

      return {
        deleted_count:
          (runtimeResult.deleted_count ?? runtimeReleaseUids.length) +
          staticSiteReleases.length,
        static_site_count: staticSiteReleases.length,
      };
    },
    onSuccess: async (result, releases) => {
      const deletedCount = result.deleted_count ?? releases.length;
      const staticSiteCount = result.static_site_count ?? 0;
      setReleasesPendingDelete([]);
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "resource-releases"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "summary", projectUid],
      });
      await queryClient.invalidateQueries({
        queryKey: ["main_sequence", "projects", "deploy-history", projectUid],
      });

      if (deletedCount > 0) {
        toast({
          variant: "success",
          title:
            staticSiteCount > 0
              ? "Resource release deletion requested"
              : deletedCount === 1
                ? "Resource release deleted"
                : "Resource releases deleted",
          description:
            staticSiteCount > 0
              ? `${staticSiteCount} static-site release deletion ${staticSiteCount === 1 ? "was" : "were"} queued.`
              : deletedCount === 1
              ? `${releases[0]?.subdomain ?? "Release"} was deleted.`
              : `${deletedCount} resource releases were deleted.`,
        });
      }

      releaseSelection.clearSelection();
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Resource release deletion failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const updateResourceReleaseDeploymentMutation = useMutation({
    mutationFn: async (automaticDeployment: boolean) => {
      if (!selectedResourceReleaseUid) {
        throw new Error("Select a resource release before updating automatic_deployment.");
      }

      return updateResourceRelease(selectedResourceReleaseUid, {
        automatic_deployment: automaticDeployment,
      });
    },
    onSuccess: async (release) => {
      setDeploymentDraftAutomaticDeployment(release.automatic_deployment ?? false);
      setHasUserEditedDeployment(false);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "projects", "resource-releases"],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "main_sequence",
            "projects",
            "resource-releases",
            "detail",
            selectedResourceReleaseUid,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "main_sequence",
            "projects",
            "resource-releases",
            "summary",
            selectedResourceReleaseUid,
          ],
        }),
      ]);

      toast({
        variant: "success",
        title: "automatic_deployment updated",
        description: `${release.subdomain} automatic_deployment is ${formatAutomaticDeploymentValue(release.automatic_deployment ?? false)}.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "automatic_deployment update failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const deployCurrentResourceReleaseVersionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedResourceReleaseUid) {
        throw new Error("Select a resource release before deploying the current version.");
      }

      return deployResourceReleaseCurrentVersion(selectedResourceReleaseUid);
    },
    onSuccess: async (run) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            "main_sequence",
            "projects",
            "resource-releases",
            "deployment-runs",
            selectedResourceReleaseUid,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "main_sequence",
            "projects",
            "resource-releases",
            "detail",
            selectedResourceReleaseUid,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ["main_sequence", "projects", "resource-releases"],
        }),
      ]);

      toast({
        variant: "success",
        title: "Manual deployment requested",
        description: `${formatReleaseKind(run.target.kind ?? run.target_type)} deployment run is ${formatStatusLabel(run.state)}.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Manual deployment failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async (nextValue: RbacAssignmentValue) => {
      if (!selectedResourceReleaseUid) {
        return {
          changed: false,
          value: normalizePermissionValue(nextValue),
        };
      }

      const normalizedCurrentValue = normalizePermissionValue(permissionsValue);
      const normalizedNextValue = normalizePermissionValue(nextValue);
      const operations = buildPermissionOperations(
        normalizedCurrentValue,
        normalizedNextValue,
      );

      for (const operation of operations) {
        await updateShareableObjectPermission({
          objectUrl: resourceReleasePermissionsObjectUrl,
          objectId: selectedResourceReleaseUid,
          principalType: operation.principalType,
          accessLevel: operation.accessLevel,
          operation: operation.operation,
          principalId: operation.principalId,
        });
      }

      return {
        changed: operations.length > 0,
        value: normalizedNextValue,
      };
    },
    onSuccess: async ({ changed, value }) => {
      setPermissionsValue(value);

      if (!changed || !selectedResourceReleaseUid) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [
            "main_sequence",
            "permissions",
            resourceReleasePermissionsObjectUrl,
            selectedResourceReleaseUid,
            "view",
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "main_sequence",
            "permissions",
            resourceReleasePermissionsObjectUrl,
            selectedResourceReleaseUid,
            "edit",
          ],
        }),
      ]);

      toast({
        variant: "success",
        title: "Permissions updated",
        description: "Resource release access rules were saved.",
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Permissions update failed",
        description: formatMainSequenceError(error),
      });
    },
  });

  useEffect(() => {
    setPageIndex(0);
  }, [deferredFilterValue]);

  useEffect(() => {
    if (!createDialogOpen) {
      setCreateReleaseKind(null);
      setCreateReleaseMode("default");
      setCreateReleaseResourceTypeOverride(null);
      setCreateAutomaticDeployment(false);
      setStaticSiteFormState(createDefaultStaticSiteFormState());
      setStaticSiteName("");
      setSelectedResourceUid("");
      setSelectedImageUid("");
      setComputeState(createDefaultReleaseComputeState());
    }
  }, [createDialogOpen]);

  useEffect(() => {
    if (!createDialogOpen || createReleaseKind) {
      return;
    }

    setCreateDialogOpen(false);
    setCreateReleaseMode("default");
    setCreateReleaseResourceTypeOverride(null);
    setStaticSiteFormState(createDefaultStaticSiteFormState());
    setStaticSiteName("");
    onConsumeCreateReleaseIntent?.();
  }, [
    createDialogOpen,
    createReleaseKind,
    onConsumeCreateReleaseIntent,
  ]);

  useEffect(() => {
    if (!requestedCreateReleaseIntent) {
      handledCreateReleaseIntentRef.current = null;
      return;
    }

    if (handledCreateReleaseIntentRef.current === requestedCreateReleaseIntent) {
      return;
    }

    handledCreateReleaseIntentRef.current = requestedCreateReleaseIntent;

    if (!requestedCreateReleaseIntent) {
      return;
    }

    openCreateReleaseDialog({
      reset: () => createResourceReleaseMutation.reset(),
      setCreateReleaseKind,
      setComputeState,
      setCreateDialogOpen,
      setCreateReleaseMode,
      setCreateReleaseResourceTypeOverride,
      setCreateAutomaticDeployment,
      setStaticSiteFormState,
      setStaticSiteName,
      releaseKind: "agent",
      mode: "project-agent",
      resourceTypeOverride: projectAgentCardResourceType,
    });
    onConsumeCreateReleaseIntent?.();
  }, [
    createResourceReleaseMutation,
    onConsumeCreateReleaseIntent,
    requestedCreateReleaseIntent,
  ]);

  useEffect(() => {
    if (!createDialogOpen || createReleaseMode === "static-site") {
      return;
    }

    if (!readyProjectImages.some((image) => image.uid === selectedImageUid)) {
      setSelectedImageUid(readyProjectImages[0]?.uid ?? "");
    }
  }, [createDialogOpen, createReleaseMode, readyProjectImages, selectedImageUid]);

  useEffect(() => {
    if (!createDialogOpen || createReleaseMode !== "default") {
      return;
    }

    if (!projectResourceOptions.some((option) => option.value === selectedResourceUid)) {
      setSelectedResourceUid(projectResourceOptions[0]?.value ?? "");
    }
  }, [createDialogOpen, createReleaseMode, projectResourceOptions, selectedResourceUid]);

  useEffect(() => {
    if (!createDialogOpen || createReleaseMode === "static-site") {
      return;
    }

    if (!projectImageOptions.some((option) => option.value === selectedImageUid)) {
      setSelectedImageUid(projectImageOptions[0]?.value ?? "");
    }
  }, [createDialogOpen, createReleaseMode, projectImageOptions, selectedImageUid]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredReleases.length / mainSequenceRegistryPageSize));

    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
    }
  }, [filteredReleases.length, pageIndex]);

  function closeStaticSiteViewer() {
    staticSiteViewerRequestIdRef.current += 1;
    setStaticSiteViewerState(null);
  }

  async function openStaticSiteViewer(field: SummaryField) {
    const exchangeUrl = field.href?.trim();

    if (!exchangeUrl) {
      return;
    }

    const requestId = staticSiteViewerRequestIdRef.current + 1;
    staticSiteViewerRequestIdRef.current = requestId;
    setStaticSiteViewerState({ status: "loading" });

    try {
      const launchUrl = requireStaticSiteExchangeLaunchUrl(
        await fetchResourceReleaseExchangeLaunch(exchangeUrl),
      );
      resolveStaticSiteEmbedOrigin(launchUrl);

      if (staticSiteViewerRequestIdRef.current !== requestId) {
        return;
      }

      setStaticSiteViewerState({ status: "ready", launchUrl });
    } catch (error) {
      if (staticSiteViewerRequestIdRef.current !== requestId) {
        return;
      }

      setStaticSiteViewerState(
        error instanceof MainSequenceApiError && error.status === 403
          ? {
              status: "error",
              title: "Access denied",
              detail: formatMainSequenceError(error),
            }
          : {
              status: "error",
              title: "Unable to open static site",
              detail: formatMainSequenceError(error),
            },
      );
    }
  }

  function handleSummaryFieldLink(field: SummaryField) {
    if (field.key === "public_url" && field.kind === "link" && field.iframe === true) {
      void openStaticSiteViewer(field);
      return;
    }

    const projectLinkUid = getProjectUidFromSummaryHref(field.href);
    if (projectLinkUid) {
      onOpenProjectDetail(projectLinkUid);
      return;
    }

    const jobLinkUid = getJobUidFromSummaryHref(field.href);
    if (jobLinkUid) {
      onOpenJobDetail(jobLinkUid);
      return;
    }

    if (field.href) {
      window.open(field.href, "_blank", "noopener,noreferrer");
    }
  }

  const createDialogTitle = createReleaseMode === "project-agent"
    ? "Create Project Agent"
    : createReleaseMode === "static-site"
      ? "Create static site release"
    : createReleaseKind
      ? `Create ${formatReleaseKind(createReleaseKind).toLowerCase()} release`
      : "Create resource release";
  const createDialogVisible = createDialogOpen && Boolean(createReleaseKind);
  const staticSiteCapabilityCatalog = staticSiteCapabilitiesQuery.data;
  const staticSiteCreateFields = useMemo(
    () => getStaticSiteCreateFields(staticSiteCapabilityCatalog),
    [staticSiteCapabilityCatalog],
  );
  const staticSiteCurrentFieldValues = useMemo(
    () => getStaticSiteCurrentFieldValues(staticSiteFormState, projectUid, staticSiteName),
    [projectUid, staticSiteFormState, staticSiteName],
  );
  const staticSiteNameField = getEffectiveStaticSiteCreateField(
    getStaticSiteCreateField(staticSiteCreateFields, "name"),
    staticSiteCurrentFieldValues,
  );
  const staticSiteAutomaticDeploymentField = getEffectiveStaticSiteCreateField(
    getStaticSiteCreateField(staticSiteCreateFields, "automatic_deployment"),
    staticSiteCurrentFieldValues,
  );
  const staticSiteRootDirectoryField = getEffectiveStaticSiteCreateField(
    getStaticSiteCreateField(staticSiteCreateFields, "root_directory"),
    staticSiteCurrentFieldValues,
  );
  const staticSiteFrameworkField = getEffectiveStaticSiteCreateField(
    getStaticSiteCreateField(staticSiteCreateFields, "framework"),
    staticSiteCurrentFieldValues,
  );
  const staticSiteNodeVersionField = getEffectiveStaticSiteCreateField(
    getStaticSiteCreateField(staticSiteCreateFields, "node_version"),
    staticSiteCurrentFieldValues,
  );
  const staticSiteOutputDirectoryField = getEffectiveStaticSiteCreateField(
    getStaticSiteCreateField(staticSiteCreateFields, "output_directory"),
    staticSiteCurrentFieldValues,
  );
  const staticSiteRoutingModeField = getEffectiveStaticSiteCreateField(
    getStaticSiteCreateField(staticSiteCreateFields, "routing_mode"),
    staticSiteCurrentFieldValues,
  );
  const staticSiteSpaEntryFileField = getEffectiveStaticSiteCreateField(
    getStaticSiteCreateField(staticSiteCreateFields, "spa_entry_file"),
    staticSiteCurrentFieldValues,
  );
  const staticSiteBuildEnvironmentField = getEffectiveStaticSiteCreateField(
    getStaticSiteCreateField(staticSiteCreateFields, "build_environment"),
    staticSiteCurrentFieldValues,
  );
  const staticSiteFrameworkOptions = useMemo<PickerOption[]>(
    () => staticSiteChoiceOptions(staticSiteFrameworkField),
    [staticSiteFrameworkField],
  );
  const staticSiteNodeVersionOptions = useMemo<PickerOption[]>(
    () => staticSiteChoiceOptions(staticSiteNodeVersionField),
    [staticSiteNodeVersionField],
  );
  const staticSiteRoutingModeOptions = useMemo<PickerOption[]>(
    () => staticSiteChoiceOptions(staticSiteRoutingModeField),
    [staticSiteRoutingModeField],
  );
  const staticSiteRequiredConfigurationMissing = [
    staticSiteNameField,
    staticSiteAutomaticDeploymentField,
    staticSiteRootDirectoryField,
    staticSiteFrameworkField,
    staticSiteNodeVersionField,
    staticSiteOutputDirectoryField,
    staticSiteRoutingModeField,
    staticSiteSpaEntryFileField,
    staticSiteBuildEnvironmentField,
  ].some((field) => staticSiteRequiredFieldIsMissing(field, staticSiteCurrentFieldValues));
  const staticSiteCreateInput = useMemo(
    () => buildStaticSiteCreateRequest(staticSiteCreateFields, staticSiteCurrentFieldValues),
    [staticSiteCreateFields, staticSiteCurrentFieldValues],
  );
  const parsedGpuRequest = computeState.gpuRequest ? Number(computeState.gpuRequest) : undefined;
  const costEstimateResources = useMemo(
    () =>
      buildMainSequenceCostEstimateResources({
        cpuRequest: computeState.cpuRequest,
        memoryRequest: computeState.memoryRequest,
        gpuRequest: computeState.gpuRequest,
        gpuType: computeState.gpuType,
        spot: computeState.spot,
      }),
    [
      computeState.cpuRequest,
      computeState.gpuRequest,
      computeState.gpuType,
      computeState.memoryRequest,
      computeState.spot,
    ],
  );
  useEffect(() => {
    if (
      !createDialogOpen ||
      createReleaseMode !== "static-site" ||
      !staticSiteCapabilityCatalog
    ) {
      return;
    }

    setStaticSiteFormState(
      createStaticSiteFormStateFromCapabilities(staticSiteCapabilityCatalog, projectUid),
    );
    setStaticSiteName(
      readFormString(
        getStaticSiteCreateField(
          getStaticSiteCreateFields(staticSiteCapabilityCatalog),
          "name",
        )?.default,
      ),
    );
  }, [createDialogOpen, createReleaseMode, projectUid, staticSiteCapabilityCatalog]);
  const gpuSelectionIsValid =
    (!computeState.gpuRequest && !computeState.gpuType.trim()) ||
    (Boolean(computeState.gpuRequest) &&
      parsedGpuRequest !== undefined &&
      Number.isFinite(parsedGpuRequest) &&
      parsedGpuRequest > 0 &&
      computeState.gpuType.trim().length > 0);
  const releaseReadme = getResourceReleaseReadme(resourceReleaseSummaryQuery.data?.extensions);
  const readmeFilesize = formatReadmeFilesize(releaseReadme?.filesize);
  const selectedReleaseAutomaticDeployment =
    selectedReleaseRecord?.automatic_deployment ?? false;
  const deploymentPolicyIsDirty =
    deploymentDraftAutomaticDeployment !== selectedReleaseAutomaticDeployment;
  const releaseDetailLoading = resourceReleaseDetailQuery.isLoading && !selectedReleaseRecord;
  const releaseReadOnlyFields = [
    ["UID", selectedReleaseRecord?.uid ?? selectedResourceReleaseUid],
    ["Subdomain", selectedReleaseRecord?.subdomain ?? resourceReleaseTitle],
    ["Resource UID", getResourceReleaseResourceUid(selectedReleaseRecord)],
    ["README Resource UID", getResourceReleaseReadmeResourceUid(selectedReleaseRecord) ?? "Not linked"],
    ["Related Job UID", getResourceReleaseRelatedJobUid(selectedReleaseRecord)],
    ["Release kind", selectedReleaseRecord?.release_kind ?? selectedResourceReleaseKind],
  ] as const;

  useEffect(() => {
    staticSiteViewerRequestIdRef.current += 1;
    setStaticSiteViewerState(null);
    setSelectedDetailTabId("readme");
    setHasUserEditedDeployment(false);
    setDeploymentDraftAutomaticDeployment(false);
  }, [selectedResourceReleaseUid]);

  useEffect(() => {
    if (!selectedReleaseRecord || hasUserEditedDeployment) {
      return;
    }

    setDeploymentDraftAutomaticDeployment(selectedReleaseRecord.automatic_deployment ?? false);
  }, [
    hasUserEditedDeployment,
    selectedReleaseRecord,
    selectedReleaseRecord?.automatic_deployment,
    selectedReleaseRecord?.uid,
  ]);

  useEffect(() => {
    if (resourceReleaseDetailTabs.some((tab) => tab.id === selectedDetailTabId)) {
      return;
    }

    setSelectedDetailTabId(resourceReleaseDetailTabs[0]?.id ?? "readme");
  }, [resourceReleaseDetailTabs, selectedDetailTabId]);

  useEffect(() => {
    setPermissionsValue(emptyPermissionAssignments);
  }, [selectedResourceReleaseUid]);

  useEffect(() => {
    if (
      selectedDetailTabId !== "permissions" ||
      !selectedResourceReleaseUid ||
      !resourceReleaseCanViewQuery.data ||
      !resourceReleaseCanEditQuery.data
    ) {
      return;
    }

    setPermissionsValue(persistedPermissionsValue);
  }, [
    persistedPermissionsValue,
    resourceReleaseCanEditQuery.data,
    resourceReleaseCanViewQuery.data,
    selectedDetailTabId,
    selectedResourceReleaseUid,
  ]);

  return (
    <div className="space-y-4">
      {selectedResourceReleaseUid ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button
                type="button"
                className="transition-colors hover:text-foreground"
                onClick={onCloseResourceReleaseDetail}
              >
                Resource releases
              </button>
              <span>/</span>
              <span className="text-foreground">{resourceReleaseTitle}</span>
            </div>
            <Button variant="outline" size="sm" onClick={onCloseResourceReleaseDetail}>
              <ArrowLeft className="h-4 w-4" />
              Back to releases
            </Button>
          </div>

          {resourceReleaseSummaryQuery.isLoading && !resourceReleaseSummary ? (
            <Card>
              <CardContent className="flex min-h-48 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading resource release details
                </div>
              </CardContent>
            </Card>
          ) : null}

          {resourceReleaseSummaryQuery.isError ? (
            <Card>
              <CardContent className="p-5">
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(resourceReleaseSummaryQuery.error)}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {resourceReleaseSummary ? (
            <>
              <MainSequenceEntitySummaryCard
                summary={resourceReleaseSummary}
                onFieldLinkClick={handleSummaryFieldLink}
              />

              <Card>
                <CardHeader className="border-b border-border/70 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {resourceReleaseDetailTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={
                          tab.id === selectedDetailTabId
                            ? "rounded-[calc(var(--radius)-8px)] border border-primary/35 bg-primary/12 px-3 py-2 text-sm font-medium text-topbar-foreground"
                            : "rounded-[calc(var(--radius)-8px)] border border-border/70 bg-background/24 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-background/36 hover:text-foreground"
                        }
                        onClick={() => setSelectedDetailTabId(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="pt-5">
                  {selectedDetailTabId === "readme" ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            README
                          </CardTitle>
                          <CardDescription>
                            {releaseReadme?.path ?? "No README path available."}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {releaseReadme?.last_modified_display ? (
                            <Badge variant="neutral">{releaseReadme.last_modified_display}</Badge>
                          ) : null}
                          {readmeFilesize ? <Badge variant="neutral">{readmeFilesize}</Badge> : null}
                        </div>
                      </div>

                      {releaseReadme?.notice ? (
                        <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
                          {releaseReadme.notice}
                        </div>
                      ) : null}

                      {releaseReadme?.html ? (
                        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-4">
                          <div
                            className="text-sm leading-6 text-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded-[calc(var(--radius)-10px)] [&_code]:bg-background/70 [&_code]:px-1.5 [&_code]:py-0.5 [&_li]:ml-5 [&_li]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-4 [&_pre]:overflow-x-auto [&_pre]:rounded-[calc(var(--radius)-8px)] [&_pre]:border [&_pre]:border-border/70 [&_pre]:bg-background/70 [&_pre]:p-3 [&_ul]:ml-5 [&_ul]:list-disc"
                            dangerouslySetInnerHTML={{ __html: releaseReadme.html }}
                          />
                        </div>
                      ) : (
                        <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
                          {releaseReadme?.empty_message ?? "No README preview available."}
                        </div>
                      )}
                    </div>
                  ) : selectedDetailTabId === "deployment" ? (
                    <div className="space-y-5">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
                        <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-4 py-4">
                          <div className="space-y-1">
                            <CardTitle className="text-base">automatic_deployment</CardTitle>
                            <CardDescription>
                              Only the ResourceRelease automatic_deployment field is editable here.
                            </CardDescription>
                          </div>

                          {releaseDetailLoading ? (
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading release policy
                            </div>
                          ) : null}

                          {resourceReleaseDetailQuery.isError && !selectedReleaseRecord ? (
                            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                              {formatMainSequenceError(resourceReleaseDetailQuery.error)}
                            </div>
                          ) : null}

                          <ResourceReleaseDeploymentPolicyToggle
                            automaticDeployment={deploymentDraftAutomaticDeployment}
                            disabled={updateResourceReleaseDeploymentMutation.isPending}
                            onChange={(value) => {
                              updateResourceReleaseDeploymentMutation.reset();
                              setHasUserEditedDeployment(true);
                              setDeploymentDraftAutomaticDeployment(value);
                            }}
                          />

                          {updateResourceReleaseDeploymentMutation.isError ? (
                            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                              {formatMainSequenceError(updateResourceReleaseDeploymentMutation.error)}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                updateResourceReleaseDeploymentMutation.reset();
                                setHasUserEditedDeployment(false);
                                setDeploymentDraftAutomaticDeployment(
                                  selectedReleaseAutomaticDeployment,
                                );
                              }}
                              disabled={
                                updateResourceReleaseDeploymentMutation.isPending ||
                                !deploymentPolicyIsDirty
                              }
                            >
                              Reset
                            </Button>
                            <Button
                              type="button"
                              onClick={() =>
                                updateResourceReleaseDeploymentMutation.mutate(
                                  deploymentDraftAutomaticDeployment,
                                )
                              }
                              disabled={
                                updateResourceReleaseDeploymentMutation.isPending ||
                                !deploymentPolicyIsDirty ||
                                !selectedResourceReleaseUid
                              }
                            >
                              {updateResourceReleaseDeploymentMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              Save automatic_deployment
                            </Button>
                          </div>
                        </section>

                        <section className="space-y-4 rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/18 px-4 py-4">
                          <div className="space-y-1">
                            <CardTitle className="text-base">Manual deploy</CardTitle>
                            <CardDescription>
                              Rotate this release to the current synced project version now.
                            </CardDescription>
                          </div>
                          <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
                            Manual deploy is separate from automatic_deployment. It can rotate the
                            release even when automatic_deployment is false.
                          </div>
                          {deployCurrentResourceReleaseVersionMutation.isError ? (
                            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                              {formatMainSequenceError(
                                deployCurrentResourceReleaseVersionMutation.error,
                              )}
                            </div>
                          ) : null}
                          <Button
                            type="button"
                            onClick={() => deployCurrentResourceReleaseVersionMutation.mutate()}
                            disabled={
                              deployCurrentResourceReleaseVersionMutation.isPending ||
                              !selectedResourceReleaseUid
                            }
                          >
                            {deployCurrentResourceReleaseVersionMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            Deploy current version
                          </Button>
                        </section>
                      </div>

                      <section className="space-y-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-foreground">
                            Release contract
                          </div>
                          <p className="text-sm text-muted-foreground">
                            These fields are read-only in this edit surface.
                          </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {releaseReadOnlyFields.map(([label, value]) => (
                            <ResourceReleaseReadOnlyField
                              key={label}
                              label={label}
                              value={value}
                            />
                          ))}
                        </div>
                      </section>

                      <ResourceReleaseDeploymentRunsTable
                        error={resourceReleaseDeploymentRunsQuery.error}
                        isFetching={resourceReleaseDeploymentRunsQuery.isFetching}
                        isLoading={resourceReleaseDeploymentRunsQuery.isLoading}
                        onRefresh={() => {
                          void resourceReleaseDeploymentRunsQuery.refetch();
                        }}
                        runs={resourceReleaseDeploymentRunsQuery.data ?? []}
                      />
                    </div>
                  ) : selectedDetailTabId === "test-api" ? (
                    resourceReleaseSummary && selectedResourceReleaseUid ? (
                      <MainSequenceResourceReleaseApiTestTab
                        releaseSummary={resourceReleaseSummary}
                        resourceReleaseUid={selectedResourceReleaseUid}
                      />
                    ) : null
                  ) : (
                    <div className="space-y-4">
                      {permissionsTabLoading ? (
                        <div className="flex min-h-48 items-center justify-center">
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading permissions
                          </div>
                        </div>
                      ) : null}

                      {!permissionsTabLoading && permissionsTabError ? (
                        <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                          {formatMainSequenceError(permissionsTabError)}
                        </div>
                      ) : null}

                      {!permissionsTabLoading && !permissionsTabError ? (
                        <div className="space-y-3">
                          {updatePermissionsMutation.isPending ? (
                            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
                              Saving permission changes
                            </div>
                          ) : null}

                          <div
                            className={
                              updatePermissionsMutation.isPending
                                ? "pointer-events-none opacity-70"
                                : undefined
                            }
                          >
                            <RbacAssignmentMatrix
                              scopes={resourceReleaseAccessScopes}
                              users={permissionUsers}
                              teams={permissionTeams}
                              value={permissionsValue}
                              onChange={(nextValue) => {
                                if (updatePermissionsMutation.isPending) {
                                  return;
                                }

                                updatePermissionsMutation.mutate(nextValue);
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Resource releases</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Runtime and static-site releases scoped to this project.
              </p>
            </div>
            <MainSequenceRegistrySearch
              actionMenuLabel="Release actions"
              accessory={
                <>
                  <Badge variant="neutral">{`${filteredReleases.length} releases`}</Badge>
                  <AdminMenu
                    actions={[
                      {
                        icon: LayoutDashboard,
                        label: "Dashboard release",
                        onSelect: () => {
                          openCreateReleaseDialog({
                            reset: () => createResourceReleaseMutation.reset(),
                            setCreateReleaseKind,
                            setComputeState,
                            setCreateDialogOpen,
                            setCreateReleaseMode,
                            setCreateReleaseResourceTypeOverride,
                            setCreateAutomaticDeployment,
                            setStaticSiteFormState,
                            setStaticSiteName,
                            releaseKind: "streamlit_dashboard",
                          });
                        },
                      },
                      {
                        icon: Bot,
                        label: "Agent release",
                        onSelect: () => {
                          openCreateReleaseDialog({
                            reset: () => createResourceReleaseMutation.reset(),
                            setCreateReleaseKind,
                            setComputeState,
                            setCreateDialogOpen,
                            setCreateReleaseMode,
                            setCreateReleaseResourceTypeOverride,
                            setCreateAutomaticDeployment,
                            setStaticSiteFormState,
                            setStaticSiteName,
                            releaseKind: "agent",
                          });
                        },
                      },
                      {
                        icon: Server,
                        label: "FastAPI release",
                        onSelect: () => {
                          openCreateReleaseDialog({
                            reset: () => createResourceReleaseMutation.reset(),
                            setCreateReleaseKind,
                            setComputeState,
                            setCreateDialogOpen,
                            setCreateReleaseMode,
                            setCreateReleaseResourceTypeOverride,
                            setCreateAutomaticDeployment,
                            setStaticSiteFormState,
                            setStaticSiteName,
                            releaseKind: "fastapi",
                          });
                        },
                      },
                      {
                        icon: Globe,
                        label: "Static site release",
                        onSelect: () => {
                          openCreateReleaseDialog({
                            reset: () => createResourceReleaseMutation.reset(),
                            setCreateReleaseKind,
                            setComputeState,
                            setCreateDialogOpen,
                            setCreateReleaseMode,
                            setCreateReleaseResourceTypeOverride,
                            setCreateAutomaticDeployment,
                            setStaticSiteFormState,
                            setStaticSiteName,
                            releaseKind: "static_site",
                            mode: "static-site",
                          });
                        },
                      },
                    ]}
                    align="end"
                    menuClassName="w-60"
                    triggerLabel="Create resource release"
                    triggerClassName="inline-flex h-8 items-center justify-center gap-2 rounded-[calc(var(--radius)-6px)] bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                    triggerContent={
                      <>
                        <Plus className="h-4 w-4" />
                        <span>Create release</span>
                        <ChevronDown className="h-4 w-4" />
                      </>
                    }
                  />
                </>
              }
              bulkActions={releaseBulkActions}
              clearSelectionLabel="Clear releases"
              onClearSelection={releaseSelection.clearSelection}
              renderSelectionSummary={(selectionCount) => `${selectionCount} releases selected`}
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              placeholder="Filter by name, subdomain, kind, automatic_deployment, release UID, or project UID"
              searchClassName="max-w-lg"
              selectionCount={releaseSelection.selectedCount}
            />
          </div>

          {resourceReleasesQuery.isLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading resource releases
              </div>
            </div>
          ) : null}

          {resourceReleasesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(resourceReleasesQuery.error)}
            </div>
          ) : null}

          {!resourceReleasesQuery.isLoading &&
          !resourceReleasesQuery.isError &&
          filteredReleases.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/35 text-primary">
                <Rocket className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-foreground">No resource releases found</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a dashboard, agent, FastAPI, or static-site release to start populating this registry.
              </p>
            </div>
          ) : null}

          {!resourceReleasesQuery.isLoading &&
          !resourceReleasesQuery.isError &&
          filteredReleases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="w-12 px-3 pb-2">
                      <MainSequenceSelectionCheckbox
                        ariaLabel="Select all visible resource releases"
                        checked={releaseSelection.allSelected}
                        indeterminate={releaseSelection.someSelected}
                        onChange={releaseSelection.toggleAll}
                      />
                    </th>
                    <th className="px-4 pb-2">Release</th>
                    <th className="px-4 pb-2">Kind</th>
                    <th className="px-4 pb-2">automatic_deployment</th>
                    <th className="px-4 pb-2">Project UID</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedReleases.map((release) => {
                    const selected = releaseSelection.isSelected(release.uid);
                    const automaticDeployment = release.automatic_deployment ?? false;

                    return (
                      <tr key={release.uid}>
                        <td className={getRegistryTableCellClassName(selected, "left")}>
                          <MainSequenceSelectionCheckbox
                            ariaLabel={`Select ${release.subdomain}`}
                            checked={selected}
                            onChange={() => releaseSelection.toggleSelection(release.uid)}
                          />
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <div className="flex items-start gap-2">
                            <Rocket className="mt-0.5 h-4 w-4 text-muted-foreground" />
                            <div>
                              <button
                                type="button"
                                className="group inline-flex items-center gap-1.5 rounded-sm text-left font-medium text-foreground underline decoration-border/50 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
                                onClick={() => onOpenResourceReleaseDetail(release.uid)}
                                title={`Open ${release.subdomain}`}
                              >
                                <span>{getResourceReleaseDisplayName(release)}</span>
                                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                              </button>
                              <div className="mt-1 break-all text-xs text-muted-foreground">
                                {release.subdomain}
                              </div>
                              <div className="mt-1 break-all text-xs text-muted-foreground">
                                {`Release UID ${release.uid}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <Badge variant={getReleaseKindBadgeVariant(release.release_kind)}>
                            {formatReleaseKind(release.release_kind)}
                          </Badge>
                        </td>
                        <td className={getRegistryTableCellClassName(selected)}>
                          <AutomaticDeploymentBoolean automaticDeployment={automaticDeployment} />
                        </td>
                        <td className={getRegistryTableCellClassName(selected, "right")}>
                          <div className="break-all text-foreground">
                            {getResourceReleaseProjectUid(release) ?? projectUid}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {!resourceReleasesQuery.isLoading &&
          !resourceReleasesQuery.isError &&
          filteredReleases.length > 0 ? (
            <MainSequenceRegistryPagination
              count={filteredReleases.length}
              itemLabel="releases"
              pageIndex={pageIndex}
              pageSize={mainSequenceRegistryPageSize}
              onPageChange={setPageIndex}
            />
          ) : null}
        </>
      )}

      <Dialog
        title={createDialogTitle}
        open={createDialogVisible}
        onClose={() => {
          if (!createResourceReleaseMutation.isPending) {
            setCreateDialogOpen(false);
            onConsumeCreateReleaseIntent?.();
          }
        }}
        className="max-w-[min(760px,calc(100vw-24px))]"
      >
        <div className="space-y-5">
          {createReleaseMode === "project-agent" ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-secondary/70 px-4 py-3 text-sm text-secondary-foreground">
              Project execution agents are unique per project. Republishing the agent with a
              different image will override this project agent functionality.
            </div>
          ) : null}

          {createReleaseMode === "static-site" ? (
            <div className="space-y-4">
              <div className="rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/24 px-4 py-3 text-sm text-muted-foreground">
                Static-site releases are created from the current project branch. The initial
                deployment is queued by the create request.
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span>{staticSiteNameField?.required ? "Site name *" : "Site name"}</span>
                  {staticSiteNameField?.help_text ? (
                    <span
                      aria-label={staticSiteNameField.help_text}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/70 text-muted-foreground"
                      title={staticSiteNameField.help_text}
                    >
                      <Info className="h-3 w-3" aria-hidden="true" />
                    </span>
                  ) : null}
                </div>
                <Input
                  value={staticSiteName}
                  onChange={(event) => {
                    createResourceReleaseMutation.reset();
                    setStaticSiteName(event.target.value);
                  }}
                  placeholder="Documentation"
                  disabled={
                    createResourceReleaseMutation.isPending ||
                    staticSiteNameField?.enabled === false
                  }
                />
              </div>
              {staticSiteCapabilitiesQuery.isLoading ? (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading static-site capabilities
                </div>
              ) : null}
              {staticSiteCapabilitiesQuery.isError ? (
                <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {formatMainSequenceError(staticSiteCapabilitiesQuery.error)}
                </div>
              ) : null}
              {staticSiteCreateFields.length > 0 ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <MainSequenceResourceField
                      label={staticSiteFrameworkField?.required ? "Framework *" : "Framework"}
                      helperText={staticSiteFrameworkField?.help_text}
                    >
                      <PickerField
                        value={staticSiteFormState.framework}
                        onChange={(value) => {
                          createResourceReleaseMutation.reset();
                          setStaticSiteFormState((current) =>
                            applyStaticSiteDependentDefaults(
                              {
                                ...current,
                                framework: value,
                              },
                              staticSiteCreateFields,
                              projectUid,
                              staticSiteName,
                              "framework",
                            ),
                          );
                        }}
                        options={staticSiteFrameworkOptions}
                        placeholder="Select framework"
                        searchPlaceholder="Search frameworks"
                        disabled={
                          createResourceReleaseMutation.isPending ||
                          staticSiteFrameworkField?.enabled === false ||
                          staticSiteFrameworkOptions.length === 0
                        }
                      />
                    </MainSequenceResourceField>

                    <MainSequenceResourceField
                      label={
                        staticSiteRootDirectoryField?.required
                          ? "Root directory *"
                          : "Root directory"
                      }
                      helperText={staticSiteRootDirectoryField?.help_text}
                    >
                      <Input
                        value={staticSiteFormState.rootDirectory}
                        onChange={(event) => {
                          createResourceReleaseMutation.reset();
                          setStaticSiteFormState((current) => ({
                            ...current,
                            rootDirectory: event.target.value,
                          }));
                        }}
                        placeholder="Repository root"
                        disabled={
                          createResourceReleaseMutation.isPending ||
                          staticSiteRootDirectoryField?.enabled === false
                        }
                      />
                    </MainSequenceResourceField>

                    <MainSequenceResourceField
                      label={
                        staticSiteOutputDirectoryField?.required
                          ? "Output directory *"
                          : "Output directory"
                      }
                      helperText={staticSiteOutputDirectoryField?.help_text}
                    >
                      <Input
                        value={staticSiteFormState.outputDirectory}
                        onChange={(event) => {
                          createResourceReleaseMutation.reset();
                          setStaticSiteFormState((current) => ({
                            ...current,
                            outputDirectory: event.target.value,
                          }));
                        }}
                        placeholder="dist"
                        disabled={
                          createResourceReleaseMutation.isPending ||
                          staticSiteOutputDirectoryField?.enabled === false
                        }
                      />
                    </MainSequenceResourceField>

                    <MainSequenceResourceField
                      label={
                        staticSiteRoutingModeField?.required
                          ? "Routing mode *"
                          : "Routing mode"
                      }
                      helperText={staticSiteRoutingModeField?.help_text}
                    >
                      <PickerField
                        value={staticSiteFormState.routingMode}
                        onChange={(value) => {
                          createResourceReleaseMutation.reset();
                          setStaticSiteFormState((current) =>
                            applyStaticSiteDependentDefaults(
                              {
                                ...current,
                                routingMode: value,
                              },
                              staticSiteCreateFields,
                              projectUid,
                              staticSiteName,
                              "routing_mode",
                            ),
                          );
                        }}
                        options={staticSiteRoutingModeOptions}
                        placeholder="Select routing mode"
                        disabled={
                          createResourceReleaseMutation.isPending ||
                          staticSiteRoutingModeField?.enabled === false
                        }
                      />
                    </MainSequenceResourceField>

                    <MainSequenceResourceField
                      label={
                        staticSiteSpaEntryFileField?.required
                          ? "SPA entry file *"
                          : "SPA entry file"
                      }
                      helperText={staticSiteSpaEntryFileField?.help_text}
                    >
                      <Input
                        value={staticSiteFormState.spaEntryFile}
                        onChange={(event) => {
                          createResourceReleaseMutation.reset();
                          setStaticSiteFormState((current) => ({
                            ...current,
                            spaEntryFile: event.target.value,
                          }));
                        }}
                        placeholder="/index.html"
                        disabled={
                          createResourceReleaseMutation.isPending ||
                          staticSiteSpaEntryFileField?.enabled === false
                        }
                      />
                    </MainSequenceResourceField>

                    <MainSequenceResourceField
                      label={
                        staticSiteNodeVersionField?.required ? "Node version *" : "Node version"
                      }
                      helperText={staticSiteNodeVersionField?.help_text}
                    >
                      <PickerField
                        value={staticSiteFormState.nodeVersion}
                        onChange={(value) => {
                          createResourceReleaseMutation.reset();
                          setStaticSiteFormState((current) => ({
                            ...current,
                            nodeVersion: value,
                          }));
                        }}
                        options={staticSiteNodeVersionOptions}
                        placeholder="Select Node version"
                        disabled={
                          createResourceReleaseMutation.isPending ||
                          staticSiteNodeVersionField?.enabled === false ||
                          staticSiteNodeVersionOptions.length === 0
                        }
                      />
                    </MainSequenceResourceField>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      automatic_deployment
                    </div>
                    <ResourceReleaseDeploymentPolicyToggle
                      automaticDeployment={staticSiteFormState.automaticDeployment}
                      disabled={
                        createResourceReleaseMutation.isPending ||
                        staticSiteAutomaticDeploymentField?.enabled === false
                      }
                      helpText={staticSiteAutomaticDeploymentField?.help_text}
                      onChange={(value) => {
                        createResourceReleaseMutation.reset();
                        setStaticSiteFormState((current) => ({
                          ...current,
                          automaticDeployment: value,
                        }));
                      }}
                    />
                  </div>

                  <MainSequenceResourceField
                    label="Build environment"
                    helperText={staticSiteBuildEnvironmentField?.help_text}
                  >
                    <Textarea
                      value={staticSiteFormState.buildEnvironmentText}
                      onChange={(event) => {
                        createResourceReleaseMutation.reset();
                        setStaticSiteFormState((current) => ({
                          ...current,
                          buildEnvironmentText: event.target.value,
                        }));
                      }}
                      placeholder="PUBLIC_API_BASE_URL=https://api.example.com"
                      className="min-h-24"
                      disabled={
                        createResourceReleaseMutation.isPending ||
                        staticSiteBuildEnvironmentField?.enabled === false
                      }
                    />
                  </MainSequenceResourceField>
                </>
              ) : null}
            </div>
          ) : null}

          {createReleaseMode !== "static-site" ? (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Image
              </div>
              <PickerField
                value={selectedImageUid}
                onChange={setSelectedImageUid}
                options={projectImageOptions}
                placeholder="Select an image"
                searchPlaceholder="Search images"
                emptyMessage="No ready commit-based images available."
                loading={projectImagesQuery.isLoading}
              />
            </div>
          ) : null}

          {createReleaseMode === "default" ? (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Resource
              </div>
              <PickerField
                value={selectedResourceUid}
                onChange={setSelectedResourceUid}
                options={projectResourceOptions}
                placeholder="Select a resource"
                searchPlaceholder="Search resources"
                emptyMessage={
                  selectedProjectImage
                    ? "No matching resources for this image commit."
                    : "Select an image first."
                }
                disabled={!selectedProjectImage}
                loading={releaseResourcesQuery.isLoading}
              />
            </div>
          ) : null}

          {createReleaseMode === "default" ? (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                automatic_deployment
              </div>
              <ResourceReleaseDeploymentPolicyToggle
                automaticDeployment={createAutomaticDeployment}
                disabled={createResourceReleaseMutation.isPending}
                onChange={(value) => {
                  createResourceReleaseMutation.reset();
                  setCreateAutomaticDeployment(value);
                }}
              />
            </div>
          ) : null}

          {createReleaseMode !== "static-site" ? (
            <MainSequenceResourceRequirementsSection
              costEstimate={{ resources: costEstimateResources }}
              gridClassName="md:grid-cols-2 xl:grid-cols-3"
            >
              <MainSequenceResourceField label="CPU">
                <Input
                  value={computeState.cpuRequest}
                  onChange={(event) => {
                    createResourceReleaseMutation.reset();
                    setComputeState((current) => ({
                      ...current,
                      cpuRequest: event.target.value,
                    }));
                  }}
                  placeholder="100m"
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="Memory">
                <Input
                  value={computeState.memoryRequest}
                  onChange={(event) => {
                    createResourceReleaseMutation.reset();
                    setComputeState((current) => ({
                      ...current,
                      memoryRequest: event.target.value,
                    }));
                  }}
                  placeholder="512Mi"
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="GPUs">
                <PickerField
                  value={computeState.gpuRequest}
                  onChange={(value) => {
                    createResourceReleaseMutation.reset();
                    setComputeState((current) => ({
                      ...current,
                      gpuRequest: value,
                      gpuType: value ? current.gpuType : "",
                    }));
                  }}
                  options={gpuCountOptions}
                  placeholder="No GPU"
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="GPU type">
                <PickerField
                  value={computeState.gpuType}
                  onChange={(value) => {
                    createResourceReleaseMutation.reset();
                    setComputeState((current) => ({
                      ...current,
                      gpuType: value,
                    }));
                  }}
                  options={gpuTypeOptions}
                  placeholder="Select GPU type"
                  searchPlaceholder="Search GPU types"
                  emptyMessage="No GPU types available."
                  searchable={false}
                  loading={availableGpuTypesQuery.isLoading}
                  disabled={!computeState.gpuRequest}
                />
              </MainSequenceResourceField>

              <MainSequenceResourceField label="Capacity">
                <MainSequenceCapacityToggle
                  spot={computeState.spot}
                  onChange={(spot) => {
                    createResourceReleaseMutation.reset();
                    setComputeState((current) => ({
                      ...current,
                      spot,
                    }));
                  }}
                />
              </MainSequenceResourceField>
            </MainSequenceResourceRequirementsSection>
          ) : null}

          {createReleaseMode !== "static-site" && !gpuSelectionIsValid ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
              Select a GPU type when requesting GPUs.
            </div>
          ) : null}

          {createReleaseMode === "default" && releaseResourcesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(releaseResourcesQuery.error)}
            </div>
          ) : null}

          {createReleaseMode !== "static-site" && projectImagesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(projectImagesQuery.error)}
            </div>
          ) : null}

          {createReleaseMode !== "static-site" &&
          computeState.gpuRequest &&
          availableGpuTypesQuery.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(availableGpuTypesQuery.error)}
            </div>
          ) : null}

          {createResourceReleaseMutation.isError ? (
            <div className="rounded-[calc(var(--radius)-6px)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formatMainSequenceError(createResourceReleaseMutation.error)}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                onConsumeCreateReleaseIntent?.();
              }}
              disabled={createResourceReleaseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!createReleaseKind) {
                  return;
                }

                if (createReleaseMode === "static-site") {
                  if (!staticSiteCreateInput) {
                    return;
                  }

                  createResourceReleaseMutation.mutate(staticSiteCreateInput);
                  return;
                }

                if (!selectedImageUid) {
                  return;
                }

                if (createReleaseMode === "project-agent") {
                  createResourceReleaseMutation.mutate({
                    mode: "project-agent",
                    project: projectUid,
                    project_related_image: selectedImageUid,
                    cpu_request: computeState.cpuRequest.trim() || "100m",
                    memory_request: computeState.memoryRequest.trim() || "512Mi",
                    gpu_request: parsedGpuRequest ? String(parsedGpuRequest) : undefined,
                    gpu_type: computeState.gpuType.trim() || undefined,
                    spot: computeState.spot,
                  });
                  return;
                }

                if (!selectedResourceUid) {
                  return;
                }

                createResourceReleaseMutation.mutate({
                  resource_uid: selectedResourceUid,
                  related_image_uid: selectedImageUid,
                  cpu_request: computeState.cpuRequest.trim() || "100m",
                  memory_request: computeState.memoryRequest.trim() || "512Mi",
                  gpu_request: parsedGpuRequest ? String(parsedGpuRequest) : null,
                  gpu_type: computeState.gpuType.trim() || null,
                  release_kind: createReleaseKind,
                  spot: computeState.spot,
                  automatic_deployment: createAutomaticDeployment,
                });
              }}
              disabled={
                createResourceReleaseMutation.isPending ||
                (createReleaseMode === "static-site"
                  ? staticSiteCapabilitiesQuery.isLoading ||
                    staticSiteRequiredConfigurationMissing ||
                    !staticSiteCreateInput
                  : (createReleaseMode !== "project-agent" && releaseResourcesQuery.isLoading) ||
                    projectImagesQuery.isLoading ||
                    (Boolean(computeState.gpuRequest) && availableGpuTypesQuery.isLoading) ||
                    !selectedImageUid ||
                    !gpuSelectionIsValid ||
                    (createReleaseMode !== "project-agent" && !selectedResourceUid))
              }
            >
              {createResourceReleaseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : createReleaseKind === "agent" ? (
                <Rocket className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {createReleaseMode === "project-agent"
                ? "Create Project Agent"
                : createReleaseMode === "static-site"
                  ? "Create Static Site"
                : createReleaseKind
                  ? `Create ${formatReleaseKind(createReleaseKind)}`
                  : "Create release"}
            </Button>
          </div>
        </div>
      </Dialog>

      <ActionConfirmationDialog
        title={
          releasesPendingDelete.length > 1
            ? "Delete resource releases"
            : "Delete resource release"
        }
        open={releasesPendingDelete.length > 0}
        onClose={() => {
          if (!deleteResourceReleaseMutation.isPending) {
            setReleasesPendingDelete([]);
          }
        }}
        tone="danger"
        actionLabel="delete"
        objectLabel={releasesPendingDelete.length > 1 ? "resource releases" : "resource release"}
        confirmWord={
          releasesPendingDelete.length > 1
            ? "DELETE RELEASES"
            : "DELETE RELEASE"
        }
        confirmButtonLabel={
          releasesPendingDelete.length > 1
            ? "Delete resource releases"
            : "Delete resource release"
        }
        description="This action removes the selected resource releases."
        specialText="This action cannot be undone."
        objectSummary={
          releasesPendingDelete.length === 1 ? (
            <>
              <div className="font-medium">{releasesPendingDelete[0]?.subdomain}</div>
              <div className="mt-1 text-muted-foreground">
                {releasesPendingDelete[0]
                  ? `Release UID ${releasesPendingDelete[0].uid}`
                  : null}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">
                {releasesPendingDelete.length} resource releases selected
              </div>
              <div className="mt-1 text-muted-foreground">
                {releasesPendingDelete
                  .slice(0, 3)
                  .map((release) => release.subdomain)
                  .join(", ")}
                {releasesPendingDelete.length > 3 ? ", ..." : ""}
              </div>
            </>
          )
        }
        error={
          deleteResourceReleaseMutation.isError
            ? formatMainSequenceError(deleteResourceReleaseMutation.error)
            : undefined
        }
        isPending={deleteResourceReleaseMutation.isPending}
        onConfirm={() => {
          if (releasesPendingDelete.length === 0) {
            return;
          }

          return deleteResourceReleaseMutation.mutateAsync(releasesPendingDelete);
        }}
      />

      {staticSiteViewerState ? (
        <StaticSiteReleaseViewer
          state={staticSiteViewerState}
          onClose={closeStaticSiteViewer}
          themeId={themeId}
          themeMode={activeTheme.mode}
          userUid={sessionUser?.uid ?? null}
        />
      ) : null}
    </div>
  );
}
