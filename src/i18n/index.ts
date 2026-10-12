import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.toml";
import zhCN from "./locales/zh-CN.toml";

export const DEFAULT_LANGUAGE = "zh-CN";
export const LANGUAGE_STORAGE_KEY = "asar-explorer.language";
export type Language = "en" | "zh-CN";
export const resources = {
  en: { translation: en },
  "zh-CN": { translation: zhCN },
};
export function supportedLanguage(value: string): Language | undefined {
  if (/^zh(?:-|$)/i.test(value)) return "zh-CN";
  if (/^en(?:-|$)/i.test(value)) return "en";
}
export function createI18n(language: Language = DEFAULT_LANGUAGE) {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: "en",
    supportedLngs: ["en", "zh-CN"],
    load: "currentOnly",
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}
export const staticT = createI18n().getFixedT(DEFAULT_LANGUAGE);
