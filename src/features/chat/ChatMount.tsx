import { useEffect } from "react";

import { useLocation } from "react-router-dom";

import { useChatFeature } from "@/features/chat/ChatProvider";
import { ChatOverlay } from "@/features/chat/ChatOverlay";
import { CHAT_PAGE_PATH } from "@/features/chat/chat-ui-store";

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;

  if (!element) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  const tagName = element.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

export function ChatMount() {
  const location = useLocation();
  const { isOverlayOpen, toggleChat } = useChatFeature();
  const showOverlay = location.pathname !== CHAT_PAGE_PATH && isOverlayOpen;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        if (isEditableTarget(event.target)) {
          return;
        }

        event.preventDefault();
        toggleChat();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleChat]);

  return (
    <>
      {showOverlay ? <ChatOverlay /> : null}
    </>
  );
}
