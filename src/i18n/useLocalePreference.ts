import { useContext, useEffect } from "react";
import { I18nContext } from "react-i18next";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  supportedLanguage,
} from "./index";

/** Run inside the hydrated route, rather than the shell above its Suspense boundary. */
export function useLocalePreference() {
  // useTranslation() returns language-specific wrappers; the provider instance stays stable.
  const instance = useContext(I18nContext)?.i18n;
  useEffect(() => {
    if (!instance) return;
    let preferred;
    try {
      preferred = supportedLanguage(
        localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "",
      );
    } catch {
      /* Storage may be unavailable. */
    }
    preferred ??=
      navigator.languages.map(supportedLanguage).find(Boolean) ?? "en";
    const updateDocument = () => {
      const language = instance.resolvedLanguage ?? DEFAULT_LANGUAGE;
      document.documentElement.lang = language;
      document.title = instance.t("app.title");
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute("content", instance.t("app.description"));
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      } catch {
        /* Language switching still works without storage. */
      }
    };
    instance.on("languageChanged", updateDocument);
    void instance.changeLanguage(preferred);
    updateDocument();
    return () => {
      instance.off("languageChanged", updateDocument);
    };
  }, [instance]);
}
