/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RbacPolicyStudio } from "./rbac-policy-studio";

function flushEffects() {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 0);
  });
}

describe("RbacPolicyStudio", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders system policies as read-only", async () => {
    await act(async () => {
      root.render(
        <RbacPolicyStudio
          policies={[
            {
              id: 1,
              slugifiedName: "dev-user",
              label: "Dev User",
              description: "Developer shell access",
              permissions: ["workspaces:view", "main_sequence_foundry:view"],
              isSystem: true,
              isEditable: false,
            },
          ]}
          permissionOptions={[
            {
              id: "workspaces:view",
              label: "Workspaces / view",
            },
            {
              id: "main_sequence_foundry:view",
              label: "Main Sequence Foundry / view",
            },
          ]}
          onCreatePolicy={vi.fn()}
          onUpdatePolicy={vi.fn()}
          onDeletePolicy={vi.fn()}
        />,
      );
      await flushEffects();
    });

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Save"),
    );

    expect(container.textContent).toContain("This policy is read-only.");
    expect(container.textContent).toContain("Create a custom policy if you need a different permission bundle.");
    expect(container.textContent).not.toContain("Remove policy");
    expect(saveButton).not.toBeNull();
    expect(saveButton?.getAttribute("disabled")).not.toBeNull();
  });
});
