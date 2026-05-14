/** @vitest-environment jsdom */
/** @vitest-environment-options {"url":"http://localhost:5173/auth/callback"} */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/auth/auth-store";
import { clearPendingSocialAuthSession } from "@/auth/social-auth";
import { CommandCenterConfigProvider } from "@/config/CommandCenterConfigProvider";
import { SocialAuthCallbackPage } from "@/features/auth/SocialAuthCallbackPage";
import { ThemeProvider } from "@/themes/ThemeProvider";

const localStorageState = new Map<string, string>();
const localStorageStub: Storage = {
  get length() {
    return localStorageState.size;
  },
  clear() {
    localStorageState.clear();
  },
  getItem(key) {
    return localStorageState.get(key) ?? null;
  },
  key(index) {
    return [...localStorageState.keys()][index] ?? null;
  },
  removeItem(key) {
    localStorageState.delete(key);
  },
  setItem(key, value) {
    localStorageState.set(key, value);
  },
};

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: localStorageStub,
});
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorageStub,
});

function flushEffects() {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 0);
  });
}

describe("SocialAuthCallbackPage", () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalCompleteSocialLogin = useAuthStore.getState().completeSocialLogin;
  const originalApplyJwtResponse = useAuthStore.getState().applyJwtResponse;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    clearPendingSocialAuthSession();
    window.sessionStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    useAuthStore.setState({
      completeSocialLogin: originalCompleteSocialLogin,
      applyJwtResponse: originalApplyJwtResponse,
    });
    clearPendingSocialAuthSession();
    window.sessionStorage.clear();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows waitlist confirmation without requiring a pending social-auth session", async () => {
    const completeSocialLogin = vi.fn().mockResolvedValue(true);
    const applyJwtResponse = vi.fn().mockResolvedValue(true);

    useAuthStore.setState({
      completeSocialLogin,
      applyJwtResponse,
    });

    await act(async () => {
      root.render(
        <CommandCenterConfigProvider>
          <ThemeProvider>
            <MemoryRouter
              initialEntries={[
                "/auth/callback?signup_status=waitlisted&signup_code=signup_waitlisted&waitlist_status=waiting&waitlist_entry_id=42&email=user@example.com&message=Thank%20you%20for%20registering%20your%20interest.&state=abc123",
              ]}
            >
              <Routes>
                <Route path="/auth/callback" element={<SocialAuthCallbackPage />} />
              </Routes>
            </MemoryRouter>
          </ThemeProvider>
        </CommandCenterConfigProvider>,
      );
      await flushEffects();
    });

    expect(container.textContent).toContain("Waitlist confirmed");
    expect(container.textContent).toContain(
      "Thank you for registering your interest.",
    );
    expect(container.textContent).toContain("user@example.com");
    expect(container.textContent).not.toContain(
      "Social sign-in state is missing or expired.",
    );
    expect(completeSocialLogin).not.toHaveBeenCalled();
    expect(applyJwtResponse).not.toHaveBeenCalled();
  });
});
