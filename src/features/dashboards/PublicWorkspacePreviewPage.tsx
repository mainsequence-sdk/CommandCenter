import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { WorkspaceStudioCanvasHost } from "./WorkspaceStudioCanvasHost";

export function PublicWorkspacePreviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("mode");
      setSearchParams(nextParams);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [searchParams, setSearchParams]);

  return <WorkspaceStudioCanvasHost publicPreview />;
}
