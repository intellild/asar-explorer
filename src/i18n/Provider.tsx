import { useState, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { createI18n } from "./index";

export function LocaleProvider({ children }: { children: ReactNode }) {
  // SSG and the initial client render share a fixed locale. Restore preferences after hydration.
  const [instance] = useState(() => createI18n());
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
