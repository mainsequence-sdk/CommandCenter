import { useMemo } from "react";

import { useLocation } from "react-router-dom";

import { ChatOverlay } from "./ChatOverlay";
import { ChatProvider } from "./ChatProvider";
import {
  CHAT_PAGE_PATH,
  CHAT_RAIL_WIDTH,
  type ChatRailMode,
  useChatUiStore,
} from "./chat-ui-store";
import { useProjectAgentRailStore } from "./project-agent-rail-store";

export function ProjectAgentChatMount({ mode }: { mode?: ChatRailMode }) {
  const location = useLocation();
  const launchTarget = useProjectAgentRailStore((state) => state.launchTarget);
  const railOpen = useProjectAgentRailStore((state) => state.railOpen);
  const railMode = useProjectAgentRailStore((state) => state.railMode);
  const closeRail = useProjectAgentRailStore((state) => state.closeRail);
  const setRailMode = useProjectAgentRailStore((state) => state.setRailMode);
  const mainChatRailOpen = useChatUiStore((state) => state.railOpen);
  const mainChatRailMode = useChatUiStore((state) => state.railMode);
  const resolvedMode = mode ?? railMode;
  const isOverlayMode = resolvedMode === "overlay";
  const showOverlay =
    !mode &&
    location.pathname !== CHAT_PAGE_PATH &&
    railOpen &&
    railMode === "overlay" &&
    Boolean(launchTarget);
  const shouldRender = mode ? railOpen && railMode === mode && Boolean(launchTarget) : showOverlay;
  const pageOriginPath = `${location.pathname}${location.search}${location.hash}`;
  const rightOffsetPx =
    isOverlayMode &&
    location.pathname !== CHAT_PAGE_PATH &&
    mainChatRailOpen &&
    mainChatRailMode === "overlay"
      ? CHAT_RAIL_WIDTH
      : 0;
  const embeddedRailState = useMemo(
    () => ({
      closeRail,
      isRailOpen: railOpen,
      openRail: (nextMode: ChatRailMode) => {
        setRailMode(nextMode);
      },
      pageOriginPath,
      railMode,
      setPageOriginPath: () => undefined,
    }),
    [closeRail, pageOriginPath, railMode, railOpen, setRailMode],
  );

  if (!shouldRender || !launchTarget) {
    return null;
  }

  return (
    <ChatProvider
      variant="embedded-project-agent"
      embeddedRailState={embeddedRailState}
      embeddedLaunchTarget={launchTarget}
    >
      <ChatOverlay mode={resolvedMode} rightOffsetPx={rightOffsetPx} />
    </ChatProvider>
  );
}
