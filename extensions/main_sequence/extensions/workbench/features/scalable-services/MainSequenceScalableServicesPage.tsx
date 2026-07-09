import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { getAppPath } from "@/apps/utils";

import {
  MainSequenceScalableServiceDetail,
  type ScalableServiceDetailTabId,
} from "./MainSequenceScalableServiceDetail";
import type { KnativePodRuntimeDetailTabId } from "./MainSequenceKnativePodRuntimeDetail";

const mainSequenceScalableServiceUidParam = "msScalableServiceUid";
const mainSequenceScalableServiceTabParam = "msScalableServiceTab";
const mainSequenceScalableServicePodRuntimeUidParam = "msScalableServicePodRuntimeUid";
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
  const activeServiceUid = searchParams.get(mainSequenceScalableServiceUidParam)?.trim() ?? "";
  const requestedTabId = searchParams.get(mainSequenceScalableServiceTabParam);
  const activePodRuntimeUid =
    searchParams.get(mainSequenceScalableServicePodRuntimeUidParam)?.trim() ?? "";
  const requestedPodRuntimeTabId = searchParams.get(mainSequenceScalableServicePodRuntimeTabParam);
  const isDetailOpen = activeServiceUid.length > 0;
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
      nextParams.delete(mainSequenceScalableServiceUidParam);
      nextParams.delete(mainSequenceScalableServiceTabParam);
      nextParams.delete(mainSequenceScalableServicePodRuntimeUidParam);
      nextParams.delete(mainSequenceScalableServicePodRuntimeTabParam);
    });
  }

  function selectDetailTab(tabId: ScalableServiceDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceScalableServiceTabParam, tabId);
      nextParams.delete(mainSequenceScalableServicePodRuntimeUidParam);
      nextParams.delete(mainSequenceScalableServicePodRuntimeTabParam);
    });
  }

  function openPodRuntimeDetail(podRuntimeUid: string) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceScalableServicePodRuntimeUidParam, podRuntimeUid);
      nextParams.set(mainSequenceScalableServicePodRuntimeTabParam, "logs");
    });
  }

  function closePodRuntimeDetail() {
    updateSearchParams((nextParams) => {
      nextParams.delete(mainSequenceScalableServicePodRuntimeUidParam);
      nextParams.delete(mainSequenceScalableServicePodRuntimeTabParam);
    });
  }

  function selectPodRuntimeDetailTab(tabId: KnativePodRuntimeDetailTabId) {
    updateSearchParams((nextParams) => {
      nextParams.set(mainSequenceScalableServicePodRuntimeTabParam, tabId);
    });
  }

  if (!isDetailOpen) {
    return <Navigate to={getAppPath("main-sequence-foundry", "projects")} replace />;
  }

  return (
    <MainSequenceScalableServiceDetail
      activeTabId={activeTabId}
      activePodRuntimeUid={activePodRuntimeUid || null}
      activePodRuntimeTabId={activePodRuntimeTabId}
      initialService={null}
      onBack={closeServiceDetail}
      onBackFromPodRuntimeDetail={closePodRuntimeDetail}
      onOpenPodRuntimeDetail={openPodRuntimeDetail}
      onSelectPodRuntimeTab={selectPodRuntimeDetailTab}
      onSelectTab={selectDetailTab}
      serviceUid={activeServiceUid}
    />
  );
}
