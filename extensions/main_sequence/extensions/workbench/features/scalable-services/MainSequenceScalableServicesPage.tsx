import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { getAppPath } from "@/apps/utils";

import {
  MainSequenceScalableServiceDetail,
  type ScalableServiceDetailTabId,
} from "./MainSequenceScalableServiceDetail";
import type { KnativePodRuntimeDetailTabId } from "./MainSequenceKnativePodRuntimeDetail";

const mainSequenceScalableServiceIdParam = "msScalableServiceId";
const mainSequenceScalableServiceTabParam = "msScalableServiceTab";
const mainSequenceScalableServicePodRuntimeIdParam = "msScalableServicePodRuntimeId";
const mainSequenceScalableServicePodRuntimeTabParam = "msScalableServicePodRuntimeTab";

function isScalableServiceDetailTabId(value: string | null): value is ScalableServiceDetailTabId {
  return value === "pods" || value === "revisions";
}

function isKnativePodRuntimeDetailTabId(value: string | null): value is KnativePodRuntimeDetailTabId {
  return value === "logs" || value === "resource_usage";
}

export function MainSequenceScalableServicesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const activeServiceId = Number(searchParams.get(mainSequenceScalableServiceIdParam) ?? "");
  const requestedTabId = searchParams.get(mainSequenceScalableServiceTabParam);
  const activePodRuntimeId = Number(
    searchParams.get(mainSequenceScalableServicePodRuntimeIdParam) ?? "",
  );
  const requestedPodRuntimeTabId = searchParams.get(mainSequenceScalableServicePodRuntimeTabParam);
  const isDetailOpen = Number.isFinite(activeServiceId) && activeServiceId > 0;
  const activeTabId: ScalableServiceDetailTabId = isScalableServiceDetailTabId(requestedTabId)
    ? requestedTabId
    : "pods";
  const activePodRuntimeTabId: KnativePodRuntimeDetailTabId =
    isKnativePodRuntimeDetailTabId(requestedPodRuntimeTabId)
      ? requestedPodRuntimeTabId
      : "logs";

  function updateSearchParams(update: (nextParams: URLSearchParams) => void) {
    const nextParams = new URLSearchParams(location.search);
    update(nextParams);
    const nextSearch = nextParams.toString();

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: false },
    );
  }

  function closeServiceDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceScalableServiceIdParam);
      nextParams.delete(mainSequenceScalableServiceTabParam);
      nextParams.delete(mainSequenceScalableServicePodRuntimeIdParam);
      nextParams.delete(mainSequenceScalableServicePodRuntimeTabParam);
    });
  }

  function selectDetailTab(tabId: ScalableServiceDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceScalableServiceTabParam, tabId);
      nextParams.delete(mainSequenceScalableServicePodRuntimeIdParam);
      nextParams.delete(mainSequenceScalableServicePodRuntimeTabParam);
    });
  }

  function openPodRuntimeDetail(podRuntimeId: number) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceScalableServicePodRuntimeIdParam, String(podRuntimeId));
      nextParams.set(mainSequenceScalableServicePodRuntimeTabParam, "logs");
    });
  }

  function closePodRuntimeDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceScalableServicePodRuntimeIdParam);
      nextParams.delete(mainSequenceScalableServicePodRuntimeTabParam);
    });
  }

  function selectPodRuntimeDetailTab(tabId: KnativePodRuntimeDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceScalableServicePodRuntimeTabParam, tabId);
    });
  }

  if (!isDetailOpen) {
    return <Navigate to={getAppPath("main_sequence_workbench", "projects")} replace />;
  }

  return (
    <MainSequenceScalableServiceDetail
      activeTabId={activeTabId}
      activePodRuntimeId={Number.isFinite(activePodRuntimeId) && activePodRuntimeId > 0 ? activePodRuntimeId : null}
      activePodRuntimeTabId={activePodRuntimeTabId}
      initialService={null}
      onBack={closeServiceDetail}
      onBackFromPodRuntimeDetail={closePodRuntimeDetail}
      onOpenPodRuntimeDetail={openPodRuntimeDetail}
      onSelectPodRuntimeTab={selectPodRuntimeDetailTab}
      onSelectTab={selectDetailTab}
      serviceId={activeServiceId}
    />
  );
}
