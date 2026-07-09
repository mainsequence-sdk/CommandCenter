import { useEffect } from "react";

import { useLocation } from "react-router-dom";

import { useAuthStore } from "@/auth/auth-store";

import { ChatOverlay } from "./ChatOverlay";
import { useChatFeature } from "./ChatProvider";
import { CHAT_PAGE_PATH } from "./chat-ui-store";

const mainSequenceAiAppId = "main_sequence_ai";

export function ChatMount() {
  const location = useLocation();
  const shellAccess = useAuthStore((state) => state.session?.user.shellAccess);
  const { isRailOpen, railMode, toggleChat } = useChatFeature();
  const mainSequenceAiAllowed = Boolean(
    shellAccess?.accessibleApps.includes(mainSequenceAiAppId),
  );
  const showOverlay =
    mainSequenceAiAllowed &&
    location.pathname !== CHAT_PAGE_PATH &&
    isRailOpen &&
    railMode === "overlay";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!mainSequenceAiAllowed) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        event.stopPropagation();
        toggleChat();
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [mainSequenceAiAllowed, toggleChat]);

  return (
    <>
      {showOverlay ? <ChatOverlay mode="overlay" /> : null}
    </>
  );
}
