import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { commandCenterConfig } from "@/config/command-center";
import { env } from "@/config/env";
import { readCachedCurrentCommandCenterPreferences } from "@/preferences/api";
import {
  defaultLanguage,
  isSupportedLanguage,
  languageStorageKey,
  supportedLanguages,
} from "@/i18n/config";
import { resources } from "@/i18n/resources";

const backendPreferencesEnabled =
  !env.useMockData && Boolean(commandCenterConfig.preferences.url.trim());

function resolveInitialLanguage() {
  if (typeof window === "undefined") {
    return defaultLanguage;
  }

  if (backendPreferencesEnabled) {
    const cachedLanguage = readCachedCurrentCommandCenterPreferences()?.language;

    if (cachedLanguage && isSupportedLanguage(cachedLanguage)) {
      return cachedLanguage;
    }
  } else {
    const storedLanguage = window.localStorage.getItem(languageStorageKey);
    if (storedLanguage && isSupportedLanguage(storedLanguage)) {
      return storedLanguage;
    }
  }

  const browserLanguage = window.navigator.language.split("-")[0]?.toLowerCase() ?? "";
  if (isSupportedLanguage(browserLanguage)) {
    return browserLanguage;
  }

  return defaultLanguage;
}

const initialLanguage = resolveInitialLanguage();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: defaultLanguage,
  supportedLngs: supportedLanguages,
  interpolation: {
    escapeValue: false,
  },
});

if (typeof document !== "undefined") {
  document.documentElement.lang = initialLanguage;
}

i18n.on("languageChanged", (language) => {
  if (
    !backendPreferencesEnabled &&
    typeof window !== "undefined" &&
    isSupportedLanguage(language)
  ) {
    window.localStorage.setItem(languageStorageKey, language);
  }

  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
});

export { i18n };
