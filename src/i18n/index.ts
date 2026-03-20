import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import {
  defaultLanguage,
  isSupportedLanguage,
  languageStorageKey,
  supportedLanguages,
} from "@/i18n/config";
import { resources } from "@/i18n/resources";

function resolveInitialLanguage() {
  if (typeof window === "undefined") {
    return defaultLanguage;
  }

  const storedLanguage = window.localStorage.getItem(languageStorageKey);
  if (storedLanguage && isSupportedLanguage(storedLanguage)) {
    return storedLanguage;
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
  if (typeof window !== "undefined" && isSupportedLanguage(language)) {
    window.localStorage.setItem(languageStorageKey, language);
  }

  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
});

export { i18n };
